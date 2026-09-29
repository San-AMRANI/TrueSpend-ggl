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

        CREATE TABLE IF NOT EXISTS "impulse_items" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "name" text NOT NULL,
          "amount" numeric NOT NULL,
          "currency" text NOT NULL DEFAULT 'MAD',
          "category" text NOT NULL DEFAULT 'Shopping & Gadgets',
          "notes" text,
          "url" text,
          "triggers" text NOT NULL DEFAULT '[]',
          "urgency_score" integer NOT NULL DEFAULT 5,
          "utility_score" integer NOT NULL DEFAULT 5,
          "cooling_hours" integer NOT NULL DEFAULT 72,
          "cools_at" timestamp NOT NULL,
          "status" text NOT NULL DEFAULT 'cooling',
          "decision_date" timestamp,
          "decision_notes" text,
          "saved_to_goal_id" uuid REFERENCES "goals"("id") ON DELETE SET NULL,
          "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "impulse_items_user_id_idx" ON "impulse_items"("user_id");

        CREATE TABLE IF NOT EXISTS "fire_profiles" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
          "current_age" integer NOT NULL DEFAULT 28,
          "target_age" integer NOT NULL DEFAULT 55,
          "expected_return" numeric NOT NULL DEFAULT 7.5,
          "safe_withdrawal_rate" numeric NOT NULL DEFAULT 4.0,
          "monthly_savings_boost" numeric NOT NULL DEFAULT 0,
          "expense_trim_percent" numeric NOT NULL DEFAULT 0,
          "custom_monthly_expense" numeric,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "fire_profiles_user_id_idx" ON "fire_profiles"("user_id");

        CREATE TABLE IF NOT EXISTS "resilience_profiles" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE UNIQUE,
          "emergency_target_months" integer NOT NULL DEFAULT 6,
          "stress_job_loss_months" integer NOT NULL DEFAULT 3,
          "stress_emergency_expense" numeric NOT NULL DEFAULT 2500,
          "stress_inflation_rate" numeric NOT NULL DEFAULT 12.0,
          "essential_expenses_ratio" numeric NOT NULL DEFAULT 60.0,
          "custom_essential_monthly" numeric,
          "micro_leak_threshold" numeric NOT NULL DEFAULT 20.0,
          "notes" text,
          "last_audited_at" timestamp NOT NULL DEFAULT now(),
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS "resilience_profiles_user_id_idx" ON "resilience_profiles"("user_id");
      `)
      .catch((err) => {
        console.warn('[DB Init] Schema columns ensure notice:', err?.message || err);
      });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
