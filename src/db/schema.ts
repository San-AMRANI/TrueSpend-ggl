import {
  pgTable,
  uuid,
  text,
  decimal,
  integer,
  timestamp,
  boolean,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  uid: text('uid').notNull().unique(),
  username: text('username').unique(),
  displayName: text('display_name'),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  role: text('role', { enum: ['owner', 'admin', 'manager', 'member', 'viewer'] })
    .default('member')
    .notNull(),
  status: text('status', { enum: ['active', 'suspended', 'legacy_hidden'] })
    .default('active')
    .notNull(),
  workspaceMode: text('workspace_mode', { enum: ['shared', 'isolated'] })
    .default('shared')
    .notNull(),
  permissions: text('permissions'), // JSON string of granular capability flags
  avatarColor: text('avatar_color').default('indigo'),
  notes: text('notes'),
  lastLoginAt: timestamp('last_login_at'),
  createdBy: uuid('created_by'),
  payday: integer('payday').default(1).notNull(),
  salary: decimal('salary').default('0').notNull(),
  emergencyBuffer: decimal('emergency_buffer').default('0').notNull(),
  googleDriveToken: text('google_drive_token'),
  googleDriveRefreshToken: text('google_drive_refresh_token'),
  googleDriveTokenExpiry: timestamp('google_drive_token_expiry'),
  automatedDriveBackups: integer('automated_drive_backups').default(0),
  lastDriveBackupDate: text('last_drive_backup_date'),
  driveBackupFrequency: text('drive_backup_frequency').default('weekly'),
  notificationEnabled: integer('notification_enabled').default(1),
  notificationTime: text('notification_time').default('09:00'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const userAuditLogs = pgTable(
  'user_audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    actorName: text('actor_name').notNull(),
    targetUserId: uuid('target_user_id'),
    targetUserName: text('target_user_name').notNull(),
    action: text('action').notNull(),
    details: text('details').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    targetCreatedIdx: index('idx_audit_target_created').on(table.targetUserId, table.createdAt),
  })
);

export const wallets = pgTable(
  'wallets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    type: text('type', { enum: ['Bank', 'Cash', 'Savings', 'Investment'] })
      .default('Bank')
      .notNull(),
    accountSubtype: text('account_subtype', {
      enum: ['Checking', 'Cash', 'Savings', 'Investment', 'CreditCard', 'Overdraft', 'Loan'],
    })
      .default('Checking')
      .notNull(),
    institutionName: text('institution_name'),
    currency: text('currency').default('MAD').notNull(),
    creditLimit: decimal('credit_limit'),
    liabilityBalance: decimal('liability_balance').default('0').notNull(),
    statementClosingDay: integer('statement_closing_day'),
    paymentDueDay: integer('payment_due_day'),
    lastReconciledAt: timestamp('last_reconciled_at'),
    valuationStatus: text('valuation_status', { enum: ['verified', 'estimated', 'stale'] })
      .default('verified')
      .notNull(),
    isMain: boolean('is_main').default(false).notNull(),
    initialBalance: decimal('initial_balance').default('0').notNull(),
    currentBalance: decimal('current_balance').default('0').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userMainIdx: index('idx_wallets_user_main').on(table.userId, table.isMain),
  })
);

export const financialContexts = pgTable(
  'financial_contexts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    type: text('type').default('Event').notNull(),
    status: text('status').default('Active').notNull(),
    budget: decimal('budget').default('0'),
    startDate: timestamp('start_date').defaultNow(),
    endDate: timestamp('end_date'),
    description: text('description'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusStartIdx: index('idx_contexts_user_status_start').on(
      table.userId,
      table.status,
      table.startDate
    ),
  })
);

export const payrolls = pgTable(
  'payrolls',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    scheduledFor: timestamp('scheduled_for').notNull(),
    amount: decimal('amount').notNull(),
    currency: text('currency').default('MAD').notNull(),
    status: text('status', { enum: ['expected', 'confirmed', 'matched', 'skipped'] })
      .default('expected')
      .notNull(),
    confirmedAmount: decimal('confirmed_amount'),
    confirmedAt: timestamp('confirmed_at'),
    varianceAmount: decimal('variance_amount'),
    varianceNotes: text('variance_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userScheduledIdx: index('idx_payrolls_user_scheduled').on(table.userId, table.scheduledFor),
  })
);

export const counterparties = pgTable(
  'counterparties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    canonicalName: text('canonical_name').notNull(),
    normalizedName: text('normalized_name').notNull(),
    counterpartyType: text('counterparty_type').default('merchant').notNull(),
    aliasesJson: text('aliases_json').default('[]').notNull(),
    defaultCategory: text('default_category'),
    website: text('website'),
    logoUrl: text('logo_url'),
    contactDetails: text('contact_details'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userNormalizedIdx: uniqueIndex('counterparties_user_normalized_idx').on(
      table.userId,
      table.normalizedName
    ),
  })
);

export const transactions = pgTable(
  'transactions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    payrollId: uuid('payroll_id').references(() => payrolls.id),
    walletId: uuid('wallet_id').references(() => wallets.id),
    destinationWalletId: uuid('destination_wallet_id').references(() => wallets.id),
    contextId: uuid('context_id').references(() => financialContexts.id),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    amount: decimal('amount').notNull(), // Reporting amount in MAD (locked at posting)
    nativeAmount: decimal('native_amount'), // Original native amount if non-MAD
    currency: text('currency').default('MAD').notNull(),
    exchangeRateUsed: decimal('exchange_rate_used').default('1').notNull(),
    fxSource: text('fx_source').default('base_currency').notNull(),
    idempotencyKey: text('idempotency_key'),
    type: text('type', { enum: ['Income', 'Expense', 'Transfer', 'Debt Repayment'] }).notNull(),
    sourceWallet: text('source_wallet', { enum: ['Bank', 'Cash'] }),
    category: text('category'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_transactions_user_created').on(
      table.userId,
      table.createdAt,
      table.id
    ),
    userWalletCreatedIdx: index('idx_transactions_user_wallet_created').on(
      table.userId,
      table.walletId,
      table.createdAt,
      table.id
    ),
    userDestinationCreatedIdx: index('idx_transactions_user_destination_created').on(
      table.userId,
      table.destinationWalletId,
      table.createdAt
    ),
    userPayrollIdx: index('idx_transactions_user_payroll').on(table.userId, table.payrollId),
    userIdempotencyUnique: uniqueIndex('uq_transactions_user_idempotency').on(
      table.userId,
      table.idempotencyKey
    ),
  })
);

export const splits = pgTable(
  'splits',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    transactionId: uuid('transaction_id').references(() => transactions.id).notNull(),
    reimbursableAmount: decimal('reimbursable_amount').notNull(),
    linkedContactId: uuid('linked_contact_id').references(() => debts.id),
  },
  (table) => ({
    transactionIdx: index('idx_splits_transaction').on(table.transactionId),
    linkedContactIdx: index('idx_splits_linked_contact').on(table.linkedContactId),
  })
);

export const debts = pgTable(
  'debts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    contactName: text('contact_name').notNull(),
    counterpartyType: text('counterparty_type').default('Person'),
    type: text('type', { enum: ['Receivable', 'Payable'] }).notNull(),
    originalAmount: decimal('original_amount').notNull(),
    principalBalance: decimal('principal_balance'),
    remainingBalance: decimal('remaining_balance').notNull(),
    currency: text('currency').default('MAD').notNull(),
    interestRateApr: decimal('interest_rate_apr').default('0'),
    rateType: text('rate_type').default('none'),
    minimumPayment: decimal('minimum_payment'),
    paymentFrequency: text('payment_frequency').default('monthly'),
    installmentAmount: decimal('installment_amount'),
    installmentFrequency: text('installment_frequency').default('one_time'),
    feesAmount: decimal('fees_amount').default('0'),
    totalInstallments: integer('total_installments'),
    remainingInstallments: integer('remaining_installments'),
    nextPaymentDate: timestamp('next_payment_date'),
    lateFeeAmount: decimal('late_fee_amount').default('0'),
    status: text('status', { enum: ['Pending', 'Cleared'] }).default('Pending').notNull(),
    dueDate: timestamp('due_date'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusDueIdx: index('idx_debts_user_status_due').on(
      table.userId,
      table.status,
      table.dueDate
    ),
  })
);

export const categoryBudgets = pgTable(
  'category_budgets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    category: text('category').notNull(),
    year: integer('year').notNull(),
    month: integer('month').notNull(),
    amount: decimal('amount').default('0').notNull(),
    rolloverEnabled: boolean('rollover_enabled').default(false).notNull(),
    rolloverAmount: decimal('rollover_amount').default('0').notNull(),
    alertThresholdPercent: integer('alert_threshold_percent').default(85).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userCategoryYearMonthIdx: uniqueIndex('category_budgets_user_category_year_month_idx').on(
      table.userId,
      table.category,
      table.year,
      table.month
    ),
  })
);

export const goals = pgTable(
  'goals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    targetAmount: decimal('target_amount').notNull(),
    currentAmount: decimal('current_amount').default('0').notNull(),
    autoSyncBalance: boolean('auto_sync_balance').default(false).notNull(),
    fundingCadence: text('funding_cadence').default('monthly'),
    plannedContributionAmount: decimal('planned_contribution_amount').default('0'),
    deadline: timestamp('deadline'),
    category: text('category').default('Savings').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userUpdatedIdx: index('idx_goals_user_updated').on(table.userId, table.updatedAt),
  })
);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    name: text('name').notNull(),
    icon: text('icon').default('🔁'),
    websiteUrl: text('website_url'),
    amount: decimal('amount').notNull(),
    currency: text('currency').default('MAD').notNull(),
    billingCycle: text('billing_cycle').default('monthly').notNull(),
    nextBillingDate: timestamp('next_billing_date'),
    category: text('category').default('Subscriptions').notNull(),
    status: text('status').default('active').notNull(),
    autoRenew: boolean('auto_renew').default(true).notNull(),
    reminderDays: integer('reminder_days').default(3).notNull(),
    priceHistory: text('price_history'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusNextIdx: index('idx_subscriptions_user_status_next').on(
      table.userId,
      table.status,
      table.nextBillingDate
    ),
  })
);

export const stockPositions = pgTable(
  'stock_positions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    market: text('market').default('US').notNull(),
    sector: text('sector').default('Technology').notNull(),
    shares: decimal('shares').default('0').notNull(),
    avgCostPerShare: decimal('avg_cost_per_share').default('0').notNull(),
    currentPrice: decimal('current_price').default('0').notNull(),
    currency: text('currency').default('USD').notNull(),
    annualDividendPerShare: decimal('annual_dividend_per_share').default('0').notNull(),
    targetWeightPercent: decimal('target_weight_percent').default('0').notNull(),
    convictionThesis: text('conviction_thesis'),
    isWatchlistOnly: boolean('is_watchlist_only').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userWatchlistIdx: index('idx_stock_positions_user_watchlist').on(
      table.userId,
      table.isWatchlistOnly
    ),
  })
);

export const stockOrders = pgTable(
  'stock_orders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    positionId: uuid('position_id')
      .references(() => stockPositions.id, { onDelete: 'cascade' })
      .notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    ticker: text('ticker').default('EQUITY').notNull(),
    companyName: text('company_name').default('').notNull(),
    market: text('market').default('US').notNull(),
    action: text('action', { enum: ['BUY', 'SELL', 'DIVIDEND'] }).default('BUY').notNull(),
    shares: decimal('shares').default('0').notNull(),
    pricePerShare: decimal('price_per_share').default('0').notNull(),
    totalNativeAmount: decimal('total_native_amount').default('0').notNull(),
    currency: text('currency').default('USD').notNull(),
    exchangeRateUsed: decimal('exchange_rate_used').default('10').notNull(),
    totalMadAmount: decimal('total_mad_amount').default('0').notNull(),
    realizedPnlMad: decimal('realized_pnl_mad').default('0'),
    notes: text('notes'),
    executedAt: timestamp('executed_at').defaultNow().notNull(),
  },
  (table) => ({
    userExecutedIdx: index('idx_stock_orders_user_executed').on(table.userId, table.executedAt),
    positionExecutedIdx: index('idx_stock_orders_position_executed').on(
      table.positionId,
      table.executedAt
    ),
  })
);

export const marketInstruments = pgTable('market_instruments', {
  symbol: text('symbol').primaryKey(),
  rawTicker: text('raw_ticker').notNull(),
  underlyingTicker: text('underlying_ticker').notNull(),
  companyName: text('company_name').notNull(),
  instrumentType: text('instrument_type', {
    enum: ['EQUITY', 'ETF', 'TOKENIZED_EQUITY', 'CRYPTO', 'CASH'],
  })
    .default('EQUITY')
    .notNull(),
  exchange: text('exchange').default('NASDAQ').notNull(),
  country: text('country').default('US').notNull(),
  currency: text('currency').default('USD').notNull(),
  sector: text('sector').default('Technology & Cloud').notNull(),
  annualDividendPerShare: decimal('annual_dividend_per_share').default('0').notNull(),
  dividendYieldPercent: decimal('dividend_yield_percent').default('0').notNull(),
  lastPrice: decimal('last_price').default('0').notNull(),
  change24hPercent: decimal('change_24h_percent').default('0').notNull(),
  providerSource: text('provider_source').default('curated').notNull(),
  displayApproved: boolean('display_approved').default(false).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const marketDataSymbols = marketInstruments;

export const marketDailyBars = pgTable(
  'market_daily_bars',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    symbol: text('symbol').notNull(),
    barDate: text('bar_date').notNull(),
    open: decimal('open').notNull(),
    high: decimal('high').notNull(),
    low: decimal('low').notNull(),
    close: decimal('close').notNull(),
    volume: decimal('volume').default('0').notNull(),
    currency: text('currency').default('USD').notNull(),
    provider: text('provider').default('cached_eod').notNull(),
    providerSource: text('provider_source').default('TwelveData').notNull(),
    isAdjusted: boolean('is_adjusted').default(true).notNull(),
    fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
  },
  (table) => ({
    symbolBarDateIdx: uniqueIndex('market_daily_bars_symbol_date_idx').on(
      table.symbol,
      table.barDate
    ),
  })
);
export const marketDataDailyBars = marketDailyBars;

export const dividendEvents = pgTable(
  'dividend_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    positionId: uuid('position_id').references(() => stockPositions.id, { onDelete: 'set null' }),
    ticker: text('ticker').notNull(),
    companyName: text('company_name').notNull(),
    market: text('market').default('US').notNull(),
    declarationDate: text('declaration_date'),
    exDividendDate: text('ex_dividend_date'),
    exDate: text('ex_date').default('').notNull(),
    recordDate: text('record_date'),
    paymentDate: text('payment_date').notNull(),
    status: text('status').default('estimated').notNull(),
    dividendPerShare: decimal('dividend_per_share').default('0').notNull(),
    eligibleShares: decimal('eligible_shares').default('0').notNull(),
    sharesEligible: decimal('shares_eligible').default('0').notNull(),
    dividendPerShareNative: decimal('dividend_per_share_native').default('0').notNull(),
    grossAmount: decimal('gross_amount').default('0').notNull(),
    grossAmountNative: decimal('gross_amount_native').default('0').notNull(),
    withholdingTax: decimal('withholding_tax').default('0').notNull(),
    withholdingTaxRatePercent: decimal('withholding_tax_rate_percent').default('15').notNull(),
    withholdingTaxNative: decimal('withholding_tax_native').default('0').notNull(),
    feeAmount: decimal('fee_amount').default('0').notNull(),
    netAmount: decimal('net_amount').default('0').notNull(),
    netAmountNative: decimal('net_amount_native').default('0').notNull(),
    currency: text('currency').default('USD').notNull(),
    fxRateUsed: decimal('fx_rate_used').default('9.95').notNull(),
    grossAmountMad: decimal('gross_amount_mad').default('0').notNull(),
    taxAmountMad: decimal('tax_amount_mad').default('0').notNull(),
    netAmountMad: decimal('net_amount_mad').default('0').notNull(),
    source: text('source').default('manual').notNull(),
    reinvested: boolean('reinvested').default(false).notNull(),
    notes: text('notes'),
    verifiedAt: timestamp('verified_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userPaymentIdx: index('idx_dividends_user_payment').on(table.userId, table.paymentDate),
  })
);
export const investmentDividendEvents = dividendEvents;

export const portfolioDailySnapshots = pgTable(
  'portfolio_daily_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    snapshotDate: text('snapshot_date').notNull(),
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
  (table) => ({
    userSnapshotDateIdx: uniqueIndex('portfolio_snapshots_user_date_idx').on(
      table.userId,
      table.snapshotDate
    ),
  })
);

export const marketDataUsage = pgTable(
  'market_data_usage',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').default('TwelveData').notNull(),
    utcDate: text('utc_date').default('').notNull(),
    utcMinute: text('utc_minute').default('').notNull(),
    dateKey: text('date_key').default('').notNull(),
    minuteKey: text('minute_key').default('').notNull(),
    endpoint: text('endpoint').default('/time_series').notNull(),
    creditWeight: integer('credit_weight').default(1).notNull(),
    symbolsCount: integer('symbols_count').default(1).notNull(),
    creditsReserved: integer('credits_reserved').default(1).notNull(),
    creditsUsedHeader: integer('credits_used_header'),
    creditsLeftHeader: integer('credits_left_header'),
    dailyCreditsUsed: integer('daily_credits_used').default(0).notNull(),
    minuteCreditsUsed: integer('minute_credits_used').default(0).notNull(),
    status: text('status').default('reserved').notNull(),
    requestId: text('request_id'),
    lastRequestAt: timestamp('last_request_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    providerDateIdx: index('idx_market_usage_provider_date').on(table.provider, table.dateKey),
  })
);

export const userInvestmentSettings = pgTable('user_investment_settings', {
  userId: uuid('user_id').primaryKey().references(() => users.id),
  investorProfile: text('investor_profile').default('Balanced Compounder').notNull(),
  reportingCurrency: text('reporting_currency').default('MAD').notNull(),
  selectedBenchmarks: text('selected_benchmarks'),
  riskFreeRatePercent: decimal('risk_free_rate_percent').default('3.5').notNull(),
  manualUsdMadRate: decimal('manual_usd_mad_rate'),
  usWithholdingTaxPercent: decimal('us_withholding_tax_percent').default('15').notNull(),
  moroccoWithholdingTaxPercent: decimal('morocco_withholding_tax_percent').default('15').notNull(),
  usBrokerFeePercent: decimal('us_broker_fee_percent').default('0.10').notNull(),
  bvcBrokerFeePercent: decimal('bvc_broker_fee_percent').default('0.35').notNull(),
  custodyFeeAnnualPercent: decimal('custody_fee_annual_percent').default('0').notNull(),
  defaultBenchmark: text('default_benchmark').default('SPY').notNull(),
  enforceEmergencyBufferGuard: boolean('enforce_emergency_buffer_guard').default(true).notNull(),
  twelveDataDisplayApproved: boolean('twelve_data_display_approved').default(false).notNull(),
  targetAllocationsJson: text('target_allocations_json'),
  goalsJson: text('goals_json'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
export const investmentSettings = userInvestmentSettings;

export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    endpoint: text('endpoint').notNull().unique(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdx: index('idx_push_subscriptions_user').on(table.userId),
  })
);

export const notificationPreferences = pgTable('notification_preferences', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id).notNull().unique(),
  enabled: boolean('enabled').default(true).notNull(),
  deliveryTime: text('delivery_time').default('09:00').notNull(),
  timezone: text('timezone').default('Africa/Casablanca').notNull(),
  quietHoursStart: text('quiet_hours_start').default('22:00').notNull(),
  quietHoursEnd: text('quiet_hours_end').default('08:00').notNull(),
  dailyInsightEnabled: boolean('daily_insight_enabled').default(true).notNull(),
  budgetWarningEnabled: boolean('budget_warning_enabled').default(true).notNull(),
  forecastWarningEnabled: boolean('forecast_warning_enabled').default(true).notNull(),
  anomalyEnabled: boolean('anomaly_enabled').default(true).notNull(),
  goalEnabled: boolean('goal_enabled').default(true).notNull(),
  debtReminderEnabled: boolean('debt_reminder_enabled').default(true).notNull(),
  weeklySummaryEnabled: boolean('weekly_summary_enabled').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const notificationDeliveries = pgTable(
  'notification_deliveries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    type: text('type').notNull(),
    referenceDate: text('reference_date').default('').notNull(),
    scheduledFor: text('scheduled_for'),
    metadata: text('metadata'),
    deliveredAt: timestamp('delivered_at').defaultNow().notNull(),
  },
  (table) => ({
    userTypeDateIdx: uniqueIndex('notification_deliveries_user_type_date_idx').on(
      table.userId,
      table.type,
      table.referenceDate
    ),
    userDeliveredIdx: index('idx_notification_deliveries_user_delivered').on(
      table.userId,
      table.deliveredAt
    ),
  })
);

// ─────────────────────────────────────────────────────────────────────────────
// CORE AUDIT RECOMMENDATIONS: DOUBLE-ENTRY JOURNAL, FX, RECONCILIATION,
// REVIEW INBOX, COMMITMENT OCCURRENCES, GOAL LEDGER, SCENARIOS, RULES & WEALTH
// ─────────────────────────────────────────────────────────────────────────────

export const journalEntries = pgTable(
  'journal_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
    entryType: text('entry_type').default('standard').notNull(),
    status: text('status', { enum: ['posted', 'reversed'] }).default('posted').notNull(),
    reversalOfEntryId: uuid('reversal_of_entry_id'),
    currency: text('currency').default('MAD').notNull(),
    exchangeRateUsed: decimal('exchange_rate_used').default('1').notNull(),
    isEstimatedBackfill: boolean('is_estimated_backfill').default(false).notNull(),
    idempotencyKey: text('idempotency_key'),
    memo: text('memo'),
    postedAt: timestamp('posted_at').defaultNow().notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userIdempotencyIdx: uniqueIndex('journal_entries_user_idempotency_idx').on(
      table.userId,
      table.idempotencyKey
    ),
    userTxStatusIdx: index('idx_journal_entries_user_tx_status').on(
      table.userId,
      table.transactionId,
      table.status
    ),
    userPostedIdx: index('idx_journal_entries_user_posted').on(table.userId, table.postedAt),
  })
);

export const journalLines = pgTable(
  'journal_lines',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    journalEntryId: uuid('journal_entry_id')
      .references(() => journalEntries.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    accountCode: text('account_code').notNull(),
    accountName: text('account_name').notNull(),
    accountClass: text('account_class').notNull(),
    debitMad: decimal('debit_mad').default('0').notNull(),
    creditMad: decimal('credit_mad').default('0').notNull(),
    nativeAmount: decimal('native_amount').default('0').notNull(),
    nativeCurrency: text('native_currency').default('MAD').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    entryIdx: index('idx_journal_lines_entry').on(table.journalEntryId),
    userWalletIdx: index('idx_journal_lines_user_wallet').on(table.userId, table.walletId),
  })
);

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    baseCurrency: text('base_currency').notNull(),
    quoteCurrency: text('quote_currency').default('MAD').notNull(),
    rate: decimal('rate').notNull(),
    effectiveDate: text('effective_date').notNull(),
    source: text('source').default('manual').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userPairDateIdx: index('idx_exchange_rates_user_pair_date').on(
      table.userId,
      table.baseCurrency,
      table.quoteCurrency,
      table.effectiveDate
    ),
  })
);

export const statementImportBatches = pgTable(
  'statement_import_batches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id')
      .references(() => wallets.id, { onDelete: 'cascade' })
      .notNull(),
    fileName: text('file_name').notNull(),
    fileFormat: text('file_format').default('CSV').notNull(),
    statementOpeningBalance: decimal('statement_opening_balance'),
    statementClosingBalance: decimal('statement_closing_balance'),
    statementStartDate: text('statement_start_date'),
    statementEndDate: text('statement_end_date'),
    totalRows: integer('total_rows').default(0).notNull(),
    matchedCount: integer('matched_count').default(0).notNull(),
    unmatchedCount: integer('unmatched_count').default(0).notNull(),
    ambiguousCount: integer('ambiguous_count').default(0).notNull(),
    duplicateCount: integer('duplicate_count').default(0).notNull(),
    reconciledVariance: decimal('reconciled_variance').default('0'),
    status: text('status').default('pending_review').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_statement_batches_user_created').on(table.userId, table.createdAt),
  })
);

export const statementImportRows = pgTable(
  'statement_import_rows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    batchId: uuid('batch_id')
      .references(() => statementImportBatches.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    walletId: uuid('wallet_id')
      .references(() => wallets.id, { onDelete: 'cascade' })
      .notNull(),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    rowDate: text('row_date').notNull(),
    description: text('description').notNull(),
    amount: decimal('amount').notNull(),
    currency: text('currency').default('MAD').notNull(),
    externalReference: text('external_reference'),
    rowHash: text('row_hash').notNull(),
    matchStatus: text('match_status').default('unmatched').notNull(),
    matchConfidence: decimal('match_confidence').default('0').notNull(),
    linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    suggestedTransactionId: uuid('suggested_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    candidateTransactionIdsJson: text('candidate_transaction_ids_json'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    batchIdx: index('idx_statement_rows_batch').on(table.batchId),
    userWalletDateIdx: index('idx_statement_rows_user_wallet_date').on(
      table.userId,
      table.walletId,
      table.rowDate
    ),
    linkedTxIdx: index('idx_statement_rows_linked_tx').on(table.linkedTransactionId),
    suggestedTxIdx: index('idx_statement_rows_suggested_tx').on(table.suggestedTransactionId),
    walletHashUnique: uniqueIndex('uq_statement_rows_wallet_hash').on(
      table.walletId,
      table.rowHash
    ),
  })
);

export const financialReviewItems = pgTable(
  'financial_review_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    sourceType: text('source_type').notNull(),
    status: text('status').default('Needs Review').notNull(),
    confidenceScore: decimal('confidence_score').default('0.80').notNull(),
    parsedAmount: decimal('parsed_amount').notNull(),
    parsedCurrency: text('parsed_currency').default('MAD').notNull(),
    parsedDate: text('parsed_date').notNull(),
    parsedDescription: text('parsed_description').notNull(),
    parsedCategory: text('parsed_category').default('🛒 Groceries').notNull(),
    parsedType: text('parsed_type').default('Expense').notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    counterpartyId: uuid('counterparty_id').references(() => counterparties.id, {
      onDelete: 'set null',
    }),
    linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    rawPayloadJson: text('raw_payload_json'),
    decisionNotes: text('decision_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userStatusCreatedIdx: index('idx_review_user_status_created').on(
      table.userId,
      table.status,
      table.createdAt
    ),
  })
);

export const commitmentOccurrences = pgTable(
  'commitment_occurrences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    category: text('category').default('Subscriptions').notNull(),
    direction: text('direction').default('outflow').notNull(),
    expectedDate: text('expected_date').notNull(),
    expectedAmount: decimal('expected_amount').notNull(),
    currency: text('currency').default('MAD').notNull(),
    status: text('status').default('scheduled').notNull(),
    actualDate: text('actual_date'),
    actualAmount: decimal('actual_amount'),
    paidAmount: decimal('paid_amount').default('0'),
    varianceAmount: decimal('variance_amount').default('0'),
    principalAmount: decimal('principal_amount'),
    principalComponent: decimal('principal_component'),
    interestAmount: decimal('interest_amount'),
    interestComponent: decimal('interest_component'),
    feeAmount: decimal('fee_amount'),
    feeComponent: decimal('fee_component'),
    installmentNumber: integer('installment_number'),
    remainingBalanceAfter: decimal('remaining_balance_after'),
    isNonCashEvent: boolean('is_non_cash_event').default(false).notNull(),
    rescheduledToDate: text('rescheduled_to_date'),
    skipOrRenegotiateReason: text('skip_or_renegotiate_reason'),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    linkedTransactionId: uuid('linked_transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    varianceNotes: text('variance_notes'),
    historyJson: text('history_json').default('[]'),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateStatusIdx: index('idx_commitments_user_date_status').on(
      table.userId,
      table.expectedDate,
      table.status
    ),
    sourceDateUnique: uniqueIndex('uq_commitment_source_date').on(
      table.userId,
      table.sourceType,
      table.sourceId,
      table.expectedDate
    ),
  })
);

export const goalContributionEvents = pgTable(
  'goal_contribution_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    goalId: uuid('goal_id')
      .references(() => goals.id, { onDelete: 'cascade' })
      .notNull(),
    walletId: uuid('wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    sourceWalletId: uuid('source_wallet_id').references(() => wallets.id, { onDelete: 'set null' }),
    destinationWalletId: uuid('destination_wallet_id').references(() => wallets.id, {
      onDelete: 'set null',
    }),
    transactionId: uuid('transaction_id').references(() => transactions.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type').default('contribution').notNull(),
    amount: decimal('amount').notNull(),
    currency: text('currency').default('MAD').notNull(),
    note: text('note'),
    notes: text('notes'),
    eventDate: text('event_date').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userGoalDateIdx: index('idx_goal_events_user_goal_date').on(
      table.userId,
      table.goalId,
      table.eventDate
    ),
  })
);

export const savedScenarios = pgTable(
  'saved_scenarios',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    description: text('description'),
    baselineSnapshotJson: text('baseline_snapshot_json').notNull(),
    eventsJson: text('events_json').notNull(),
    assumptionsJson: text('assumptions_json').notNull(),
    projectedSummaryJson: text('projected_summary_json').notNull(),
    isApprovedPlan: boolean('is_approved_plan').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userUpdatedIdx: index('idx_scenarios_user_updated').on(table.userId, table.updatedAt),
  })
);

export const financialRules = pgTable(
  'financial_rules',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    enabled: boolean('enabled').default(true).notNull(),
    version: integer('version').default(1).notNull(),
    triggerType: text('trigger_type').notNull(),
    conditionsJson: text('conditions_json').notNull(),
    actionType: text('action_type').notNull(),
    actionPayloadJson: text('action_payload_json').notNull(),
    approvalPolicy: text('approval_policy').default('require_approval').notNull(),
    lastTriggeredAt: timestamp('last_triggered_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userTriggerEnabledIdx: index('idx_rules_user_trigger_enabled').on(
      table.userId,
      table.triggerType,
      table.enabled
    ),
  })
);

export const financialRuleLogs = pgTable(
  'financial_rule_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ruleId: uuid('rule_id')
      .references(() => financialRules.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    ruleVersion: integer('rule_version').default(1).notNull(),
    triggerEventSummary: text('trigger_event_summary').notNull(),
    proposedResultSummary: text('proposed_result_summary').notNull(),
    outcomeStatus: text('outcome_status').default('draft_created').notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userCreatedIdx: index('idx_rule_logs_user_created').on(table.userId, table.createdAt),
    userIdempotencyUnique: uniqueIndex('uq_financial_rule_logs_idempotency').on(
      table.userId,
      table.idempotencyKey
    ),
  })
);

export const externalWealthItems = pgTable(
  'external_wealth_items',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    name: text('name').notNull(),
    itemClass: text('item_class').notNull(),
    isLiability: boolean('is_liability').default(false).notNull(),
    isLiquid: boolean('is_liquid').default(false).notNull(),
    estimatedValue: decimal('estimated_value').notNull(),
    currency: text('currency').default('MAD').notNull(),
    valuationDate: text('valuation_date').notNull(),
    valuationSource: text('valuation_source').default('manual_estimate').notNull(),
    confidenceLevel: text('confidence_level').default('medium').notNull(),
    isExternallyVerified: boolean('is_externally_verified').default(false).notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    userValuationIdx: index('idx_external_wealth_user_valuation').on(
      table.userId,
      table.valuationDate
    ),
  })
);

export const externalWealthValuations = pgTable(
  'external_wealth_valuations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    itemId: uuid('item_id')
      .references(() => externalWealthItems.id, { onDelete: 'cascade' })
      .notNull(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    estimatedValue: decimal('estimated_value').notNull(),
    currency: text('currency').default('MAD').notNull(),
    fxRateUsed: decimal('fx_rate_used').default('1').notNull(),
    fxSource: text('fx_source').default('manual').notNull(),
    valueMad: decimal('value_mad').notNull(),
    valuationDate: text('valuation_date').notNull(),
    valuationSource: text('valuation_source').default('manual_estimate').notNull(),
    confidenceLevel: text('confidence_level').default('medium').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    itemDateIdx: index('idx_external_valuations_item_date').on(table.itemId, table.valuationDate),
  })
);

export const financialPositionSnapshots = pgTable(
  'financial_position_snapshots',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    snapshotDate: text('snapshot_date').notNull(),
    reportingCurrency: text('reporting_currency').default('MAD').notNull(),
    bankBalanceMad: decimal('bank_balance_mad').default('0').notNull(),
    cashBalanceMad: decimal('cash_balance_mad').default('0').notNull(),
    savingsBalanceMad: decimal('savings_balance_mad').default('0').notNull(),
    investmentCashMad: decimal('investment_cash_mad').default('0').notNull(),
    creditCardLiabilityMad: decimal('credit_card_liability_mad').default('0').notNull(),
    overdraftLiabilityMad: decimal('overdraft_liability_mad').default('0').notNull(),
    receivablesMad: decimal('receivables_mad').default('0').notNull(),
    payablesMad: decimal('payables_mad').default('0').notNull(),
    investmentMarketValueMad: decimal('investment_market_value_mad').default('0').notNull(),
    externalAssetsMad: decimal('external_assets_mad').default('0').notNull(),
    externalLiabilitiesMad: decimal('external_liabilities_mad').default('0').notNull(),
    totalNetWorthMad: decimal('total_net_worth_mad').default('0').notNull(),
    liquidNetWorthMad: decimal('liquid_net_worth_mad').default('0').notNull(),
    fxRatesJson: text('fx_rates_json').default('{}').notNull(),
    componentsJson: text('components_json').default('{}').notNull(),
    dataSource: text('data_source').default('verified_computed').notNull(),
    confidenceLevel: text('confidence_level').default('high').notNull(),
    isEstimated: boolean('is_estimated').default(false).notNull(),
    triggerSource: text('trigger_source').default('daily').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    userDateIdx: uniqueIndex('financial_position_snapshots_user_date_idx').on(
      table.userId,
      table.snapshotDate
    ),
    userSnapshotDateLookupIdx: index('idx_snapshots_user_date').on(
      table.userId,
      table.snapshotDate
    ),
  })
);

export const domainEventOutbox = pgTable(
  'domain_event_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id).notNull(),
    eventType: text('event_type').notNull(),
    aggregateId: text('aggregate_id').notNull(),
    payloadJson: text('payload_json').notNull(),
    status: text('status', { enum: ['pending', 'processed', 'failed'] })
      .default('pending')
      .notNull(),
    attempts: integer('attempts').default(0).notNull(),
    lastError: text('last_error'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    processedAt: timestamp('processed_at'),
  },
  (table) => ({
    userStatusCreatedIdx: index('idx_outbox_user_status_created').on(
      table.userId,
      table.status,
      table.createdAt
    ),
  })
);

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  debts: many(debts),
  categoryBudgets: many(categoryBudgets),
  payrolls: many(payrolls),
  wallets: many(wallets),
  financialContexts: many(financialContexts),
  goals: many(goals),
  subscriptions: many(subscriptions),
  stockPositions: many(stockPositions),
  stockOrders: many(stockOrders),
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
  transaction: one(transactions, {
    fields: [stockOrders.transactionId],
    references: [transactions.id],
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

export const financialContextsRelations = relations(financialContexts, ({ one, many }) => ({
  user: one(users, {
    fields: [financialContexts.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const walletsRelations = relations(wallets, ({ one, many }) => ({
  user: one(users, {
    fields: [wallets.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const payrollsRelations = relations(payrolls, ({ one, many }) => ({
  user: one(users, {
    fields: [payrolls.userId],
    references: [users.id],
  }),
  transactions: many(transactions),
}));

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  payroll: one(payrolls, {
    fields: [transactions.payrollId],
    references: [payrolls.id],
  }),
  wallet: one(wallets, {
    fields: [transactions.walletId],
    references: [wallets.id],
  }),
  context: one(financialContexts, {
    fields: [transactions.contextId],
    references: [financialContexts.id],
  }),
  splits: many(splits),
}));

export const splitsRelations = relations(splits, ({ one }) => ({
  transaction: one(transactions, {
    fields: [splits.transactionId],
    references: [transactions.id],
  }),
  debt: one(debts, {
    fields: [splits.linkedContactId],
    references: [debts.id],
  }),
}));

export const debtsRelations = relations(debts, ({ one, many }) => ({
  user: one(users, {
    fields: [debts.userId],
    references: [users.id],
  }),
  splits: many(splits),
}));

export const categoryBudgetsRelations = relations(categoryBudgets, ({ one }) => ({
  user: one(users, {
    fields: [categoryBudgets.userId],
    references: [users.id],
  }),
}));
