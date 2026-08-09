import { userRepository } from '../repositories/UserRepository.js';
import { db } from '../../src/db/index.js';
import { categoryBudgets, debts, splits, transactions, users } from '../../src/db/schema.js';

export interface UpdateSettingsDTO {
  payday?: number;
  emergencyBuffer?: number;
}

export class SettingsService {
  async getSettings(dbUser: any) {
    return {
      payday: dbUser.payday || 25,
      emergencyBuffer: dbUser.emergencyBuffer || 0,
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDTO) {
    const updateData: { payday?: number; emergencyBuffer?: string } = {};

    if (dto.payday !== undefined) {
      if (dto.payday >= 1 && dto.payday <= 31) {
        updateData.payday = dto.payday;
      } else {
        throw new Error('Invalid payday');
      }
    }

    if (dto.emergencyBuffer !== undefined) {
      if (dto.emergencyBuffer >= 0) {
        updateData.emergencyBuffer = String(dto.emergencyBuffer);
      } else {
        throw new Error('Invalid emergency buffer');
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRepository.updateSettings(userId, updateData);
    }

    return { success: true, ...updateData };
  }

  async exportSqlDatabase(): Promise<string> {
    const [allUsers, allDebts, allTransactions, allSplits, allCategoryBudgets] = await Promise.all([
      db.select().from(users),
      db.select().from(debts),
      db.select().from(transactions),
      db.select().from(splits),
      db.select().from(categoryBudgets),
    ]);

    const escapeStr = (str: string | null | undefined) => {
      if (str === null || str === undefined) return 'NULL';
      return `'${String(str).replace(/'/g, "''")}'`;
    };

    const escapeNum = (num: string | number | null | undefined) => {
      if (num === null || num === undefined) return 'NULL';
      const value = String(num);
      if (!/^-?\d+(\.\d+)?$/.test(value)) {
        throw new Error(`Cannot export invalid numeric value: ${value}`);
      }
      return value;
    };

    const escapeDate = (date: Date | string | null | undefined) => {
      if (!date) return 'NULL';
      const d = new Date(date);
      return `'${d.toISOString()}'`;
    };

    const lines: string[] = [];

    lines.push('-- ====================================================');
    lines.push('-- TrueSpend Complete PostgreSQL Database Backup');
    lines.push(`-- Exported At: ${new Date().toISOString()}`);
    lines.push(`-- Records: ${allUsers.length} users, ${allTransactions.length} transactions, ${allDebts.length} debts, ${allSplits.length} splits, ${allCategoryBudgets.length} category budgets`);
    lines.push('-- Restore this script into a new or empty PostgreSQL database.');
    lines.push('-- ====================================================\n');

    lines.push('BEGIN;');
    lines.push("CREATE EXTENSION IF NOT EXISTS \"pgcrypto\";\n");

    lines.push('-- 1. ENUMS CREATION');
    lines.push(`DO $$ BEGIN
    CREATE TYPE transaction_type AS ENUM ('Income', 'Expense', 'Transfer', 'Debt Repayment');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    lines.push(`DO $$ BEGIN
    CREATE TYPE wallet_type AS ENUM ('Bank', 'Cash');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    lines.push(`DO $$ BEGIN
    CREATE TYPE debt_type AS ENUM ('Receivable', 'Payable');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);

    lines.push(`DO $$ BEGIN
    CREATE TYPE debt_status AS ENUM ('Pending', 'Cleared');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;\n`);

    lines.push('-- 2. SCHEMA TABLES');
    lines.push(`CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    payday INTEGER DEFAULT 25,
    emergency_buffer DECIMAL DEFAULT '0' NOT NULL
);`);

    lines.push(`CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    contact_name TEXT NOT NULL,
    type debt_type NOT NULL,
    original_amount DECIMAL NOT NULL,
    remaining_balance DECIMAL NOT NULL,
    status debt_status NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);`);

    lines.push(`CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW(),
    amount DECIMAL NOT NULL,
    type transaction_type NOT NULL,
    source_wallet wallet_type NOT NULL,
    category TEXT,
    notes TEXT
);`);

    lines.push(`CREATE TABLE splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id),
    reimbursable_amount DECIMAL NOT NULL,
    linked_contact_id UUID REFERENCES debts(id)
);\n`);

    lines.push(`CREATE TABLE category_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    category TEXT NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    amount DECIMAL NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL,
    CONSTRAINT category_budgets_user_category_month_unique UNIQUE (user_id, category, year, month)
);\n`);

    lines.push('-- 3. DATA INSERTS\n');

    if (allUsers.length > 0) {
      lines.push('-- Users Data');
      for (const user of allUsers) {
        lines.push(
          `INSERT INTO users (id, uid, email, created_at, payday, emergency_buffer) ` +
            `VALUES (${escapeStr(user.id)}, ${escapeStr(user.uid)}, ${escapeStr(user.email)}, ${escapeDate(user.createdAt)}, ${escapeNum(user.payday ?? 25)}, ${escapeNum(user.emergencyBuffer ?? 0)});`
        );
      }
      lines.push('');
    }

    if (allDebts.length > 0) {
      lines.push('-- Debts Data');
      for (const d of allDebts) {
        lines.push(
          `INSERT INTO debts (id, user_id, contact_name, type, original_amount, remaining_balance, status, created_at) ` +
            `VALUES (${escapeStr(d.id)}, ${escapeStr(d.userId)}, ${escapeStr(d.contactName)}, ${escapeStr(d.type)}::debt_type, ${escapeNum(d.originalAmount)}, ${escapeNum(d.remainingBalance)}, ${escapeStr(d.status)}::debt_status, ${escapeDate(d.createdAt)}) ` +
            `;`
        );
      }
      lines.push('');
    }

    if (allTransactions.length > 0) {
      lines.push('-- Transactions Data');
      for (const t of allTransactions) {
        lines.push(
          `INSERT INTO transactions (id, user_id, created_at, amount, type, source_wallet, category, notes) ` +
            `VALUES (${escapeStr(t.id)}, ${escapeStr(t.userId)}, ${escapeDate(t.createdAt)}, ${escapeNum(t.amount)}, ${escapeStr(t.type)}::transaction_type, ${escapeStr(t.sourceWallet)}::wallet_type, ${escapeStr(t.category)}, ${escapeStr(t.notes)}) ` +
            `;`
        );
      }
      lines.push('');
    }

    if (allSplits.length > 0) {
      lines.push('-- Splits Data');
      for (const s of allSplits) {
        lines.push(
          `INSERT INTO splits (id, transaction_id, reimbursable_amount, linked_contact_id) ` +
            `VALUES (${escapeStr(s.id)}, ${escapeStr(s.transactionId)}, ${escapeNum(s.reimbursableAmount)}, ${escapeStr(s.linkedContactId)}) ` +
            `;`
        );
      }
      lines.push('');
    }

    if (allCategoryBudgets.length > 0) {
      lines.push('-- Category Budgets Data');
      for (const budget of allCategoryBudgets) {
        lines.push(
          `INSERT INTO category_budgets (id, user_id, category, year, month, amount, created_at, updated_at) ` +
            `VALUES (${escapeStr(budget.id)}, ${escapeStr(budget.userId)}, ${escapeStr(budget.category)}, ${escapeNum(budget.year)}, ${escapeNum(budget.month)}, ${escapeNum(budget.amount)}, ${escapeDate(budget.createdAt)}, ${escapeDate(budget.updatedAt)});`,
        );
      }
      lines.push('');
    }

    lines.push('COMMIT;');
    return lines.join('\n');
  }
}

export const settingsService = new SettingsService();
