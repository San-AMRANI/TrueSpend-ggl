import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

    if (connectionString) {
      global._postgresPool = new Pool({
        connectionString,
        max: 10,
        connectionTimeoutMillis: 15000,
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

        -- Investment: extend wallet_type enum safely
        DO $$ BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum
            WHERE enumlabel = 'Brokerage'
              AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'wallet_type')
          ) THEN
            ALTER TYPE wallet_type ADD VALUE 'Brokerage';
          END IF;
        END $$;

        -- Investment Holdings
        CREATE TABLE IF NOT EXISTS "investment_holdings" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "wallet_id" uuid NOT NULL REFERENCES "wallets"("id") ON DELETE CASCADE,
          "symbol" text NOT NULL,
          "name" text NOT NULL,
          "asset_type" text NOT NULL,
          "quantity" numeric(20,8) NOT NULL DEFAULT '0',
          "avg_cost_basis" numeric(20,8) NOT NULL DEFAULT '0',
          "currency" text NOT NULL DEFAULT 'USD',
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "investment_holdings_user_id_idx" ON "investment_holdings"("user_id");

        -- Asset Price Cache
        CREATE TABLE IF NOT EXISTS "asset_price_cache" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "symbol" text NOT NULL,
          "asset_type" text NOT NULL,
          "price_usd" numeric(20,8),
          "price_mad" numeric(20,8),
          "price_eur" numeric(20,8),
          "fetched_at" timestamp NOT NULL DEFAULT now(),
          "source" text NOT NULL DEFAULT 'manual'
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "asset_price_cache_symbol_type_unique"
          ON "asset_price_cache"("symbol", "asset_type");

        -- Net Worth Snapshots
        CREATE TABLE IF NOT EXISTS "net_worth_snapshots" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "date" text NOT NULL,
          "liquid_value" numeric(20,4) NOT NULL DEFAULT '0',
          "investment_value" numeric(20,4) NOT NULL DEFAULT '0',
          "debt_value" numeric(20,4) NOT NULL DEFAULT '0',
          "net_worth" numeric(20,4) NOT NULL DEFAULT '0',
          "currency" text NOT NULL DEFAULT 'MAD',
          "created_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE UNIQUE INDEX IF NOT EXISTS "net_worth_snapshots_user_date_unique"
          ON "net_worth_snapshots"("user_id", "date");

        -- DCA Plans
        CREATE TABLE IF NOT EXISTS "dca_plans" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "symbol" text NOT NULL,
          "asset_name" text NOT NULL,
          "asset_type" text NOT NULL,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "amount" numeric NOT NULL,
          "currency" text NOT NULL DEFAULT 'MAD',
          "frequency" text NOT NULL DEFAULT 'monthly',
          "next_date" text NOT NULL,
          "active" boolean NOT NULL DEFAULT true,
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "dca_plans_user_id_idx" ON "dca_plans"("user_id");

        -- Investment columns on transactions
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "investment_holding_id" uuid;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "investment_action" text;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "investment_quantity" numeric(20,8);
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "investment_price_per_unit" numeric(20,8);
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "investment_realized_gain_loss" numeric(20,4);
      `)
      .catch((err) => {
        console.warn('[DB Init] Schema columns ensure notice:', err?.message || err);
      });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
