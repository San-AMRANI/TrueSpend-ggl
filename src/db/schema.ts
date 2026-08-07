import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, timestamp, decimal, pgEnum, integer } from 'drizzle-orm/pg-core';

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
});

export const debts = pgTable('debts', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  contactName: text('contact_name').notNull(),
  type: debtTypeEnum('type').notNull(),
  originalAmount: decimal('original_amount').notNull(),
  remainingBalance: decimal('remaining_balance').notNull(),
  status: debtStatusEnum('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
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
});

export const splits = pgTable('splits', {
  id: uuid('id').defaultRandom().primaryKey(),
  transactionId: uuid('transaction_id').references(() => transactions.id).notNull(),
  reimbursableAmount: decimal('reimbursable_amount').notNull(),
  linkedContactId: uuid('linked_contact_id').references(() => debts.id),
});

export const usersRelations = relations(users, ({ many }) => ({
  transactions: many(transactions),
  debts: many(debts),
}));

export const transactionsRelations = relations(transactions, ({ one }) => ({
  user: one(users, {
    fields: [transactions.userId],
    references: [users.id],
  }),
  split: one(splits, {
    fields: [transactions.id],
    references: [splits.transactionId]
  })
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
