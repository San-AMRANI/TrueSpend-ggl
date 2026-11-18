import fs from 'fs';
import path from 'path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import * as schema from './schema.js';

declare global {
  var _postgresPool: any | undefined;
  var _pgliteInstance: PGlite | undefined;
  var _dbInstance: NodePgDatabase<typeof schema> | undefined;
  var _schemaReadyPromise: Promise<void> | undefined;
}

function getExternalPgConfig() {
  let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
  if (connectionString) {
    connectionString = connectionString.replace(/^(DATABASE_URL|POSTGRES_URL)=/i, '').trim();
  }
  const sqlHost = (process.env.SQL_HOST || '').trim();
  return {
    connectionString: connectionString || '',
    hasExternalPg: Boolean(connectionString || sqlHost),
  };
}

function resolvePgliteDataDir(): string {
  if (process.env.NODE_ENV === 'test') {
    return 'memory://';
  }
  const targetDir = path.join(process.cwd(), '.data', 'truespend-pglite');
  try {
    fs.mkdirSync(targetDir, { recursive: true });
    return targetDir;
  } catch {
    return 'memory://';
  }
}

class PGlitePoolAdapter {
  private client: PGlite;

  constructor(client: PGlite) {
    this.client = client;
  }

  on(_event: string, _listener: (...args: any[]) => void) {
    return this;
  }

  async query(text: string, params?: any[]) {
    if (params && params.length > 0) {
      const res = await this.client.query(text, params);
      return {
        rows: res.rows as any[],
        rowCount: res.affectedRows ?? res.rows.length,
        fields: res.fields || [],
      };
    }

    const trimmed = text.trim();
    if (trimmed.includes(';') && !trimmed.toUpperCase().startsWith('DO ')) {
      const cleaned = trimmed.replace(/;+$/, '');
      if (cleaned.includes(';')) {
        const results = await this.client.exec(text);
        const last = results[results.length - 1];
        return {
          rows: (last?.rows || []) as any[],
          rowCount: last?.affectedRows ?? last?.rows?.length ?? 0,
          fields: last?.fields || [],
        };
      }
    }

    const res = await this.client.query(text);
    return {
      rows: res.rows as any[],
      rowCount: res.affectedRows ?? res.rows.length,
      fields: res.fields || [],
    };
  }

  async connect() {
    const adapter = this;
    return {
      query: (text: string, params?: any[]) => adapter.query(text, params),
      release: () => undefined,
    };
  }
}

export const createPool = () => {
  if (!global._postgresPool) {
    const { connectionString, hasExternalPg } = getExternalPgConfig();

    if (hasExternalPg) {
      if (connectionString) {
        global._postgresPool = new Pool({
          connectionString,
          max: 12,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
          ssl: {
            rejectUnauthorized: false,
          },
        });
      } else {
        global._postgresPool = new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          max: 12,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 15000,
          keepAlive: true,
          keepAliveInitialDelayMillis: 10000,
        });
      }

      global._postgresPool.on('error', (err: any) => {
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } else {
      const dataDir = resolvePgliteDataDir();
      if (!global._pgliteInstance) {
        global._pgliteInstance = new PGlite(dataDir);
        console.info(
          `[DB Init] Using embedded PostgreSQL (PGlite) at ${dataDir} (no external POSTGRES_URL/DATABASE_URL set).`
        );
      }
      global._postgresPool = new PGlitePoolAdapter(global._pgliteInstance);
    }
  }
  return global._postgresPool;
};

function getOrCreateDb(): NodePgDatabase<typeof schema> {
  if (!global._dbInstance) {
    const pool = createPool();
    const { hasExternalPg } = getExternalPgConfig();
    global._dbInstance = hasExternalPg
      ? drizzle(pool as Pool, { schema })
      : (drizzlePglite(global._pgliteInstance!, { schema }) as unknown as NodePgDatabase<typeof schema>);
  }
  return global._dbInstance;
}

const CORE_DDL_STATEMENTS: Array<{ sql: string; optional?: boolean; label: string }> = [
  // Enum types (idempotent)
  {
    label: 'enum transaction_type',
    sql: `DO $$ BEGIN CREATE TYPE "transaction_type" AS ENUM ('Income', 'Expense', 'Transfer', 'Debt Repayment'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum wallet_type',
    sql: `DO $$ BEGIN CREATE TYPE "wallet_type" AS ENUM ('Bank', 'Cash', 'Savings', 'Investment'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum wallet_type add Investment',
    optional: true,
    sql: `DO $$ BEGIN ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'Investment'; EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;`,
  },
  {
    label: 'enum account_type',
    sql: `DO $$ BEGIN CREATE TYPE "account_type" AS ENUM ('Bank', 'Cash', 'Savings', 'Credit'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum debt_type',
    sql: `DO $$ BEGIN CREATE TYPE "debt_type" AS ENUM ('Receivable', 'Payable'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum debt_status',
    sql: `DO $$ BEGIN CREATE TYPE "debt_status" AS ENUM ('Pending', 'Cleared'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum financial_context_status',
    sql: `DO $$ BEGIN CREATE TYPE "financial_context_status" AS ENUM ('Planned', 'Active', 'Completed'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },
  {
    label: 'enum financial_context_type',
    sql: `DO $$ BEGIN CREATE TYPE "financial_context_type" AS ENUM ('Trip', 'Work / Mission', 'Project', 'Life Event', 'Other'); EXCEPTION WHEN duplicate_object THEN null; END $$;`,
  },

  // Base core tables (safe IF NOT EXISTS)
  {
    label: 'table users',
    sql: `CREATE TABLE IF NOT EXISTS "users" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "uid" text NOT NULL UNIQUE,
      "username" text,
      "display_name" text,
      "email" text NOT NULL,
      "pending_email" text,
      "email_verified_at" timestamp,
      "password_hash" text,
      "password_updated_at" timestamp,
      "role" text NOT NULL DEFAULT 'member',
      "status" text NOT NULL DEFAULT 'active',
      "workspace_mode" text NOT NULL DEFAULT 'isolated',
      "experience_tier" text NOT NULL DEFAULT 'advanced',
      "onboarding_version" integer NOT NULL DEFAULT 1,
      "onboarding_started_at" timestamp,
      "onboarding_completed_at" timestamp,
      "onboarding_dismissed_at" timestamp,
      "onboarding_steps_json" text NOT NULL DEFAULT '[]',
      "locale" text NOT NULL DEFAULT 'en',
      "country_code" text NOT NULL DEFAULT 'MA',
      "timezone" text NOT NULL DEFAULT 'Africa/Casablanca',
      "deletion_requested_at" timestamp,
      "deleted_at" timestamp,
      "permissions" text,
      "avatar_color" text DEFAULT 'indigo',
      "notes" text,
      "last_login_at" timestamp,
      "created_by" uuid,
      "created_at" timestamp DEFAULT now(),
      "payday" integer DEFAULT 25,
      "emergency_buffer" numeric NOT NULL DEFAULT 0,
      "salary" numeric NOT NULL DEFAULT 0,
      "employment_type" text NOT NULL DEFAULT 'employee',
      "financial_cycle_mode" text NOT NULL DEFAULT 'payday_to_payday',
      "onboarding_starting_point" text NOT NULL DEFAULT 'mid_cycle',
      "period_start_date" text,
      "next_payday_date" text,
      "base_currency" text NOT NULL DEFAULT 'MAD',
      "automated_drive_backups" integer DEFAULT 0,
      "last_drive_backup_date" timestamp,
      "drive_backup_frequency" text DEFAULT 'weekly',
      "google_drive_token" text,
      "google_drive_token_expiry" timestamp,
      "notification_enabled" integer DEFAULT 0,
      "notification_time" text DEFAULT '09:00'
    )`,
  },
  // Ensure new user columns on pre-existing databases (each isolated so one never rolls back another)
  { label: 'users.automated_drive_backups', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "automated_drive_backups" integer DEFAULT 0` },
  { label: 'users.last_drive_backup_date', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_drive_backup_date" timestamp` },
  { label: 'users.drive_backup_frequency', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "drive_backup_frequency" text DEFAULT 'weekly'` },
  { label: 'users.google_drive_token', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_drive_token" text` },
  { label: 'users.google_drive_token_expiry', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_drive_token_expiry" timestamp` },
  { label: 'users.username', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text` },
  { label: 'users.display_name', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text` },
  { label: 'users.password_hash', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text` },
  { label: 'users.role', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'member'` },
  { label: 'users.status', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active'` },
  { label: 'users.workspace_mode', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace_mode" text NOT NULL DEFAULT 'isolated'` },
  { label: 'users.permissions', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text` },
  { label: 'users.avatar_color', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_color" text DEFAULT 'indigo'` },
  { label: 'users.notes', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notes" text` },
  { label: 'users.last_login_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp` },
  { label: 'users.created_by', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_by" uuid` },
  { label: 'users.pending_email', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pending_email" text` },
  { label: 'users.email_verified_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp` },
  { label: 'users.password_updated_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_updated_at" timestamp` },
  { label: 'users.experience_tier', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "experience_tier" text NOT NULL DEFAULT 'advanced'` },
  { label: 'users.onboarding_version', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_version" integer NOT NULL DEFAULT 1` },
  { label: 'users.onboarding_started_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_started_at" timestamp` },
  { label: 'users.onboarding_completed_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_completed_at" timestamp` },
  { label: 'users.onboarding_dismissed_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_dismissed_at" timestamp` },
  { label: 'users.onboarding_steps_json', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_steps_json" text NOT NULL DEFAULT '[]'` },
  { label: 'users.locale', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "locale" text NOT NULL DEFAULT 'en'` },
  { label: 'users.country_code', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "country_code" text NOT NULL DEFAULT 'MA'` },
  { label: 'users.timezone', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "timezone" text NOT NULL DEFAULT 'Africa/Casablanca'` },
  { label: 'users.deletion_requested_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp` },
  { label: 'users.deleted_at', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp` },
  { label: 'users.base_currency', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "base_currency" text NOT NULL DEFAULT 'MAD'` },
  { label: 'users.employment_type', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "employment_type" text NOT NULL DEFAULT 'employee'` },
  { label: 'users.financial_cycle_mode', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "financial_cycle_mode" text NOT NULL DEFAULT 'payday_to_payday'` },
  { label: 'users.onboarding_starting_point', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "onboarding_starting_point" text NOT NULL DEFAULT 'mid_cycle'` },
  { label: 'users.period_start_date', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "period_start_date" text` },
  { label: 'users.next_payday_date', sql: `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "next_payday_date" text` },

  // Grandfather existing verified-less active accounts into isolated mode
  {
    label: 'users backfill verified status',
    optional: true,
    sql: `UPDATE "users" SET "workspace_mode" = 'isolated', "email_verified_at" = COALESCE("email_verified_at", "created_at", now()), "experience_tier" = COALESCE(NULLIF("experience_tier", ''), 'advanced'), "onboarding_completed_at" = COALESCE("onboarding_completed_at", "created_at", now()) WHERE "status" = 'active' AND "email_verified_at" IS NULL`,
  },
  {
    label: 'users migrate shared mode to isolated',
    optional: true,
    sql: `UPDATE "users" SET "workspace_mode" = 'isolated' WHERE "workspace_mode" = 'shared'`,
  },

  {
    label: 'table wallets',
    sql: `CREATE TABLE IF NOT EXISTS "wallets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "name" text NOT NULL,
      "type" "wallet_type" NOT NULL,
      "account_subtype" text NOT NULL DEFAULT 'Checking',
      "institution_name" text,
      "account_reference" text,
      "currency" text NOT NULL DEFAULT 'MAD',
      "is_main" boolean NOT NULL DEFAULT false,
      "initial_balance" numeric NOT NULL DEFAULT 0,
      "current_balance" numeric NOT NULL DEFAULT 0,
      "credit_limit" numeric NOT NULL DEFAULT 0,
      "liability_balance" numeric NOT NULL DEFAULT 0,
      "statement_closing_day" integer,
      "payment_due_day" integer,
      "minimum_payment" numeric NOT NULL DEFAULT 0,
      "valuation_status" text NOT NULL DEFAULT 'verified',
      "last_reconciled_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx wallets_user_name_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_name_unique" ON "wallets"("user_id", "name")` },
  { label: 'wallets.account_subtype', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_subtype" text NOT NULL DEFAULT 'Checking'` },
  { label: 'wallets.institution_name', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "institution_name" text` },
  { label: 'wallets.account_reference', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_reference" text` },
  { label: 'wallets.currency', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD'` },
  { label: 'wallets.credit_limit', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "credit_limit" numeric NOT NULL DEFAULT 0` },
  { label: 'wallets.liability_balance', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "liability_balance" numeric NOT NULL DEFAULT 0` },
  { label: 'wallets.statement_closing_day', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "statement_closing_day" integer` },
  { label: 'wallets.payment_due_day', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "payment_due_day" integer` },
  { label: 'wallets.minimum_payment', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "minimum_payment" numeric NOT NULL DEFAULT 0` },
  { label: 'wallets.valuation_status', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "valuation_status" text NOT NULL DEFAULT 'verified'` },
  { label: 'wallets.last_reconciled_at', sql: `ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_reconciled_at" timestamp` },

  {
    label: 'table debts',
    sql: `CREATE TABLE IF NOT EXISTS "debts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "contact_name" text NOT NULL,
      "counterparty_type" text NOT NULL DEFAULT 'Person',
      "type" "debt_type" NOT NULL,
      "original_amount" numeric NOT NULL,
      "remaining_balance" numeric NOT NULL,
      "principal_balance" numeric NOT NULL DEFAULT 0,
      "accrued_interest" numeric NOT NULL DEFAULT 0,
      "fees_amount" numeric NOT NULL DEFAULT 0,
      "interest_rate_apr" numeric NOT NULL DEFAULT 0,
      "rate_type" text NOT NULL DEFAULT 'none',
      "installment_amount" numeric,
      "installment_frequency" text NOT NULL DEFAULT 'one_time',
      "currency" text NOT NULL DEFAULT 'MAD',
      "counterparty_id" uuid,
      "status" "debt_status" NOT NULL,
      "due_date" timestamp,
      "created_at" timestamp DEFAULT now()
    )`,
  },
  { label: 'debts.counterparty_type', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "counterparty_type" text NOT NULL DEFAULT 'Person'` },
  { label: 'debts.principal_balance', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "principal_balance" numeric NOT NULL DEFAULT 0` },
  { label: 'debts.accrued_interest', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "accrued_interest" numeric NOT NULL DEFAULT 0` },
  { label: 'debts.fees_amount', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "fees_amount" numeric NOT NULL DEFAULT 0` },
  { label: 'debts.interest_rate_apr', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "interest_rate_apr" numeric NOT NULL DEFAULT 0` },
  { label: 'debts.rate_type', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "rate_type" text NOT NULL DEFAULT 'none'` },
  { label: 'debts.installment_amount', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "installment_amount" numeric` },
  { label: 'debts.installment_frequency', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "installment_frequency" text NOT NULL DEFAULT 'one_time'` },
  { label: 'debts.currency', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD'` },
  { label: 'debts.counterparty_id', sql: `ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "counterparty_id" uuid` },

  {
    label: 'table payrolls',
    sql: `CREATE TABLE IF NOT EXISTS "payrolls" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "scheduled_for" timestamp NOT NULL,
      "amount" numeric NOT NULL,
      "status" text NOT NULL DEFAULT 'expected',
      "confirmed_amount" numeric,
      "confirmed_at" timestamp,
      "variance_amount" numeric NOT NULL DEFAULT 0,
      "variance_notes" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'payrolls.wallet_id', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL` },
  { label: 'payrolls.status', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'expected'` },
  { label: 'payrolls.confirmed_amount', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "confirmed_amount" numeric` },
  { label: 'payrolls.confirmed_at', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp` },
  { label: 'payrolls.variance_amount', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "variance_amount" numeric NOT NULL DEFAULT 0` },
  { label: 'payrolls.variance_notes', sql: `ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "variance_notes" text` },

  {
    label: 'table financial_contexts',
    sql: `CREATE TABLE IF NOT EXISTS "financial_contexts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "name" text NOT NULL,
      "type" text NOT NULL,
      "start_date" timestamp,
      "end_date" timestamp,
      "budget" numeric,
      "status" text NOT NULL DEFAULT 'Planned',
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },

  {
    label: 'table transactions',
    sql: `CREATE TABLE IF NOT EXISTS "transactions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "wallet_id" uuid REFERENCES "wallets"("id"),
      "destination_wallet_id" uuid REFERENCES "wallets"("id"),
      "source_wallet" text,
      "created_at" timestamp DEFAULT now(),
      "amount" numeric NOT NULL,
      "native_amount" numeric,
      "currency" text NOT NULL DEFAULT 'MAD',
      "exchange_rate_used" numeric NOT NULL DEFAULT 1,
      "fx_source" text NOT NULL DEFAULT 'locked_at_posting',
      "idempotency_key" text,
      "counterparty_id" uuid,
      "type" "transaction_type" NOT NULL,
      "category" text,
      "notes" text,
      "payroll_id" uuid REFERENCES "payrolls"("id"),
      "context_id" uuid REFERENCES "financial_contexts"("id")
    )`,
  },
  { label: 'transactions.wallet_id', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "wallet_id" uuid REFERENCES "wallets"("id")` },
  { label: 'transactions.destination_wallet_id', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "destination_wallet_id" uuid REFERENCES "wallets"("id")` },
  { label: 'transactions.payroll_id', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payroll_id" uuid REFERENCES "payrolls"("id")` },
  { label: 'transactions.context_id', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "context_id" uuid REFERENCES "financial_contexts"("id")` },
  { label: 'transactions.native_amount', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "native_amount" numeric` },
  { label: 'transactions.currency', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD'` },
  { label: 'transactions.exchange_rate_used', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "exchange_rate_used" numeric NOT NULL DEFAULT 1` },
  { label: 'transactions.fx_source', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fx_source" text NOT NULL DEFAULT 'locked_at_posting'` },
  { label: 'transactions.idempotency_key', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text` },
  { label: 'transactions.counterparty_id', sql: `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "counterparty_id" uuid` },

  {
    label: 'table splits',
    sql: `CREATE TABLE IF NOT EXISTS "splits" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "transaction_id" uuid NOT NULL REFERENCES "transactions"("id"),
      "reimbursable_amount" numeric NOT NULL,
      "linked_contact_id" uuid REFERENCES "debts"("id")
    )`,
  },

  {
    label: 'table goals',
    sql: `CREATE TABLE IF NOT EXISTS "goals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "name" text NOT NULL,
      "target_amount" numeric NOT NULL,
      "current_amount" numeric NOT NULL DEFAULT 0,
      "auto_sync_balance" boolean NOT NULL DEFAULT false,
      "funding_cadence" text NOT NULL DEFAULT 'monthly',
      "planned_contribution_amount" numeric NOT NULL DEFAULT 0,
      "deadline" timestamp,
      "category" text NOT NULL DEFAULT '',
      "notes" text NOT NULL DEFAULT '',
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'goals.funding_cadence', sql: `ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "funding_cadence" text NOT NULL DEFAULT 'monthly'` },
  { label: 'goals.planned_contribution_amount', sql: `ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "planned_contribution_amount" numeric NOT NULL DEFAULT 0` },

  {
    label: 'table category_budgets',
    sql: `CREATE TABLE IF NOT EXISTS "category_budgets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "category" text NOT NULL,
      "year" integer NOT NULL,
      "month" integer NOT NULL,
      "amount" numeric NOT NULL,
      "rollover_enabled" boolean NOT NULL DEFAULT false,
      "rollover_amount" numeric NOT NULL DEFAULT 0,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'category_budgets.rollover_enabled', sql: `ALTER TABLE "category_budgets" ADD COLUMN IF NOT EXISTS "rollover_enabled" boolean NOT NULL DEFAULT false` },
  { label: 'category_budgets.rollover_amount', sql: `ALTER TABLE "category_budgets" ADD COLUMN IF NOT EXISTS "rollover_amount" numeric NOT NULL DEFAULT 0` },
  {
    label: 'idx category_budgets_user_category_month_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "category_budgets_user_category_month_unique" ON "category_budgets"("user_id", "category", "year", "month")`,
  },

  // Notification tables
  {
    label: 'table notification_devices',
    sql: `CREATE TABLE IF NOT EXISTS "notification_devices" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "token" text NOT NULL UNIQUE,
      "enabled" boolean NOT NULL DEFAULT true,
      "time" text NOT NULL DEFAULT '09:00',
      "timezone" text NOT NULL,
      "last_sent_on" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table push_subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS "push_subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "endpoint" text NOT NULL UNIQUE,
      "p256dh" text NOT NULL,
      "auth" text NOT NULL,
      "user_agent" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table notification_preferences',
    sql: `CREATE TABLE IF NOT EXISTS "notification_preferences" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id"),
      "enabled" boolean NOT NULL DEFAULT false,
      "daily_insight_enabled" boolean NOT NULL DEFAULT true,
      "budget_warning_enabled" boolean NOT NULL DEFAULT true,
      "forecast_warning_enabled" boolean NOT NULL DEFAULT true,
      "debt_reminder_enabled" boolean NOT NULL DEFAULT true,
      "anomaly_enabled" boolean NOT NULL DEFAULT true,
      "goal_enabled" boolean NOT NULL DEFAULT true,
      "delivery_time" text NOT NULL DEFAULT '09:00',
      "timezone" text NOT NULL DEFAULT 'Africa/Casablanca',
      "quiet_hours_start" text NOT NULL DEFAULT '22:00',
      "quiet_hours_end" text NOT NULL DEFAULT '07:00'
    )`,
  },
  {
    label: 'table notification_deliveries',
    sql: `CREATE TABLE IF NOT EXISTS "notification_deliveries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "type" text NOT NULL,
      "scheduled_for" text NOT NULL,
      "delivered_at" timestamp NOT NULL DEFAULT now(),
      "status" text NOT NULL DEFAULT 'sent',
      "metadata" text
    )`,
  },
  {
    label: 'idx notification_deliveries_user_type_scheduled_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "notification_deliveries_user_type_scheduled_unique" ON "notification_deliveries"("user_id", "type", "scheduled_for")`,
  },

  // Subscriptions & Investments
  {
    label: 'table subscriptions',
    sql: `CREATE TABLE IF NOT EXISTS "subscriptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "amount" numeric NOT NULL,
      "currency" text NOT NULL DEFAULT 'MAD',
      "billing_cycle" text NOT NULL DEFAULT 'monthly',
      "category" text NOT NULL DEFAULT 'Subscriptions & Streaming',
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "next_billing_date" timestamp,
      "status" text NOT NULL DEFAULT 'active',
      "notes" text,
      "icon" text DEFAULT '📱',
      "website_url" text,
      "counterparty_id" uuid,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx subscriptions_user_id_idx', sql: `CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id")` },
  { label: 'subscriptions.counterparty_id', sql: `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "counterparty_id" uuid` },

  {
    label: 'table stock_positions',
    sql: `CREATE TABLE IF NOT EXISTS "stock_positions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "ticker" text NOT NULL,
      "company_name" text NOT NULL,
      "market" text NOT NULL DEFAULT 'US',
      "sector" text NOT NULL DEFAULT 'Technology',
      "instrument_type" text DEFAULT 'Common Stock',
      "raw_held_ticker" text,
      "underlying_ticker" text,
      "exchange" text DEFAULT 'NYSE / NASDAQ',
      "country" text DEFAULT 'United States',
      "shares" numeric NOT NULL DEFAULT 0,
      "avg_cost_per_share" numeric NOT NULL DEFAULT 0,
      "current_price" numeric NOT NULL DEFAULT 0,
      "currency" text NOT NULL DEFAULT 'USD',
      "annual_dividend_per_share" numeric NOT NULL DEFAULT 0,
      "target_weight_percent" numeric NOT NULL DEFAULT 0,
      "target_price" numeric,
      "alert_above" numeric,
      "alert_below" numeric,
      "conviction_thesis" text,
      "is_watchlist_only" boolean NOT NULL DEFAULT false,
      "data_source" text DEFAULT 'manual',
      "price_updated_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx stock_positions_user_id_idx', sql: `CREATE INDEX IF NOT EXISTS "stock_positions_user_id_idx" ON "stock_positions"("user_id")` },
  { label: 'stock_positions.instrument_type', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "instrument_type" text DEFAULT 'Common Stock'` },
  { label: 'stock_positions.raw_held_ticker', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "raw_held_ticker" text` },
  { label: 'stock_positions.underlying_ticker', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "underlying_ticker" text` },
  { label: 'stock_positions.exchange', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "exchange" text DEFAULT 'NYSE / NASDAQ'` },
  { label: 'stock_positions.country', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'United States'` },
  { label: 'stock_positions.target_price', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "target_price" numeric` },
  { label: 'stock_positions.alert_above', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "alert_above" numeric` },
  { label: 'stock_positions.alert_below', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "alert_below" numeric` },
  { label: 'stock_positions.data_source', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "data_source" text DEFAULT 'manual'` },
  { label: 'stock_positions.price_updated_at', sql: `ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "price_updated_at" timestamp` },

  {
    label: 'table stock_orders',
    sql: `CREATE TABLE IF NOT EXISTS "stock_orders" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "position_id" uuid NOT NULL REFERENCES "stock_positions"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "action" text NOT NULL,
      "shares" numeric NOT NULL DEFAULT 0,
      "price_per_share" numeric NOT NULL DEFAULT 0,
      "total_native_amount" numeric NOT NULL DEFAULT 0,
      "total_mad_amount" numeric NOT NULL DEFAULT 0,
      "exchange_rate_used" numeric NOT NULL DEFAULT 1,
      "fee_native" numeric DEFAULT 0,
      "tax_native" numeric DEFAULT 0,
      "split_ratio" numeric DEFAULT 1,
      "account_source" text DEFAULT 'manual',
      "realized_pnl_mad" numeric NOT NULL DEFAULT 0,
      "notes" text,
      "executed_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx stock_orders_user_id_idx', sql: `CREATE INDEX IF NOT EXISTS "stock_orders_user_id_idx" ON "stock_orders"("user_id")` },
  { label: 'idx stock_orders_position_id_idx', sql: `CREATE INDEX IF NOT EXISTS "stock_orders_position_id_idx" ON "stock_orders"("position_id")` },
  { label: 'stock_orders.fee_native', sql: `ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "fee_native" numeric DEFAULT 0` },
  { label: 'stock_orders.tax_native', sql: `ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "tax_native" numeric DEFAULT 0` },
  { label: 'stock_orders.split_ratio', sql: `ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "split_ratio" numeric DEFAULT 1` },
  { label: 'stock_orders.account_source', sql: `ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "account_source" text DEFAULT 'manual'` },

  {
    label: 'table market_data_symbols',
    sql: `CREATE TABLE IF NOT EXISTS "market_data_symbols" (
      "symbol" text PRIMARY KEY,
      "raw_held_symbol" text,
      "underlying_symbol" text,
      "display_name" text NOT NULL,
      "instrument_type" text NOT NULL DEFAULT 'Common Stock',
      "exchange" text NOT NULL DEFAULT 'NASDAQ',
      "mic_code" text,
      "country" text NOT NULL DEFAULT 'United States',
      "sector" text NOT NULL DEFAULT 'Technology & Cloud',
      "industry" text,
      "currency" text NOT NULL DEFAULT 'USD',
      "provider" text NOT NULL DEFAULT 'cached_eod',
      "is_active" boolean NOT NULL DEFAULT true,
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table market_data_daily_bars',
    sql: `CREATE TABLE IF NOT EXISTS "market_data_daily_bars" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "symbol" text NOT NULL,
      "bar_date" text NOT NULL,
      "open" numeric NOT NULL,
      "high" numeric NOT NULL,
      "low" numeric NOT NULL,
      "close" numeric NOT NULL,
      "volume" numeric NOT NULL DEFAULT 0,
      "currency" text NOT NULL DEFAULT 'USD',
      "provider" text NOT NULL DEFAULT 'cached_eod',
      "is_adjusted" boolean NOT NULL DEFAULT true,
      "fetched_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx market_data_daily_bars_symbol_date_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS "market_data_daily_bars_symbol_date_unique" ON "market_data_daily_bars"("symbol", "bar_date")` },
  {
    label: 'table market_data_usage',
    sql: `CREATE TABLE IF NOT EXISTS "market_data_usage" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "utc_date" text NOT NULL,
      "utc_minute" text NOT NULL,
      "provider" text NOT NULL DEFAULT 'twelve_data',
      "endpoint" text NOT NULL,
      "credit_weight" integer NOT NULL DEFAULT 1,
      "symbols_count" integer NOT NULL DEFAULT 1,
      "credits_reserved" integer NOT NULL DEFAULT 1,
      "credits_used_header" integer,
      "credits_left_header" integer,
      "status" text NOT NULL DEFAULT 'reserved',
      "request_id" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table portfolio_daily_snapshots',
    sql: `CREATE TABLE IF NOT EXISTS "portfolio_daily_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "snapshot_date" text NOT NULL,
      "base_currency" text NOT NULL DEFAULT 'MAD',
      "total_market_value_mad" numeric NOT NULL DEFAULT 0,
      "investment_cash_mad" numeric NOT NULL DEFAULT 0,
      "net_contributions_mad" numeric NOT NULL DEFAULT 0,
      "cost_basis_mad" numeric NOT NULL DEFAULT 0,
      "unrealized_pnl_mad" numeric NOT NULL DEFAULT 0,
      "realized_pnl_mad" numeric NOT NULL DEFAULT 0,
      "dividends_received_mad" numeric NOT NULL DEFAULT 0,
      "usd_to_mad_rate" numeric NOT NULL DEFAULT 9.95,
      "is_estimated" boolean NOT NULL DEFAULT false,
      "positions_json" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx portfolio_daily_snapshots_user_date_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_daily_snapshots_user_date_unique" ON "portfolio_daily_snapshots"("user_id", "snapshot_date")` },
  {
    label: 'table investment_dividend_events',
    sql: `CREATE TABLE IF NOT EXISTS "investment_dividend_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "position_id" uuid REFERENCES "stock_positions"("id") ON DELETE SET NULL,
      "ticker" text NOT NULL,
      "company_name" text NOT NULL,
      "declaration_date" text,
      "ex_dividend_date" text,
      "record_date" text,
      "payment_date" text NOT NULL,
      "dividend_per_share" numeric NOT NULL DEFAULT 0,
      "eligible_shares" numeric NOT NULL DEFAULT 0,
      "currency" text NOT NULL DEFAULT 'USD',
      "gross_amount" numeric NOT NULL DEFAULT 0,
      "withholding_tax" numeric NOT NULL DEFAULT 0,
      "fee_amount" numeric NOT NULL DEFAULT 0,
      "net_amount" numeric NOT NULL DEFAULT 0,
      "net_amount_mad" numeric NOT NULL DEFAULT 0,
      "fx_rate_used" numeric NOT NULL DEFAULT 9.95,
      "status" text NOT NULL DEFAULT 'confirmed',
      "source" text NOT NULL DEFAULT 'manual',
      "notes" text,
      "verified_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx investment_dividend_events_user_id_idx', sql: `CREATE INDEX IF NOT EXISTS "investment_dividend_events_user_id_idx" ON "investment_dividend_events"("user_id")` },
  {
    label: 'table investment_settings',
    sql: `CREATE TABLE IF NOT EXISTS "investment_settings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "reporting_currency" text NOT NULL DEFAULT 'MAD',
      "selected_benchmarks" text NOT NULL DEFAULT '["SPY","QQQ","MASI"]',
      "risk_free_rate_percent" numeric NOT NULL DEFAULT 3.5,
      "manual_usd_mad_rate" numeric,
      "twelve_data_display_approved" boolean NOT NULL DEFAULT false,
      "target_allocations_json" text,
      "goals_json" text,
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },

  // Security, Auth Sessions, Invitations, Templates, Email Outbox
  {
    label: 'table user_audit_logs',
    sql: `CREATE TABLE IF NOT EXISTS "user_audit_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "actor_name" text NOT NULL,
      "target_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "target_user_name" text NOT NULL,
      "action" text NOT NULL,
      "details" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx user_audit_logs_created_at_idx', sql: `CREATE INDEX IF NOT EXISTS "user_audit_logs_created_at_idx" ON "user_audit_logs"("created_at" DESC)` },
  {
    label: 'table auth_sessions',
    sql: `CREATE TABLE IF NOT EXISTS "auth_sessions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "refresh_token_hash" text NOT NULL UNIQUE,
      "family_id" uuid NOT NULL,
      "device_label" text NOT NULL DEFAULT 'Web Browser',
      "user_agent" text,
      "ip_address" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "last_used_at" timestamp NOT NULL DEFAULT now(),
      "expires_at" timestamp NOT NULL,
      "revoked_at" timestamp,
      "replaced_by_session_id" uuid
    )`,
  },
  { label: 'idx auth_sessions_user_expires_idx', sql: `CREATE INDEX IF NOT EXISTS "auth_sessions_user_expires_idx" ON "auth_sessions"("user_id", "expires_at")` },
  { label: 'idx auth_sessions_family_idx', sql: `CREATE INDEX IF NOT EXISTS "auth_sessions_family_idx" ON "auth_sessions"("family_id")` },
  {
    label: 'table email_verification_tokens',
    sql: `CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "target_email" text NOT NULL,
      "token_hash" text NOT NULL UNIQUE,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp
    )`,
  },
  { label: 'idx email_verification_tokens_user_expires_idx', sql: `CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_expires_idx" ON "email_verification_tokens"("user_id", "expires_at")` },
  {
    label: 'table password_reset_tokens',
    sql: `CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "token_hash" text NOT NULL UNIQUE,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "expires_at" timestamp NOT NULL,
      "used_at" timestamp
    )`,
  },
  { label: 'idx password_reset_tokens_user_expires_idx', sql: `CREATE INDEX IF NOT EXISTS "password_reset_tokens_user_expires_idx" ON "password_reset_tokens"("user_id", "expires_at")` },
  {
    label: 'table account_security_events',
    sql: `CREATE TABLE IF NOT EXISTS "account_security_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "event_type" text NOT NULL,
      "outcome" text NOT NULL DEFAULT 'success',
      "ip_address" text,
      "device_summary" text,
      "metadata_json" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx account_security_events_user_created_idx', sql: `CREATE INDEX IF NOT EXISTS "account_security_events_user_created_idx" ON "account_security_events"("user_id", "created_at" DESC)` },
  {
    label: 'table invitations',
    sql: `CREATE TABLE IF NOT EXISTS "invitations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "token_hash" text NOT NULL UNIQUE,
      "created_by_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "campaign" text NOT NULL DEFAULT 'beta_invite',
      "expires_at" timestamp,
      "max_uses" integer NOT NULL DEFAULT 1,
      "use_count" integer NOT NULL DEFAULT 0,
      "revoked_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table invitation_redemptions',
    sql: `CREATE TABLE IF NOT EXISTS "invitation_redemptions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "invitation_id" uuid NOT NULL REFERENCES "invitations"("id") ON DELETE CASCADE,
      "redeemed_by_user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "redeemed_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table template_applications',
    sql: `CREATE TABLE IF NOT EXISTS "template_applications" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "template_id" text NOT NULL,
      "template_version" integer NOT NULL DEFAULT 1,
      "created_resource_ids_json" text NOT NULL DEFAULT '[]',
      "applied_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx template_applications_user_template_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS "template_applications_user_template_unique" ON "template_applications"("user_id", "template_id")` },
  {
    label: 'table email_outbox',
    sql: `CREATE TABLE IF NOT EXISTS "email_outbox" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
      "recipient_email" text NOT NULL,
      "template_name" text NOT NULL,
      "subject" text NOT NULL,
      "payload_json" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "sent_at" timestamp
    )`,
  },

  // Unique user email/username partial indexes (optional on legacy duplicates)
  {
    label: 'idx users_email_lower_active_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "users_email_lower_active_unique" ON "users"(LOWER("email")) WHERE "status" NOT IN ('legacy_hidden', 'deleted')`,
  },
  {
    label: 'idx users_username_lower_active_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "users_username_lower_active_unique" ON "users"(LOWER("username")) WHERE "username" IS NOT NULL AND "status" NOT IN ('legacy_hidden', 'deleted')`,
  },

  // Tenant defense-in-depth unique indexes
  { label: 'idx wallets_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "wallets_user_id_id_unique" ON "wallets"("user_id", "id")` },
  { label: 'idx debts_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "debts_user_id_id_unique" ON "debts"("user_id", "id")` },
  { label: 'idx payrolls_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "payrolls_user_id_id_unique" ON "payrolls"("user_id", "id")` },
  { label: 'idx financial_contexts_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "financial_contexts_user_id_id_unique" ON "financial_contexts"("user_id", "id")` },
  { label: 'idx goals_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "goals_user_id_id_unique" ON "goals"("user_id", "id")` },
  { label: 'idx transactions_user_id_id_unique', optional: true, sql: `CREATE UNIQUE INDEX IF NOT EXISTS "transactions_user_id_id_unique" ON "transactions"("user_id", "id")` },

  // Core Audit & Outbox tables
  {
    label: 'table journal_entries',
    sql: `CREATE TABLE IF NOT EXISTS "journal_entries" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "entry_type" text NOT NULL DEFAULT 'standard',
      "status" text NOT NULL DEFAULT 'posted',
      "reversal_of_entry_id" uuid,
      "currency" text NOT NULL DEFAULT 'MAD',
      "exchange_rate_used" numeric NOT NULL DEFAULT 1,
      "is_estimated_backfill" boolean NOT NULL DEFAULT false,
      "idempotency_key" text,
      "memo" text,
      "posted_at" timestamp NOT NULL DEFAULT now(),
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx journal_entries_user_id_idx', sql: `CREATE INDEX IF NOT EXISTS "journal_entries_user_id_idx" ON "journal_entries"("user_id")` },
  { label: 'idx journal_entries_tx_id_idx', sql: `CREATE INDEX IF NOT EXISTS "journal_entries_tx_id_idx" ON "journal_entries"("transaction_id")` },
  {
    label: 'table journal_lines',
    sql: `CREATE TABLE IF NOT EXISTS "journal_lines" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "journal_entry_id" uuid NOT NULL REFERENCES "journal_entries"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "account_code" text NOT NULL,
      "account_name" text NOT NULL,
      "account_class" text NOT NULL,
      "debit_mad" numeric NOT NULL DEFAULT 0,
      "credit_mad" numeric NOT NULL DEFAULT 0,
      "native_amount" numeric NOT NULL DEFAULT 0,
      "native_currency" text NOT NULL DEFAULT 'MAD',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx journal_lines_entry_id_idx', sql: `CREATE INDEX IF NOT EXISTS "journal_lines_entry_id_idx" ON "journal_lines"("journal_entry_id")` },
  {
    label: 'table exchange_rates',
    sql: `CREATE TABLE IF NOT EXISTS "exchange_rates" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
      "base_currency" text NOT NULL,
      "quote_currency" text NOT NULL DEFAULT 'MAD',
      "rate" numeric NOT NULL,
      "source" text NOT NULL DEFAULT 'reference_feed',
      "effective_date" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table statement_import_batches',
    sql: `CREATE TABLE IF NOT EXISTS "statement_import_batches" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
      "file_name" text NOT NULL,
      "file_format" text NOT NULL DEFAULT 'CSV',
      "statement_opening_balance" numeric,
      "statement_closing_balance" numeric,
      "reconciled_variance" numeric NOT NULL DEFAULT 0,
      "total_rows" integer NOT NULL DEFAULT 0,
      "matched_count" integer NOT NULL DEFAULT 0,
      "unmatched_count" integer NOT NULL DEFAULT 0,
      "ambiguous_count" integer NOT NULL DEFAULT 0,
      "duplicate_count" integer NOT NULL DEFAULT 0,
      "status" text NOT NULL DEFAULT 'pending_review',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table statement_import_rows',
    sql: `CREATE TABLE IF NOT EXISTS "statement_import_rows" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "batch_id" uuid NOT NULL REFERENCES "statement_import_batches"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
      "row_date" text NOT NULL,
      "description" text NOT NULL,
      "amount" numeric NOT NULL,
      "currency" text NOT NULL DEFAULT 'MAD',
      "external_reference" text,
      "row_hash" text NOT NULL,
      "match_status" text NOT NULL DEFAULT 'unmatched',
      "match_confidence" numeric NOT NULL DEFAULT 0,
      "suggested_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "counterparty_id" uuid,
      "candidate_transaction_ids_json" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'statement_import_rows.counterparty_id', sql: `ALTER TABLE "statement_import_rows" ADD COLUMN IF NOT EXISTS "counterparty_id" uuid` },
  {
    label: 'table financial_review_items',
    sql: `CREATE TABLE IF NOT EXISTS "financial_review_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "source_type" text NOT NULL,
      "status" text NOT NULL DEFAULT 'Needs Review',
      "confidence_score" numeric NOT NULL DEFAULT 0.8,
      "parsed_amount" numeric NOT NULL,
      "parsed_currency" text NOT NULL DEFAULT 'MAD',
      "parsed_date" text NOT NULL,
      "parsed_description" text NOT NULL,
      "parsed_category" text,
      "parsed_type" text NOT NULL DEFAULT 'Expense',
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "counterparty_id" uuid,
      "raw_payload_json" text,
      "decision_notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'financial_review_items.counterparty_id', sql: `ALTER TABLE "financial_review_items" ADD COLUMN IF NOT EXISTS "counterparty_id" uuid` },
  {
    label: 'table commitment_occurrences',
    sql: `CREATE TABLE IF NOT EXISTS "commitment_occurrences" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "source_type" text NOT NULL,
      "source_id" text NOT NULL,
      "title" text NOT NULL,
      "expected_date" text NOT NULL,
      "expected_amount" numeric NOT NULL,
      "currency" text NOT NULL DEFAULT 'MAD',
      "status" text NOT NULL DEFAULT 'scheduled',
      "is_non_cash_event" boolean NOT NULL DEFAULT false,
      "paid_amount" numeric NOT NULL DEFAULT 0,
      "principal_component" numeric NOT NULL DEFAULT 0,
      "interest_component" numeric NOT NULL DEFAULT 0,
      "fee_component" numeric NOT NULL DEFAULT 0,
      "installment_number" integer,
      "actual_date" text,
      "actual_amount" numeric,
      "variance_amount" numeric NOT NULL DEFAULT 0,
      "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "history_json" text,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'commitment_occurrences.is_non_cash_event', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "is_non_cash_event" boolean NOT NULL DEFAULT false` },
  { label: 'commitment_occurrences.paid_amount', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "paid_amount" numeric NOT NULL DEFAULT 0` },
  { label: 'commitment_occurrences.principal_component', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "principal_component" numeric NOT NULL DEFAULT 0` },
  { label: 'commitment_occurrences.interest_component', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "interest_component" numeric NOT NULL DEFAULT 0` },
  { label: 'commitment_occurrences.fee_component', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "fee_component" numeric NOT NULL DEFAULT 0` },
  { label: 'commitment_occurrences.installment_number', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "installment_number" integer` },
  { label: 'commitment_occurrences.history_json', sql: `ALTER TABLE "commitment_occurrences" ADD COLUMN IF NOT EXISTS "history_json" text` },
  {
    label: 'idx transactions_user_idempotency_key_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "transactions_user_idempotency_key_unique" ON "transactions"("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
  },
  {
    label: 'idx journal_entries_user_idempotency_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "journal_entries_user_idempotency_unique" ON "journal_entries"("user_id", "idempotency_key") WHERE "idempotency_key" IS NOT NULL`,
  },
  {
    label: 'idx commitment_occurrences_user_source_date_unique',
    optional: true,
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "commitment_occurrences_user_source_date_unique" ON "commitment_occurrences"("user_id", "source_type", "source_id", "expected_date")`,
  },
  {
    label: 'table goal_contribution_events',
    sql: `CREATE TABLE IF NOT EXISTS "goal_contribution_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "goal_id" uuid NOT NULL REFERENCES "goals"("id") ON DELETE CASCADE,
      "transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "source_wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "destination_wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "event_type" text NOT NULL DEFAULT 'contribution',
      "amount" numeric NOT NULL,
      "event_date" text NOT NULL,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table saved_scenarios',
    sql: `CREATE TABLE IF NOT EXISTS "saved_scenarios" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "description" text,
      "baseline_snapshot_json" text NOT NULL,
      "events_json" text NOT NULL,
      "assumptions_json" text NOT NULL,
      "projected_summary_json" text NOT NULL,
      "is_approved_plan" boolean NOT NULL DEFAULT false,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table financial_rules',
    sql: `CREATE TABLE IF NOT EXISTS "financial_rules" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "enabled" boolean NOT NULL DEFAULT true,
      "trigger_type" text NOT NULL,
      "conditions_json" text NOT NULL,
      "action_type" text NOT NULL,
      "action_payload_json" text NOT NULL,
      "approval_policy" text NOT NULL DEFAULT 'notify_only',
      "version" integer NOT NULL DEFAULT 1,
      "last_triggered_at" timestamp,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table financial_rule_logs',
    sql: `CREATE TABLE IF NOT EXISTS "financial_rule_logs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "rule_id" uuid NOT NULL REFERENCES "financial_rules"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "rule_version" integer NOT NULL DEFAULT 1,
      "trigger_event_summary" text NOT NULL,
      "proposed_result_summary" text NOT NULL,
      "outcome_status" text NOT NULL DEFAULT 'executed',
      "idempotency_key" text NOT NULL,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table external_wealth_items',
    sql: `CREATE TABLE IF NOT EXISTS "external_wealth_items" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "item_class" text NOT NULL,
      "is_liability" boolean NOT NULL DEFAULT false,
      "is_liquid" boolean NOT NULL DEFAULT false,
      "estimated_value" numeric NOT NULL,
      "currency" text NOT NULL DEFAULT 'MAD',
      "valuation_date" text NOT NULL,
      "valuation_source" text NOT NULL DEFAULT 'manual_estimate',
      "confidence_level" text NOT NULL DEFAULT 'medium',
      "is_externally_verified" boolean NOT NULL DEFAULT false,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table domain_event_outbox',
    sql: `CREATE TABLE IF NOT EXISTS "domain_event_outbox" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "event_type" text NOT NULL,
      "aggregate_id" text NOT NULL,
      "payload_json" text NOT NULL,
      "status" text NOT NULL DEFAULT 'pending',
      "attempts" integer NOT NULL DEFAULT 0,
      "last_error" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "processed_at" timestamp
    )`,
  },
  { label: 'idx domain_event_outbox_status_idx', sql: `CREATE INDEX IF NOT EXISTS "domain_event_outbox_status_idx" ON "domain_event_outbox"("status", "created_at")` },
  {
    label: 'table financial_position_snapshots',
    sql: `CREATE TABLE IF NOT EXISTS "financial_position_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "snapshot_date" text NOT NULL,
      "reporting_currency" text NOT NULL DEFAULT 'MAD',
      "bank_balance_mad" numeric NOT NULL DEFAULT 0,
      "cash_balance_mad" numeric NOT NULL DEFAULT 0,
      "savings_balance_mad" numeric NOT NULL DEFAULT 0,
      "investment_cash_mad" numeric NOT NULL DEFAULT 0,
      "credit_card_liability_mad" numeric NOT NULL DEFAULT 0,
      "overdraft_liability_mad" numeric NOT NULL DEFAULT 0,
      "receivables_mad" numeric NOT NULL DEFAULT 0,
      "payables_mad" numeric NOT NULL DEFAULT 0,
      "investment_market_value_mad" numeric NOT NULL DEFAULT 0,
      "external_assets_mad" numeric NOT NULL DEFAULT 0,
      "external_liabilities_mad" numeric NOT NULL DEFAULT 0,
      "total_net_worth_mad" numeric NOT NULL DEFAULT 0,
      "liquid_net_worth_mad" numeric NOT NULL DEFAULT 0,
      "fx_rates_json" text NOT NULL,
      "components_json" text NOT NULL,
      "data_source" text NOT NULL DEFAULT 'computed',
      "confidence_level" text NOT NULL DEFAULT 'high',
      "is_estimated" boolean NOT NULL DEFAULT false,
      "trigger_source" text NOT NULL DEFAULT 'manual',
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'idx financial_position_snapshots_user_date_unique',
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS "financial_position_snapshots_user_date_unique" ON "financial_position_snapshots"("user_id", "snapshot_date")`,
  },
  {
    label: 'table external_wealth_valuations',
    sql: `CREATE TABLE IF NOT EXISTS "external_wealth_valuations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "item_id" uuid NOT NULL REFERENCES "external_wealth_items"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "estimated_value" numeric NOT NULL,
      "currency" text NOT NULL DEFAULT 'MAD',
      "fx_rate_used" numeric NOT NULL DEFAULT 1,
      "fx_source" text NOT NULL DEFAULT 'reference_feed',
      "value_mad" numeric NOT NULL,
      "valuation_date" text NOT NULL,
      "valuation_source" text NOT NULL DEFAULT 'manual_estimate',
      "confidence_level" text NOT NULL DEFAULT 'medium',
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  {
    label: 'table counterparties',
    sql: `CREATE TABLE IF NOT EXISTS "counterparties" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "canonical_name" text NOT NULL,
      "normalized_name" text NOT NULL,
      "counterparty_type" text NOT NULL DEFAULT 'merchant',
      "aliases_json" text NOT NULL DEFAULT '[]',
      "default_category" text,
      "website" text,
      "logo_url" text,
      "contact_details" text,
      "notes" text,
      "created_at" timestamp NOT NULL DEFAULT now(),
      "updated_at" timestamp NOT NULL DEFAULT now()
    )`,
  },
  { label: 'idx counterparties_user_normalized_unique', sql: `CREATE UNIQUE INDEX IF NOT EXISTS "counterparties_user_normalized_unique" ON "counterparties"("user_id", "normalized_name")` },

  // Performance & Scalability Composite B-Tree Indexes
  { label: 'idx wallets_user_id_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "wallets_user_id_idx" ON "wallets"("user_id")` },
  { label: 'idx transactions_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_user_created_idx" ON "transactions"("user_id", "created_at" DESC)` },
  { label: 'idx transactions_user_wallet_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_user_wallet_idx" ON "transactions"("user_id", "wallet_id")` },
  { label: 'idx transactions_user_category_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_user_category_idx" ON "transactions"("user_id", "category")` },
  { label: 'idx transactions_user_context_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_user_context_idx" ON "transactions"("user_id", "context_id")` },
  { label: 'idx transactions_payroll_id_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_payroll_id_idx" ON "transactions"("payroll_id")` },
  { label: 'idx splits_transaction_id_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "splits_transaction_id_idx" ON "splits"("transaction_id")` },
  { label: 'idx splits_linked_contact_id_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "splits_linked_contact_id_idx" ON "splits"("linked_contact_id")` },
  { label: 'idx debts_user_status_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "debts_user_status_idx" ON "debts"("user_id", "status")` },
  { label: 'idx debts_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "debts_user_created_idx" ON "debts"("user_id", "created_at" DESC)` },
  { label: 'idx payrolls_user_scheduled_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "payrolls_user_scheduled_idx" ON "payrolls"("user_id", "scheduled_for" DESC)` },
  { label: 'idx financial_contexts_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "financial_contexts_user_created_idx" ON "financial_contexts"("user_id", "created_at" DESC)` },
  { label: 'idx goals_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "goals_user_created_idx" ON "goals"("user_id", "created_at" DESC)` },
  { label: 'idx category_budgets_user_year_month_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "category_budgets_user_year_month_idx" ON "category_budgets"("user_id", "year", "month")` },
  { label: 'idx stock_orders_linked_tx_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "stock_orders_linked_tx_idx" ON "stock_orders"("linked_transaction_id")` },
  { label: 'idx journal_lines_user_id_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "journal_lines_user_id_idx" ON "journal_lines"("user_id")` },
  { label: 'idx journal_lines_user_wallet_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "journal_lines_user_wallet_idx" ON "journal_lines"("user_id", "wallet_id")` },
  { label: 'idx journal_entries_user_posted_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "journal_entries_user_posted_idx" ON "journal_entries"("user_id", "posted_at" DESC)` },
  { label: 'idx journal_entries_user_tx_status_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "journal_entries_user_tx_status_idx" ON "journal_entries"("user_id", "transaction_id", "status")` },
  { label: 'idx exchange_rates_user_base_date_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "exchange_rates_user_base_date_idx" ON "exchange_rates"("user_id", "base_currency", "effective_date" DESC)` },
  { label: 'idx statement_import_batches_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "statement_import_batches_user_created_idx" ON "statement_import_batches"("user_id", "created_at" DESC)` },
  { label: 'idx statement_import_rows_user_batch_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "statement_import_rows_user_batch_idx" ON "statement_import_rows"("user_id", "batch_id")` },
  { label: 'idx statement_import_rows_user_linked_tx_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "statement_import_rows_user_linked_tx_idx" ON "statement_import_rows"("user_id", "linked_transaction_id")` },
  { label: 'idx financial_review_items_user_status_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "financial_review_items_user_status_created_idx" ON "financial_review_items"("user_id", "status", "created_at" DESC)` },
  { label: 'idx commitment_occurrences_user_expected_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "commitment_occurrences_user_expected_idx" ON "commitment_occurrences"("user_id", "expected_date" DESC)` },
  { label: 'idx commitment_occurrences_user_status_expected_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "commitment_occurrences_user_status_expected_idx" ON "commitment_occurrences"("user_id", "status", "expected_date")` },
  { label: 'idx goal_contribution_events_user_goal_date_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "goal_contribution_events_user_goal_date_idx" ON "goal_contribution_events"("user_id", "goal_id", "event_date" DESC)` },
  { label: 'idx saved_scenarios_user_updated_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "saved_scenarios_user_updated_idx" ON "saved_scenarios"("user_id", "updated_at" DESC)` },
  { label: 'idx financial_rules_user_enabled_trigger_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "financial_rules_user_enabled_trigger_idx" ON "financial_rules"("user_id", "enabled", "trigger_type")` },
  { label: 'idx financial_rule_logs_user_created_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "financial_rule_logs_user_created_idx" ON "financial_rule_logs"("user_id", "created_at" DESC)` },
  { label: 'idx external_wealth_items_user_valdate_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "external_wealth_items_user_valdate_idx" ON "external_wealth_items"("user_id", "valuation_date" DESC)` },
  { label: 'idx external_wealth_valuations_user_item_date_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "external_wealth_valuations_user_item_date_idx" ON "external_wealth_valuations"("user_id", "item_id", "valuation_date" DESC)` },
  { label: 'idx transactions_user_dest_wallet_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "transactions_user_dest_wallet_idx" ON "transactions"("user_id", "destination_wallet_id")` },
  { label: 'idx domain_event_outbox_user_status_idx', optional: true, sql: `CREATE INDEX IF NOT EXISTS "domain_event_outbox_user_status_idx" ON "domain_event_outbox"("user_id", "status")` },
];

const CURRENT_SCHEMA_VERSION = 2026111801;

export async function ensureDatabaseSchema(): Promise<void> {
  if (!global._schemaReadyPromise) {
    global._schemaReadyPromise = (async () => {
      const pool = createPool();
      if (global._pgliteInstance) {
        await global._pgliteInstance.waitReady;
      }

      // Fast path: 1-query schema version check avoids re-running 220+ DDL statements on every cold start
      try {
        const metaRes = await pool.query(
          `SELECT "schema_version" FROM "_truespend_schema_meta" WHERE "id" = 1 LIMIT 1`
        );
        if (Number(metaRes.rows?.[0]?.schema_version) === CURRENT_SCHEMA_VERSION) {
          return;
        }
      } catch {
        // Table doesn't exist yet — proceed with full schema initialization
      }

      const criticalStatements = CORE_DDL_STATEMENTS.filter((s) => !s.optional);
      const optionalStatements = CORE_DDL_STATEMENTS.filter((s) => s.optional);

      // Run critical statements sequentially (or batched in pg) to preserve FK/enum ordering
      for (const stmt of criticalStatements) {
        try {
          await pool.query(stmt.sql);
        } catch (err: any) {
          console.error(`[DB Init] Critical migration error (${stmt.label}):`, err?.message || err);
          throw err;
        }
      }

      // Run optional ALTER/INDEX statements in parallel chunks of 8 instead of 1-by-1 serial round-trips
      const CHUNK_SIZE = 8;
      for (let i = 0; i < optionalStatements.length; i += CHUNK_SIZE) {
        const chunk = optionalStatements.slice(i, i + CHUNK_SIZE);
        await Promise.all(
          chunk.map(async (stmt) => {
            try {
              await pool.query(stmt.sql);
            } catch (err: any) {
              console.warn(`[DB Init] Optional migration notice (${stmt.label}):`, err?.message || err);
            }
          })
        );
      }

      try {
        await pool.query(
          `CREATE TABLE IF NOT EXISTS "_truespend_schema_meta" ("id" integer PRIMARY KEY, "schema_version" integer NOT NULL, "updated_at" timestamp DEFAULT now())`
        );
        await pool.query(
          `INSERT INTO "_truespend_schema_meta" ("id", "schema_version", "updated_at") VALUES (1, $1, now()) ON CONFLICT ("id") DO UPDATE SET "schema_version" = EXCLUDED."schema_version", "updated_at" = now()`,
          [CURRENT_SCHEMA_VERSION]
        );
      } catch (err: any) {
        console.warn('[DB Init] Schema meta stamp notice:', err?.message || err);
      }
    })().catch((err) => {
      global._schemaReadyPromise = undefined;
      throw err;
    });
  }
  return global._schemaReadyPromise;
}

export const db: NodePgDatabase<typeof schema> = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    const instance = getOrCreateDb();
    const value = Reflect.get(instance, prop, instance);
    return typeof value === 'function' ? value.bind(instance) : value;
  },
});
