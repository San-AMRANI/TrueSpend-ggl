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

        CREATE TABLE IF NOT EXISTS "stock_positions" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "ticker" text NOT NULL,
          "company_name" text NOT NULL,
          "market" text NOT NULL DEFAULT 'US',
          "sector" text NOT NULL DEFAULT 'Technology',
          "shares" numeric NOT NULL DEFAULT 0,
          "avg_cost_per_share" numeric NOT NULL DEFAULT 0,
          "current_price" numeric NOT NULL DEFAULT 0,
          "currency" text NOT NULL DEFAULT 'USD',
          "annual_dividend_per_share" numeric NOT NULL DEFAULT 0,
          "target_weight_percent" numeric NOT NULL DEFAULT 0,
          "conviction_thesis" text,
          "is_watchlist_only" boolean NOT NULL DEFAULT false,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "stock_positions_user_id_idx" ON "stock_positions"("user_id");

        CREATE TABLE IF NOT EXISTS "stock_orders" (
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
          "realized_pnl_mad" numeric NOT NULL DEFAULT 0,
          "notes" text,
          "executed_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "stock_orders_user_id_idx" ON "stock_orders"("user_id");
        CREATE INDEX IF NOT EXISTS "stock_orders_position_id_idx" ON "stock_orders"("position_id");

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
