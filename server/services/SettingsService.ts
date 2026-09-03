import { userRepository } from '../repositories/UserRepository.js';
import { createPool, db } from '../../src/db/index.js';
import { categoryBudgets, debts, splits, transactions, users } from '../../src/db/schema.js';

const TRUE_SPEND_BACKUP_HEADER = '-- TrueSpend Complete PostgreSQL Database Backup';
const MAX_BACKUP_SIZE_BYTES = 10 * 1024 * 1024;

type BackupTable = 'users' | 'debts' | 'transactions' | 'splits' | 'category_budgets';

type BackupRow = {
  table: BackupTable;
  columns: string[];
  values: Array<string | null>;
};

const backupTables = new Set<BackupTable>(['users', 'debts', 'transactions', 'splits', 'category_budgets']);
const allowedColumns: Record<BackupTable, ReadonlySet<string>> = {
  users: new Set(['id', 'uid', 'email', 'created_at', 'payday', 'emergency_buffer', 'salary']),
  debts: new Set(['id', 'user_id', 'contact_name', 'type', 'original_amount', 'remaining_balance', 'status', 'due_date', 'created_at']),
  transactions: new Set(['id', 'user_id', 'created_at', 'amount', 'type', 'source_wallet', 'category', 'notes']),
  splits: new Set(['id', 'transaction_id', 'reimbursable_amount', 'linked_contact_id']),
  category_budgets: new Set(['id', 'user_id', 'category', 'year', 'month', 'amount', 'created_at', 'updated_at']),
};

const restoreOrder: BackupTable[] = ['users', 'debts', 'transactions', 'splits', 'category_budgets'];

function splitSqlValues(valuesSql: string): string[] {
  const values: string[] = [];
  let valueStart = 0;
  let inString = false;

  for (let index = 0; index < valuesSql.length; index += 1) {
    if (valuesSql[index] === "'") {
      if (inString && valuesSql[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
    } else if (valuesSql[index] === ',' && !inString) {
      values.push(valuesSql.slice(valueStart, index).trim());
      valueStart = index + 1;
    }
  }

  if (inString) throw new Error('Invalid TrueSpend backup: an SQL string is not closed.');
  values.push(valuesSql.slice(valueStart).trim());
  return values;
}

function parseSqlValue(value: string): string | null {
  const withoutCast = value.replace(/::[a-z_][a-z0-9_]*\s*$/i, '').trim();
  if (withoutCast.toUpperCase() === 'NULL') return null;
  if (/^-?\d+(\.\d+)?$/.test(withoutCast)) return withoutCast;

  if (withoutCast.startsWith("'") && withoutCast.endsWith("'")) {
    return withoutCast.slice(1, -1).replace(/''/g, "'");
  }

  throw new Error('Invalid TrueSpend backup: an unsupported SQL value was found.');
}

function getInsertStatements(sqlContent: string): string[] {
  const inserts: string[] = [];
  const startPattern = /INSERT\s+INTO\s+(users|debts|transactions|splits|category_budgets)\b/gi;
  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(sqlContent)) !== null) {
    let inString = false;
    let statementEnd = -1;

    for (let index = match.index; index < sqlContent.length; index += 1) {
      if (sqlContent[index] === "'") {
        if (inString && sqlContent[index + 1] === "'") {
          index += 1;
        } else {
          inString = !inString;
        }
      } else if (sqlContent[index] === ';' && !inString) {
        statementEnd = index + 1;
        break;
      }
    }

    if (statementEnd === -1) throw new Error('Invalid TrueSpend backup: an INSERT statement is incomplete.');
    inserts.push(sqlContent.slice(match.index, statementEnd));
    startPattern.lastIndex = statementEnd;
  }

  return inserts;
}

function parseBackupRows(sqlContent: unknown): BackupRow[] {
  if (typeof sqlContent !== 'string' || !sqlContent.slice(0, 500).includes(TRUE_SPEND_BACKUP_HEADER)) {
    throw new Error('Please select a SQL backup exported by TrueSpend.');
  }
  if (Buffer.byteLength(sqlContent, 'utf8') > MAX_BACKUP_SIZE_BYTES) {
    throw new Error('This backup is larger than the 10 MB import limit.');
  }

  const rows: BackupRow[] = [];
  for (const statement of getInsertStatements(sqlContent)) {
    const parsed = /^INSERT\s+INTO\s+([a-z_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*)\)\s*;$/i.exec(statement.trim());
    if (!parsed || !backupTables.has(parsed[1] as BackupTable)) {
      throw new Error('Invalid TrueSpend backup: an INSERT statement could not be read.');
    }

    const table = parsed[1] as BackupTable;
    const columns = parsed[2].split(',').map((column) => column.trim().toLowerCase());
    const rawValues = splitSqlValues(parsed[3]);

    if (columns.length !== rawValues.length || columns.length === 0 || columns.some((column) => !allowedColumns[table].has(column))) {
      throw new Error('Invalid TrueSpend backup: table columns do not match this version of TrueSpend.');
    }

    rows.push({ table, columns, values: rawValues.map(parseSqlValue) });
  }

  if (!rows.some((row) => row.table === 'users')) {
    throw new Error('This backup does not contain any TrueSpend user records.');
  }

  return rows;
}

export interface UpdateSettingsDTO {
  automatedDriveBackups?: boolean;
  lastDriveBackupDate?: string;
  driveBackupFrequency?: 'daily' | '3days' | 'weekly';
  googleDriveToken?: string;
  payday?: number;
  emergencyBuffer?: number;
  salary?: number;
}

export class SettingsService {
  async getSettings(dbUser: any) {
    return {
      payday: dbUser.payday || 25,
      emergencyBuffer: dbUser.emergencyBuffer || 0,
      salary: dbUser.salary || 0,
      automatedDriveBackups: Boolean(dbUser.automatedDriveBackups),
      lastDriveBackupDate: dbUser.lastDriveBackupDate ? new Date(dbUser.lastDriveBackupDate).toISOString() : null,
      driveBackupFrequency: dbUser.driveBackupFrequency || 'weekly',
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDTO) {
    const updateData: {
      payday?: number;
      emergencyBuffer?: string;
      salary?: string;
      automatedDriveBackups?: number;
      lastDriveBackupDate?: Date;
      driveBackupFrequency?: string;
      googleDriveToken?: string;
      googleDriveTokenExpiry?: Date;
    } = {};

    if (dto.automatedDriveBackups !== undefined) {
      updateData.automatedDriveBackups = dto.automatedDriveBackups ? 1 : 0;
    }
    if (dto.lastDriveBackupDate !== undefined) {
      updateData.lastDriveBackupDate = new Date(dto.lastDriveBackupDate);
    }
    if (dto.driveBackupFrequency !== undefined) {
      updateData.driveBackupFrequency = dto.driveBackupFrequency;
    }
    if (dto.googleDriveToken !== undefined) {
      updateData.googleDriveToken = dto.googleDriveToken;
      updateData.googleDriveTokenExpiry = new Date(Date.now() + 3600 * 1000);
    }
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

    if (dto.salary !== undefined) {
      if (dto.salary >= 0) {
        updateData.salary = String(dto.salary);
      } else {
        throw new Error('Invalid salary');
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRepository.updateSettings(userId, updateData);
    }

    return { success: true, ...updateData };
  }

  async backupToGoogleDrive(accessToken: string): Promise<{ fileId: string; lastDriveBackupDate: string }> {
    const sqlContent = await this.exportSqlDatabase();
    const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;

    const metadata = {
      name: filename,
      mimeType: 'application/sql',
    };

    const boundary = '-------TrueSpendBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/sql\r\n\r\n' +
      sqlContent +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SettingsService] Failed to upload file to Google Drive:', response.status, errText);
      throw new Error(`Failed to upload file to Google Drive: ${response.statusText}`);
    }

    const result = (await response.json()) as any;
    const lastDriveBackupDate = new Date().toISOString();
    return { fileId: result.id, lastDriveBackupDate };
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
    emergency_buffer DECIMAL DEFAULT '0' NOT NULL,
    salary DECIMAL DEFAULT '0' NOT NULL
);`);

    lines.push(`CREATE TABLE debts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    contact_name TEXT NOT NULL,
    type debt_type NOT NULL,
    original_amount DECIMAL NOT NULL,
    remaining_balance DECIMAL NOT NULL,
    status debt_status NOT NULL,
    due_date TIMESTAMP,
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
          `INSERT INTO users (id, uid, email, created_at, payday, emergency_buffer, salary) ` +
            `VALUES (${escapeStr(user.id)}, ${escapeStr(user.uid)}, ${escapeStr(user.email)}, ${escapeDate(user.createdAt)}, ${escapeNum(user.payday ?? 25)}, ${escapeNum(user.emergencyBuffer ?? 0)}, ${escapeNum(user.salary ?? 0)});`
        );
      }
      lines.push('');
    }

    if (allDebts.length > 0) {
      lines.push('-- Debts Data');
      for (const d of allDebts) {
        lines.push(
          `INSERT INTO debts (id, user_id, contact_name, type, original_amount, remaining_balance, status, due_date, created_at) ` +
            `VALUES (${escapeStr(d.id)}, ${escapeStr(d.userId)}, ${escapeStr(d.contactName)}, ${escapeStr(d.type)}::debt_type, ${escapeNum(d.originalAmount)}, ${escapeNum(d.remainingBalance)}, ${escapeStr(d.status)}::debt_status, ${escapeDate(d.dueDate)}, ${escapeDate(d.createdAt)}) ` +
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

  async importSqlDatabase(sqlContent: unknown) {
    const backupRows = parseBackupRows(sqlContent);
    const rowsByTable = new Map<BackupTable, BackupRow[]>();
    for (const table of restoreOrder) rowsByTable.set(table, []);
    for (const row of backupRows) rowsByTable.get(row.table)!.push(row);

    const client = await createPool().connect();
    try {
      await client.query('BEGIN');
      await client.query('LOCK TABLE splits, transactions, debts, category_budgets, users IN ACCESS EXCLUSIVE MODE');
      await client.query('DELETE FROM splits');
      await client.query('DELETE FROM transactions');
      await client.query('DELETE FROM debts');
      await client.query('DELETE FROM category_budgets');
      await client.query('DELETE FROM users');

      for (const table of restoreOrder) {
        for (const row of rowsByTable.get(table)!) {
          const placeholders = row.values.map((_, index) => `$${index + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${row.table} (${row.columns.join(', ')}) VALUES (${placeholders})`,
            row.values,
          );
        }
      }

      await client.query('COMMIT');
      return Object.fromEntries(restoreOrder.map((table) => [table, rowsByTable.get(table)!.length]));
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const settingsService = new SettingsService();
