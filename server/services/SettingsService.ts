import { userRepository } from '../repositories/UserRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

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

  async exportSqlForUser(dbUser: any): Promise<string> {
    const userId = dbUser.id;
    const userDebts = await debtRepository.findAllByUserId(userId);
    const userTxs = await transactionRepository.findAllByUserId(userId);
    const txIds = userTxs.map((t) => t.id);
    const userSplits = await transactionRepository.findSplitsByTransactionIds(txIds);

    const escapeStr = (str: string | null | undefined) => {
      if (str === null || str === undefined) return 'NULL';
      return `'${String(str).replace(/'/g, "''")}'`;
    };

    const escapeNum = (num: any) => {
      if (num === null || num === undefined) return 'NULL';
      return String(num);
    };

    const escapeDate = (date: Date | string | null | undefined) => {
      if (!date) return 'NULL';
      const d = new Date(date);
      return `'${d.toISOString()}'`;
    };

    const lines: string[] = [];

    lines.push('-- ====================================================');
    lines.push('-- TrueSpend PostgreSQL Database Export');
    lines.push(`-- Exported At: ${new Date().toISOString()}`);
    lines.push(`-- User Email: ${dbUser.email}`);
    lines.push('-- ====================================================\n');

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
    lines.push(`CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uid TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    payday INTEGER DEFAULT 25,
    emergency_buffer DECIMAL DEFAULT '0' NOT NULL
);`);

    lines.push(`CREATE TABLE IF NOT EXISTS debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_name TEXT NOT NULL,
    type debt_type NOT NULL,
    original_amount DECIMAL NOT NULL,
    remaining_balance DECIMAL NOT NULL,
    status debt_status NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);`);

    lines.push(`CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    amount DECIMAL NOT NULL,
    type transaction_type NOT NULL,
    source_wallet wallet_type NOT NULL,
    category TEXT,
    notes TEXT
);`);

    lines.push(`CREATE TABLE IF NOT EXISTS splits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
    reimbursable_amount DECIMAL NOT NULL,
    linked_contact_id UUID REFERENCES debts(id) ON DELETE SET NULL
);\n`);

    lines.push('-- 3. DATA INSERTS\n');

    lines.push('-- Users Data');
    lines.push(`INSERT INTO users (id, uid, email, created_at, payday, emergency_buffer)`);
    lines.push(`VALUES (${escapeStr(dbUser.id)}, ${escapeStr(dbUser.uid)}, ${escapeStr(dbUser.email)}, ${escapeDate(dbUser.createdAt)}, ${escapeNum(dbUser.payday ?? 25)}, ${escapeNum(dbUser.emergencyBuffer ?? 0)})`);
    lines.push(`ON CONFLICT (id) DO UPDATE SET payday = EXCLUDED.payday, emergency_buffer = EXCLUDED.emergency_buffer;\n`);

    if (userDebts.length > 0) {
      lines.push('-- Debts Data');
      for (const d of userDebts) {
        lines.push(
          `INSERT INTO debts (id, user_id, contact_name, type, original_amount, remaining_balance, status, created_at) ` +
            `VALUES (${escapeStr(d.id)}, ${escapeStr(d.userId)}, ${escapeStr(d.contactName)}, ${escapeStr(d.type)}::debt_type, ${escapeNum(d.originalAmount)}, ${escapeNum(d.remainingBalance)}, ${escapeStr(d.status)}::debt_status, ${escapeDate(d.createdAt)}) ` +
            `ON CONFLICT (id) DO NOTHING;`
        );
      }
      lines.push('');
    }

    if (userTxs.length > 0) {
      lines.push('-- Transactions Data');
      for (const t of userTxs) {
        lines.push(
          `INSERT INTO transactions (id, user_id, created_at, amount, type, source_wallet, category, notes) ` +
            `VALUES (${escapeStr(t.id)}, ${escapeStr(t.userId)}, ${escapeDate(t.createdAt)}, ${escapeNum(t.amount)}, ${escapeStr(t.type)}::transaction_type, ${escapeStr(t.sourceWallet)}::wallet_type, ${escapeStr(t.category)}, ${escapeStr(t.notes)}) ` +
            `ON CONFLICT (id) DO NOTHING;`
        );
      }
      lines.push('');
    }

    if (userSplits.length > 0) {
      lines.push('-- Splits Data');
      for (const s of userSplits) {
        lines.push(
          `INSERT INTO splits (id, transaction_id, reimbursable_amount, linked_contact_id) ` +
            `VALUES (${escapeStr(s.id)}, ${escapeStr(s.transactionId)}, ${escapeNum(s.reimbursableAmount)}, ${escapeStr(s.linkedContactId)}) ` +
            `ON CONFLICT (id) DO NOTHING;`
        );
      }
      lines.push('');
    }

    return lines.join('\n');
  }
}

export const settingsService = new SettingsService();
