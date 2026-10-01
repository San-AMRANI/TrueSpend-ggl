import { createPool } from '../src/db/index.js';

export async function runV2Migration() {
  const pool = createPool();
  console.log('[Migration] Starting V2 Database Migration...');

  const sqlStatements = [
    // Enums / Types
    `DO $$ BEGIN
      CREATE TYPE "account_type" AS ENUM('Bank', 'Cash', 'Savings', 'Credit');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "asset_class" AS ENUM('Crypto', 'Stock', 'ETF', 'MutualFund', 'Bond', 'PreciousMetal', 'CashEquivalent', 'Retirement', 'Other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "budget_classification" AS ENUM('essential', 'flexible', 'growth', 'excluded');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "financial_context_status" AS ENUM('Planned', 'Active', 'Completed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "financial_context_type" AS ENUM('Trip', 'Work / Mission', 'Project', 'Life Event', 'Other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "investment_account_type" AS ENUM('Exchange', 'Brokerage', 'Retirement', 'PreciousMetals', 'Manual', 'Other');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "investment_event_type" AS ENUM('Funding', 'Withdrawal', 'Buy', 'Sell', 'Dividend', 'Interest', 'Fee', 'Adjustment');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "plan_allocation_status" AS ENUM('Planned', 'Approved', 'Executed', 'Skipped', 'Changed', 'Failed');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "plan_allocation_type" AS ENUM('Commitment', 'Debt', 'EmergencyBuffer', 'Goal', 'Budget', 'Investment', 'UnallocatedMargin');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "plan_status" AS ENUM('Draft', 'Active', 'Superseded', 'Completed', 'Cancelled');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "price_source" AS ENUM('Manual', 'Provider', 'Import');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "recommendation_status" AS ENUM('Active', 'Viewed', 'Approved', 'Dismissed', 'Snoozed', 'Expired');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "recommendation_type" AS ENUM('SalaryPlanReady', 'UnallocatedIncome', 'EmergencyBufferGap', 'BillReserveRequired', 'BudgetPaceRisk', 'GoalAtRisk', 'DebtDueSoon', 'InvestmentCapacityAvailable', 'AllocationDrift', 'UnusualSpending', 'PlanReviewRequired');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      CREATE TYPE "risk_level" AS ENUM('Low', 'Medium', 'High', 'VeryHigh');
    EXCEPTION WHEN duplicate_object THEN null; END $$;`,

    `DO $$ BEGIN
      ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'Savings';
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;`,

    `DO $$ BEGIN
      ALTER TYPE "wallet_type" ADD VALUE IF NOT EXISTS 'Investment';
    EXCEPTION WHEN duplicate_object THEN null; WHEN undefined_object THEN null; END $$;`,

    // Tables
    `CREATE TABLE IF NOT EXISTS "investment_holdings" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "symbol" text NOT NULL,
      "name" text NOT NULL,
      "asset_type" text NOT NULL,
      "units" numeric DEFAULT '0' NOT NULL,
      "buy_price_avg" numeric DEFAULT '0' NOT NULL,
      "current_price" numeric DEFAULT '0' NOT NULL,
      "currency" text DEFAULT 'USD' NOT NULL,
      "target_allocation_percent" numeric DEFAULT '0',
      "dividend_yield_percent" numeric DEFAULT '0',
      "notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "investment_transactions" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "holding_id" uuid NOT NULL REFERENCES "investment_holdings"("id") ON DELETE CASCADE,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "type" text NOT NULL,
      "units" numeric NOT NULL,
      "price_per_unit" numeric NOT NULL,
      "total_amount" numeric NOT NULL,
      "currency" text DEFAULT 'USD' NOT NULL,
      "fees" numeric DEFAULT '0' NOT NULL,
      "realized_pnl" numeric DEFAULT '0',
      "notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "dca_plans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "holding_id" uuid REFERENCES "investment_holdings"("id") ON DELETE SET NULL,
      "symbol" text NOT NULL,
      "asset_name" text NOT NULL,
      "asset_type" text NOT NULL,
      "target_amount" numeric NOT NULL,
      "currency" text DEFAULT 'MAD' NOT NULL,
      "frequency" text DEFAULT 'post_payday' NOT NULL,
      "day_offset_after_payday" integer DEFAULT 2,
      "wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "status" text DEFAULT 'active' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "investment_watchlist" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "coin_id" text NOT NULL,
      "symbol" text NOT NULL,
      "name" text NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "financial_profiles" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL UNIQUE REFERENCES "users"("id") ON DELETE CASCADE,
      "base_currency" text DEFAULT 'MAD' NOT NULL,
      "income_frequency" text DEFAULT 'monthly' NOT NULL,
      "income_stability" text DEFAULT 'stable' NOT NULL,
      "strategy" text DEFAULT 'Balanced' NOT NULL,
      "risk_preference" "risk_level" DEFAULT 'Medium' NOT NULL,
      "investment_experience" text DEFAULT 'None' NOT NULL,
      "investment_horizon" text DEFAULT 'Not set' NOT NULL,
      "emergency_target_months" numeric DEFAULT '3' NOT NULL,
      "minimum_unallocated_amount" numeric DEFAULT '0' NOT NULL,
      "minimum_unallocated_percent" numeric DEFAULT '0' NOT NULL,
      "allow_cash_equivalent_reserve" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "budget_category_preferences" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "category" text NOT NULL,
      "classification" "budget_classification" DEFAULT 'flexible' NOT NULL,
      "is_locked" boolean DEFAULT false NOT NULL,
      "never_auto_change" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "budget_category_preferences_user_category_unique" ON "budget_category_preferences" ("user_id", "category");`,

    `CREATE TABLE IF NOT EXISTS "financial_plans" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "parent_plan_id" uuid,
      "payroll_id" uuid REFERENCES "payrolls"("id") ON DELETE SET NULL,
      "source_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "status" "plan_status" DEFAULT 'Draft' NOT NULL,
      "period_start" timestamp,
      "period_end" timestamp,
      "income_amount" numeric NOT NULL,
      "base_currency" text DEFAULT 'MAD' NOT NULL,
      "snapshot_json" jsonb NOT NULL,
      "engine_version" text DEFAULT 'v2.0' NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      "approved_at" timestamp,
      "completed_at" timestamp
    );`,
    `CREATE INDEX IF NOT EXISTS "financial_plans_user_status_idx" ON "financial_plans" ("user_id", "status");`,
    `CREATE INDEX IF NOT EXISTS "financial_plans_user_period_idx" ON "financial_plans" ("user_id", "period_start");`,

    `CREATE TABLE IF NOT EXISTS "investment_accounts" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "name" text NOT NULL,
      "institution" text,
      "type" "investment_account_type" NOT NULL,
      "base_currency" text DEFAULT 'MAD' NOT NULL,
      "liquidity" text DEFAULT 'Restricted' NOT NULL,
      "include_in_net_worth" boolean DEFAULT true NOT NULL,
      "include_in_emergency_reserve" boolean DEFAULT false NOT NULL,
      "is_archived" boolean DEFAULT false NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "investment_accounts_user_name_unique" ON "investment_accounts" ("user_id", "name");`,

    `CREATE TABLE IF NOT EXISTS "investment_assets" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
      "symbol" text NOT NULL,
      "name" text NOT NULL,
      "asset_class" "asset_class" NOT NULL,
      "coingecko_coin_id" text,
      "quote_currency" text DEFAULT 'MAD' NOT NULL,
      "units_precision" integer DEFAULT 8 NOT NULL,
      "risk_level" "risk_level" DEFAULT 'Medium' NOT NULL,
      "market_data_provider" text,
      "is_active" boolean DEFAULT true NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "investment_assets_user_symbol_quote_unique" ON "investment_assets" ("user_id", "symbol", "quote_currency");`,

    `CREATE TABLE IF NOT EXISTS "investment_events" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "investment_account_id" uuid NOT NULL REFERENCES "investment_accounts"("id") ON DELETE CASCADE,
      "asset_id" uuid REFERENCES "investment_assets"("id") ON DELETE SET NULL,
      "type" "investment_event_type" NOT NULL,
      "trade_date" timestamp NOT NULL,
      "units" numeric,
      "unit_price" numeric,
      "quote_currency" text DEFAULT 'MAD' NOT NULL,
      "gross_amount" numeric NOT NULL,
      "fee_amount" numeric DEFAULT '0' NOT NULL,
      "fee_currency" text DEFAULT 'MAD' NOT NULL,
      "exchange_rate_to_base" numeric DEFAULT '1' NOT NULL,
      "base_amount" numeric NOT NULL,
      "linked_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "notes" text,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "investment_lots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "investment_event_id" uuid NOT NULL REFERENCES "investment_events"("id") ON DELETE CASCADE,
      "investment_account_id" uuid NOT NULL REFERENCES "investment_accounts"("id") ON DELETE CASCADE,
      "asset_id" uuid NOT NULL REFERENCES "investment_assets"("id") ON DELETE CASCADE,
      "acquired_at" timestamp NOT NULL,
      "original_units" numeric NOT NULL,
      "remaining_units" numeric NOT NULL,
      "cost_basis_base" numeric NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "investment_lot_disposals" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "investment_event_id" uuid NOT NULL REFERENCES "investment_events"("id") ON DELETE CASCADE,
      "investment_lot_id" uuid NOT NULL REFERENCES "investment_lots"("id") ON DELETE CASCADE,
      "units" numeric NOT NULL,
      "cost_basis_base" numeric NOT NULL,
      "proceeds_base" numeric NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,

    `CREATE TABLE IF NOT EXISTS "price_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "asset_id" uuid NOT NULL REFERENCES "investment_assets"("id") ON DELETE CASCADE,
      "user_id" uuid REFERENCES "users"("id") ON DELETE CASCADE,
      "price" numeric NOT NULL,
      "currency" text NOT NULL,
      "exchange_rate_to_base" numeric DEFAULT '1' NOT NULL,
      "price_in_base" numeric NOT NULL,
      "source" "price_source" NOT NULL,
      "provider" text,
      "provider_asset_id" text,
      "provider_price_timestamp" timestamp,
      "captured_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "price_snapshots_asset_captured_source_unique" ON "price_snapshots" ("asset_id", "captured_at", "source");`,

    `CREATE TABLE IF NOT EXISTS "plan_allocations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "plan_id" uuid NOT NULL REFERENCES "financial_plans"("id") ON DELETE CASCADE,
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "type" "plan_allocation_type" NOT NULL,
      "name" text NOT NULL,
      "amount" numeric NOT NULL,
      "status" "plan_allocation_status" DEFAULT 'Planned' NOT NULL,
      "priority" integer NOT NULL,
      "category" text,
      "goal_id" uuid REFERENCES "goals"("id") ON DELETE SET NULL,
      "investment_account_id" uuid REFERENCES "investment_accounts"("id") ON DELETE SET NULL,
      "source_wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "destination_wallet_id" uuid REFERENCES "wallets"("id") ON DELETE SET NULL,
      "executed_transaction_id" uuid REFERENCES "transactions"("id") ON DELETE SET NULL,
      "rationale" text NOT NULL,
      "evidence_json" jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      "executed_at" timestamp
    );`,
    `CREATE INDEX IF NOT EXISTS "plan_allocations_plan_idx" ON "plan_allocations" ("plan_id");`,
    `CREATE INDEX IF NOT EXISTS "plan_allocations_user_idx" ON "plan_allocations" ("user_id");`,

    `CREATE TABLE IF NOT EXISTS "recommendations" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "type" "recommendation_type" NOT NULL,
      "status" "recommendation_status" DEFAULT 'Active' NOT NULL,
      "priority_score" numeric NOT NULL,
      "title" text NOT NULL,
      "summary" text NOT NULL,
      "rationale" text NOT NULL,
      "confidence" text NOT NULL,
      "action_payload" jsonb NOT NULL,
      "evidence_json" jsonb NOT NULL,
      "dedupe_key" text NOT NULL,
      "available_from" timestamp DEFAULT now() NOT NULL,
      "expires_at" timestamp,
      "snoozed_until" timestamp,
      "created_at" timestamp DEFAULT now() NOT NULL,
      "updated_at" timestamp DEFAULT now() NOT NULL,
      "acted_at" timestamp
    );`,
    `CREATE INDEX IF NOT EXISTS "recommendations_user_status_idx" ON "recommendations" ("user_id", "status");`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "recommendations_user_dedupe_unique" ON "recommendations" ("user_id", "dedupe_key");`,

    `CREATE TABLE IF NOT EXISTS "financial_snapshots" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
      "snapshot_date" date NOT NULL,
      "liquid_cash" numeric NOT NULL,
      "reserved_cash" numeric NOT NULL,
      "safe_to_spend" numeric NOT NULL,
      "investment_value" numeric NOT NULL,
      "total_debt" numeric NOT NULL,
      "net_worth" numeric NOT NULL,
      "emergency_coverage_months" numeric NOT NULL,
      "data_json" jsonb NOT NULL,
      "created_at" timestamp DEFAULT now() NOT NULL
    );`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "financial_snapshots_user_date_unique" ON "financial_snapshots" ("user_id", "snapshot_date");`,
  ];

  for (const sql of sqlStatements) {
    try {
      await pool.query(sql);
    } catch (err: any) {
      console.warn('[Migration] Statement warning/error:', err.message);
    }
  }

  console.log('[Migration] V2 Database Migration complete.');
}
