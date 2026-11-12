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

        -- Core Audit Schema Migrations (Items A through P)
        ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "base_currency" text NOT NULL DEFAULT 'MAD';

        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_subtype" text NOT NULL DEFAULT 'Checking';
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "institution_name" text;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "account_reference" text;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD';
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "credit_limit" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "liability_balance" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "statement_closing_day" integer;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "payment_due_day" integer;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "minimum_payment" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "valuation_status" text NOT NULL DEFAULT 'verified';
        ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "last_reconciled_at" timestamp;

        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "counterparty_type" text NOT NULL DEFAULT 'Person';
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "principal_balance" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "accrued_interest" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "fees_amount" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "interest_rate_apr" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "rate_type" text NOT NULL DEFAULT 'none';
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "installment_amount" numeric;
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "installment_frequency" text NOT NULL DEFAULT 'one_time';
        ALTER TABLE "debts" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD';

        ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'expected';
        ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "confirmed_amount" numeric;
        ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "confirmed_at" timestamp;
        ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "variance_amount" numeric NOT NULL DEFAULT 0;
        ALTER TABLE "payrolls" ADD COLUMN IF NOT EXISTS "variance_notes" text;

        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "native_amount" numeric;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "currency" text NOT NULL DEFAULT 'MAD';
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "exchange_rate_used" numeric NOT NULL DEFAULT 1;
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "fx_source" text NOT NULL DEFAULT 'locked_at_posting';
        ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "idempotency_key" text;

        ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "funding_cadence" text NOT NULL DEFAULT 'monthly';
        ALTER TABLE "goals" ADD COLUMN IF NOT EXISTS "planned_contribution_amount" numeric NOT NULL DEFAULT 0;

        ALTER TABLE "category_budgets" ADD COLUMN IF NOT EXISTS "rollover_enabled" boolean NOT NULL DEFAULT false;
        ALTER TABLE "category_budgets" ADD COLUMN IF NOT EXISTS "rollover_amount" numeric NOT NULL DEFAULT 0;

        CREATE TABLE IF NOT EXISTS "journal_entries" (
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
        );
        CREATE INDEX IF NOT EXISTS "journal_entries_user_id_idx" ON "journal_entries"("user_id");
        CREATE INDEX IF NOT EXISTS "journal_entries_tx_id_idx" ON "journal_entries"("transaction_id");

        CREATE TABLE IF NOT EXISTS "journal_lines" (
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
        );
        CREATE INDEX IF NOT EXISTS "journal_lines_entry_id_idx" ON "journal_lines"("journal_entry_id");

        CREATE TABLE IF NOT EXISTS "exchange_rates" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
          "base_currency" text NOT NULL,
          "quote_currency" text NOT NULL DEFAULT 'MAD',
          "rate" numeric NOT NULL,
          "source" text NOT NULL DEFAULT 'reference_feed',
          "effective_date" text NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "statement_import_batches" (
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
        );

        CREATE TABLE IF NOT EXISTS "statement_import_rows" (
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
          "candidate_transaction_ids_json" text,
          "created_at" timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "financial_review_items" (
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
          "raw_payload_json" text,
          "decision_notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "commitment_occurrences" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "source_type" text NOT NULL,
          "source_id" text NOT NULL,
          "title" text NOT NULL,
          "expected_date" text NOT NULL,
          "expected_amount" numeric NOT NULL,
          "currency" text NOT NULL DEFAULT 'MAD',
          "status" text NOT NULL DEFAULT 'scheduled',
          "actual_date" text,
          "actual_amount" numeric,
          "variance_amount" numeric NOT NULL DEFAULT 0,
          "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
          "notes" text,
          "created_at" timestamp NOT NULL DEFAULT now(),
          "updated_at" timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "goal_contribution_events" (
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
        );

        CREATE TABLE IF NOT EXISTS "saved_scenarios" (
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
        );

        CREATE TABLE IF NOT EXISTS "financial_rules" (
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
        );

        CREATE TABLE IF NOT EXISTS "financial_rule_logs" (
          "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          "rule_id" uuid NOT NULL REFERENCES "financial_rules"("id") ON DELETE CASCADE,
          "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
          "rule_version" integer NOT NULL DEFAULT 1,
          "trigger_event_summary" text NOT NULL,
          "proposed_result_summary" text NOT NULL,
          "outcome_status" text NOT NULL DEFAULT 'executed',
          "idempotency_key" text NOT NULL,
          "created_at" timestamp NOT NULL DEFAULT now()
        );

        CREATE TABLE IF NOT EXISTS "external_wealth_items" (
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
        );
      `)
      .catch((err) => {
        console.warn('[DB Init] Schema columns ensure notice:', err?.message || err);
      });
  }
  return global._postgresPool;
};

const pool = createPool();
export const db = drizzle(pool, { schema });
