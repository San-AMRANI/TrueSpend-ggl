import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer, boolean, uniqueIndex } from 'drizzle-orm/pg-core';

export const transactionTypeEnum = pgEnum('transaction_type', ['Income', 'Expense', 'Transfer', 'Debt Repayment']);
export const walletEnum = pgEnum('wallet_type', ['Bank', 'Cash']);
export const debtTypeEnum = pgEnum('debt_type', ['Receivable', 'Payable']);
export const debtStatusEnum = pgEnum('debt_status', ['Pending', 'Cleared']);

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

export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  amount: decimal('amount').notNull(),
  type: transactionTypeEnum('type').notNull(),
  sourceWallet: walletEnum('source_wallet').notNull(),
  category: text('category'),
  notes: text('notes'),
  /** Present only for income generated from a calendar payroll. */
  payrollId: uuid('payroll_id').references(() => payrolls.id),
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

/** Phase 3 — Financial goals */
export const goals = pgTable('goals', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  name: text('name').notNull(),
  targetAmount: decimal('target_amount').notNull(),
  currentAmount: decimal('current_amount').default('0').notNull(),
  deadline: timestamp('deadline'),
  category: text('category').default('').notNull(),
  notes: text('notes').default('').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// ─── Relations ────────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many, one }) => ({
  transactions: many(transactions),
  debts: many(debts),
  categoryBudgets: many(categoryBudgets),
  payrolls: many(payrolls),
  notificationDevices: many(notificationDevices),
  pushSubscriptions: many(pushSubscriptions),
  notificationPreferences: one(notificationPreferences),
  notificationDeliveries: many(notificationDeliveries),
  goals: many(goals),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  split: one(splits, {
    fields: [transactions.id],
    references: [splits.transactionId],
  }),
  payroll: one(payrolls, {
    fields: [transactions.payrollId],
    references: [payrolls.id],
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

export const goalsRelations = relations(goals, ({ one }) => ({
  user: one(users, {
    fields: [goals.userId],
    references: [users.id],
  }),
}));
