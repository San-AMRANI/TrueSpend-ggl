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

        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "instrument_type" text DEFAULT 'Common Stock';
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "raw_held_ticker" text;
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "underlying_ticker" text;
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "exchange" text DEFAULT 'NYSE / NASDAQ';
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "country" text DEFAULT 'United States';
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "target_price" numeric;
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "alert_above" numeric;
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "alert_below" numeric;
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "data_source" text DEFAULT 'manual';
        ALTER TABLE "stock_positions" ADD COLUMN IF NOT EXISTS "price_updated_at" timestamp;

        ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "fee_native" numeric DEFAULT 0;
        ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "tax_native" numeric DEFAULT 0;
        ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "split_ratio" numeric DEFAULT 1;
        ALTER TABLE "stock_orders" ADD COLUMN IF NOT EXISTS "account_source" text DEFAULT 'manual';

        CREATE TABLE IF NOT EXISTS "market_data_symbols" (
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
        );

        CREATE TABLE IF NOT EXISTS "market_data_daily_bars" (
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
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "market_data_daily_bars_symbol_date_unique" ON "market_data_daily_bars"("symbol", "bar_date");

        CREATE TABLE IF NOT EXISTS "market_data_usage" (
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
        );

        CREATE TABLE IF NOT EXISTS "portfolio_daily_snapshots" (
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
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "portfolio_daily_snapshots_user_date_unique" ON "portfolio_daily_snapshots"("user_id", "snapshot_date");

        CREATE TABLE IF NOT EXISTS "investment_dividend_events" (
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
        );
        CREATE INDEX IF NOT EXISTS "investment_dividend_events_user_id_idx" ON "investment_dividend_events"("user_id");

        CREATE TABLE IF NOT EXISTS "investment_settings" (
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
        );

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
