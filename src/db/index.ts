import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    let connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
    if (connectionString) {
      connectionString = connectionString.replace(/^(DATABASE_URL|POSTGRES_URL)=/i, '').trim();
    }

    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 15000,
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
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });

    // Auto-migrate new backup settings columns and tables if not present
    global._postgresPool
      .query(`
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "automated_drive_backups" integer DEFAULT 0;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_drive_backup_date" timestamp;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "drive_backup_frequency" text DEFAULT 'weekly';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_drive_token" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "google_drive_token_expiry" timestamp;

        CREATE TABLE IF NOT EXISTS "financial_contexts" (
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
        );

        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "wallet_id" uuid REFERENCES "wallets"("id");
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "destination_wallet_id" uuid REFERENCES "wallets"("id");
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "payroll_id" uuid REFERENCES "payrolls"("id");
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "context_id" uuid REFERENCES "financial_contexts"("id");

        CREATE TABLE IF NOT EXISTS "subscriptions" (
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
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "subscriptions_user_id_idx" ON "subscriptions"("user_id");

        DO $$ BEGIN
          ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'Investment';
        EXCEPTION
          WHEN duplicate_object THEN null;
          WHEN undefined_object THEN null;
        END $$;

        CREATE TABLE IF NOT EXISTS "investment_holdings" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "symbol" text NOT NULL,
          "name" text NOT NULL,
          "asset_type" text NOT NULL,
          "units" numeric NOT NULL DEFAULT 0,
          "buy_price_avg" numeric NOT NULL DEFAULT 0,
          "current_price" numeric NOT NULL DEFAULT 0,
          "currency" text NOT NULL DEFAULT 'USD',
          "target_allocation_percent" numeric DEFAULT 0,
          "dividend_yield_percent" numeric DEFAULT 0,
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "investment_holdings_user_id_idx" ON "investment_holdings"("user_id");

        CREATE TABLE IF NOT EXISTS "investment_transactions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "holding_id" uuid REFERENCES "investment_holdings"("id") ON DELETE CASCADE,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "type" text NOT NULL,
          "units" numeric NOT NULL DEFAULT 0,
          "price_per_unit" numeric NOT NULL DEFAULT 0,
          "total_amount" numeric NOT NULL DEFAULT 0,
          "currency" text NOT NULL DEFAULT 'USD',
          "fees" numeric NOT NULL DEFAULT 0,
          "realized_pnl" numeric DEFAULT 0,
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "investment_tx_user_id_idx" ON "investment_transactions"("user_id");

        CREATE TABLE IF NOT EXISTS "dca_plans" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "holding_id" uuid REFERENCES "investment_holdings"("id") ON DELETE SET NULL,
          "symbol" text NOT NULL,
          "asset_name" text NOT NULL,
          "asset_type" text NOT NULL,
          "target_amount" numeric NOT NULL,
          "currency" text NOT NULL DEFAULT 'MAD',
          "frequency" text NOT NULL DEFAULT 'post_payday',
          "day_offset_after_payday" integer DEFAULT 2,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "status" text NOT NULL DEFAULT 'active',
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "dca_plans_user_id_idx" ON "dca_plans"("user_id");

        CREATE TABLE IF NOT EXISTS "investment_watchlist" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "coin_id" text NOT NULL,
          "symbol" text NOT NULL,
          "name" text NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "investment_watchlist_user_id_idx" ON "investment_watchlist"("user_id");

        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "username" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "display_name" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password_hash" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'member';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "workspace_mode" text NOT NULL DEFAULT 'isolated';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "permissions" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "avatar_color" text DEFAULT 'indigo';
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "notes" text;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "created_by" uuid;

        CREATE TABLE IF NOT EXISTS "user_audit_logs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "actor_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "actor_name" text NOT NULL,
          "target_user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
          "target_user_name" text NOT NULL,
          "action" text NOT NULL,
          "details" text NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "user_audit_logs_created_at_idx" ON "user_audit_logs"("created_at" DESC);

        UPDATE "users"
        SET
          "role" = 'owner',
          "status" = 'active',
          "workspace_mode" = 'shared',
          "username" = COALESCE("username", '${process.env.ADMIN_USERNAME || 'SanSpend'}'),
          "display_name" = COALESCE("display_name", 'Hassan Amrani (Owner)'),
          "avatar_color" = COALESCE("avatar_color", 'indigo')
        WHERE "email" = 'amranihassan.am@gmail.com';

        UPDATE "users"
        SET "status" = 'legacy_hidden'
        WHERE "email" IN ('amranihassan2003@gmail.com', 'SanSpend@local.host')
          AND "role" = 'member'
          AND "password_hash" IS NULL;
      `)
      .catch((err) => {
        console.warn('[DB Init] Schema columns ensure notice:', err?.message || err);
      });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
