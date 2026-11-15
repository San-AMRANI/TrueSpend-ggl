import type { Pool } from 'pg';

export interface MigrationDefinition {
  id: string;
  description: string;
  sql: string;
}

/**
 * Canonical catalog of all required secondary & partial unique indexes defined by the
 * TrueSpend PostgreSQL & SQL Database Optimization Plan (DB-01, DB-03, DB-04, DB-07, DB-08).
 */
export const REQUIRED_INDEX_CATALOG = [
  // P0: Core Ledger, Splits & Double-Entry Journal
  'idx_transactions_user_created',
  'idx_transactions_user_wallet_created',
  'idx_transactions_user_destination_created',
  'idx_transactions_user_payroll',
  'idx_splits_transaction',
  'idx_splits_linked_contact',
  'idx_journal_entries_user_tx_status',
  'idx_journal_entries_user_posted',
  'idx_journal_lines_entry',
  'idx_journal_lines_user_wallet',
  // P1: Debts, Payrolls, Subscriptions, Contexts, Goals, Review, Commitments, Rules
  'idx_debts_user_status_due',
  'idx_payrolls_user_scheduled',
  'idx_subscriptions_user_status_next',
  'idx_contexts_user_status_start',
  'idx_goals_user_updated',
  'idx_review_user_status_created',
  'idx_commitments_user_date_status',
  'idx_goal_events_user_goal_date',
  'idx_scenarios_user_updated',
  'idx_rules_user_trigger_enabled',
  'idx_rule_logs_user_created',
  'idx_outbox_user_status_created',
  'idx_snapshots_user_date',
  // Statement Reconciliation
  'idx_statement_batches_user_created',
  'idx_statement_rows_batch',
  'idx_statement_rows_user_wallet_date',
  'idx_statement_rows_linked_tx',
  'idx_statement_rows_suggested_tx',
  'uq_statement_rows_wallet_hash',
  // P2: Investments, Market Data, Wealth, Notifications & Audit
  'idx_stock_positions_user_watchlist',
  'idx_stock_orders_user_executed',
  'idx_stock_orders_position_executed',
  'idx_dividends_user_payment',
  'idx_exchange_rates_user_pair_date',
  'idx_market_usage_provider_date',
  'idx_external_wealth_user_valuation',
  'idx_external_valuations_item_date',
  'idx_notification_deliveries_user_delivered',
  'idx_push_subscriptions_user',
  'idx_audit_target_created',
  // Uniqueness & Idempotency Guards
  'uq_transactions_user_idempotency',
  'uq_commitment_source_date',
  'uq_financial_rule_logs_idempotency',
] as const;

export const SCHEMA_MIGRATIONS: MigrationDefinition[] = [
  {
    id: '001_core_schema_bootstrap',
    description: 'Ensure all core TrueSpend tables and columns exist idempotently (DB-08)',
    sql: `
      CREATE TABLE IF NOT EXISTS wallets (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        type text DEFAULT 'Bank' NOT NULL,
        account_subtype text DEFAULT 'Checking' NOT NULL,
        institution_name text,
        currency text DEFAULT 'MAD' NOT NULL,
        credit_limit decimal,
        liability_balance decimal DEFAULT '0' NOT NULL,
        statement_closing_day integer,
        payment_due_day integer,
        last_reconciled_at timestamp,
        valuation_status text DEFAULT 'verified' NOT NULL,
        is_main boolean DEFAULT false NOT NULL,
        initial_balance decimal DEFAULT '0' NOT NULL,
        current_balance decimal DEFAULT '0' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS account_subtype text DEFAULT 'Checking' NOT NULL;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS institution_name text;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MAD' NOT NULL;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS credit_limit decimal;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS liability_balance decimal DEFAULT '0' NOT NULL;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS statement_closing_day integer;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS payment_due_day integer;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS last_reconciled_at timestamp;
      ALTER TABLE wallets ADD COLUMN IF NOT EXISTS valuation_status text DEFAULT 'verified' NOT NULL;

      CREATE TABLE IF NOT EXISTS payrolls (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        scheduled_for timestamp NOT NULL,
        amount decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        status text DEFAULT 'expected' NOT NULL,
        confirmed_amount decimal,
        confirmed_at timestamp,
        variance_amount decimal,
        variance_notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MAD' NOT NULL;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS status text DEFAULT 'expected' NOT NULL;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS confirmed_amount decimal;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS confirmed_at timestamp;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS variance_amount decimal;
      ALTER TABLE payrolls ADD COLUMN IF NOT EXISTS variance_notes text;

      CREATE TABLE IF NOT EXISTS counterparties (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        canonical_name text NOT NULL,
        normalized_name text NOT NULL,
        counterparty_type text DEFAULT 'merchant' NOT NULL,
        aliases_json text DEFAULT '[]' NOT NULL,
        default_category text,
        website text,
        logo_url text,
        contact_details text,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS counterparties_user_normalized_idx
        ON counterparties(user_id, normalized_name);

      CREATE TABLE IF NOT EXISTS financial_contexts (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        type text DEFAULT 'Event' NOT NULL,
        status text DEFAULT 'Active' NOT NULL,
        budget decimal DEFAULT '0' NOT NULL,
        start_date timestamp DEFAULT now() NOT NULL,
        end_date timestamp,
        description text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES wallets(id);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS destination_wallet_id uuid REFERENCES wallets(id);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payroll_id uuid REFERENCES payrolls(id);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS context_id uuid REFERENCES financial_contexts(id);
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS native_amount decimal;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MAD' NOT NULL;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS exchange_rate_used decimal DEFAULT '1' NOT NULL;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS fx_source text DEFAULT 'base_currency' NOT NULL;
      ALTER TABLE transactions ADD COLUMN IF NOT EXISTS idempotency_key text;
      ALTER TABLE transactions ALTER COLUMN source_wallet DROP NOT NULL;

      ALTER TABLE debts ADD COLUMN IF NOT EXISTS currency text DEFAULT 'MAD' NOT NULL;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS interest_rate_apr decimal DEFAULT '0';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS minimum_payment decimal;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS payment_frequency text DEFAULT 'monthly';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS installment_amount decimal;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS total_installments integer;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS remaining_installments integer;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS next_payment_date timestamp;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS late_fee_amount decimal DEFAULT '0';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS notes text;

      ALTER TABLE category_budgets ADD COLUMN IF NOT EXISTS rollover_enabled boolean DEFAULT false NOT NULL;
      ALTER TABLE category_budgets ADD COLUMN IF NOT EXISTS rollover_amount decimal DEFAULT '0' NOT NULL;
      ALTER TABLE category_budgets ADD COLUMN IF NOT EXISTS alert_threshold_percent integer DEFAULT 85 NOT NULL;

      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_token text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_refresh_token text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_drive_token_expiry timestamp;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS automated_drive_backups integer DEFAULT 0;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_drive_backup_date text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS drive_backup_frequency text DEFAULT 'weekly';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS role text DEFAULT 'member' NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS status text DEFAULT 'active' NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS workspace_mode text DEFAULT 'shared' NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_color text DEFAULT 'indigo';
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notes text;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamp;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by uuid;

      CREATE TABLE IF NOT EXISTS user_audit_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        actor_id uuid REFERENCES users(id) ON DELETE SET NULL,
        actor_name text NOT NULL,
        target_user_id uuid,
        target_user_name text NOT NULL,
        action text NOT NULL,
        details text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS goals (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        name text NOT NULL,
        target_amount decimal NOT NULL,
        current_amount decimal DEFAULT '0' NOT NULL,
        auto_sync_balance boolean DEFAULT false NOT NULL,
        deadline timestamp,
        category text DEFAULT 'Savings' NOT NULL,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS subscriptions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
        name text NOT NULL,
        amount decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        billing_cycle text DEFAULT 'monthly' NOT NULL,
        next_billing_date timestamp NOT NULL,
        category text DEFAULT 'Subscriptions' NOT NULL,
        status text DEFAULT 'active' NOT NULL,
        auto_renew boolean DEFAULT true NOT NULL,
        reminder_days integer DEFAULT 3 NOT NULL,
        price_history text,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS stock_positions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        ticker text NOT NULL,
        company_name text NOT NULL,
        market text DEFAULT 'US' NOT NULL,
        sector text DEFAULT 'Technology' NOT NULL,
        shares decimal DEFAULT '0' NOT NULL,
        avg_cost_per_share decimal DEFAULT '0' NOT NULL,
        current_price decimal DEFAULT '0' NOT NULL,
        currency text DEFAULT 'USD' NOT NULL,
        annual_dividend_per_share decimal DEFAULT '0' NOT NULL,
        target_weight_percent decimal DEFAULT '0' NOT NULL,
        conviction_thesis text,
        is_watchlist_only boolean DEFAULT false NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS stock_orders (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        position_id uuid REFERENCES stock_positions(id) ON DELETE CASCADE,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        ticker text NOT NULL,
        company_name text NOT NULL,
        market text DEFAULT 'US' NOT NULL,
        action text DEFAULT 'BUY' NOT NULL,
        shares decimal DEFAULT '0' NOT NULL,
        price_per_share decimal DEFAULT '0' NOT NULL,
        currency text DEFAULT 'USD' NOT NULL,
        exchange_rate_used decimal DEFAULT '10' NOT NULL,
        total_mad_amount decimal DEFAULT '0' NOT NULL,
        realized_pnl_mad decimal DEFAULT '0',
        notes text,
        executed_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS market_instruments (
        symbol text PRIMARY KEY,
        raw_ticker text NOT NULL,
        underlying_ticker text NOT NULL,
        company_name text NOT NULL,
        instrument_type text DEFAULT 'EQUITY' NOT NULL,
        exchange text DEFAULT 'NASDAQ' NOT NULL,
        country text DEFAULT 'US' NOT NULL,
        currency text DEFAULT 'USD' NOT NULL,
        sector text DEFAULT 'Technology & Cloud' NOT NULL,
        annual_dividend_per_share decimal DEFAULT '0' NOT NULL,
        dividend_yield_percent decimal DEFAULT '0' NOT NULL,
        last_price decimal DEFAULT '0' NOT NULL,
        change_24h_percent decimal DEFAULT '0' NOT NULL,
        provider_source text DEFAULT 'curated' NOT NULL,
        display_approved boolean DEFAULT false NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS market_daily_bars (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        symbol text NOT NULL,
        bar_date text NOT NULL,
        open decimal NOT NULL,
        high decimal NOT NULL,
        low decimal NOT NULL,
        close decimal NOT NULL,
        volume decimal DEFAULT '0' NOT NULL,
        currency text DEFAULT 'USD' NOT NULL,
        provider_source text DEFAULT 'TwelveData' NOT NULL,
        fetched_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS market_daily_bars_symbol_date_idx
        ON market_daily_bars(symbol, bar_date);

      CREATE TABLE IF NOT EXISTS dividend_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        position_id uuid REFERENCES stock_positions(id) ON DELETE SET NULL,
        ticker text NOT NULL,
        company_name text NOT NULL,
        market text DEFAULT 'US' NOT NULL,
        ex_date text NOT NULL,
        payment_date text NOT NULL,
        Status text DEFAULT 'EXPECTED' NOT NULL,
        shares_eligible decimal DEFAULT '0' NOT NULL,
        dividend_per_share_native decimal DEFAULT '0' NOT NULL,
        gross_amount_native decimal DEFAULT '0' NOT NULL,
        withholding_tax_rate_percent decimal DEFAULT '15' NOT NULL,
        withholding_tax_native decimal DEFAULT '0' NOT NULL,
        net_amount_native decimal DEFAULT '0' NOT NULL,
        currency text DEFAULT 'USD' NOT NULL,
        fx_rate_used decimal DEFAULT '9.95' NOT NULL,
        gross_amount_mad decimal DEFAULT '0' NOT NULL,
        tax_amount_mad decimal DEFAULT '0' NOT NULL,
        net_amount_mad decimal DEFAULT '0' NOT NULL,
        reinvested boolean DEFAULT false NOT NULL,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS portfolio_daily_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        snapshot_date text NOT NULL,
        total_market_value_mad decimal DEFAULT '0' NOT NULL,
        investment_cash_mad decimal DEFAULT '0' NOT NULL,
        net_contributions_mad decimal DEFAULT '0' NOT NULL,
        cost_basis_mad decimal DEFAULT '0' NOT NULL,
        unrealized_pnl_mad decimal DEFAULT '0' NOT NULL,
        realized_pnl_mad decimal DEFAULT '0' NOT NULL,
        dividends_received_mad decimal DEFAULT '0' NOT NULL,
        usd_to_mad_rate decimal DEFAULT '9.95' NOT NULL,
        positions_json text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS portfolio_snapshots_user_date_idx
        ON portfolio_daily_snapshots(user_id, snapshot_date);

      CREATE TABLE IF NOT EXISTS market_data_usage (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        provider text DEFAULT 'TwelveData' NOT NULL,
        date_key text NOT NULL,
        minute_key text NOT NULL,
        daily_credits_used integer DEFAULT 0 NOT NULL,
        minute_credits_used integer DEFAULT 0 NOT NULL,
        last_request_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS user_investment_settings (
        user_id uuid PRIMARY KEY REFERENCES users(id),
        investor_profile text DEFAULT 'Balanced Compounder' NOT NULL,
        us_withholding_tax_percent decimal DEFAULT '15' NOT NULL,
        morocco_withholding_tax_percent decimal DEFAULT '15' NOT NULL,
        us_broker_fee_percent decimal DEFAULT '0.10' NOT NULL,
        bvc_broker_fee_percent decimal DEFAULT '0.35' NOT NULL,
         custody_fee_annual_percent decimal DEFAULT '0' NOT NULL,
        default_benchmark text DEFAULT 'SPY' NOT NULL,
        enforce_emergency_buffer_guard boolean DEFAULT true NOT NULL,
        twelve_data_display_approved boolean DEFAULT false NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS journal_entries (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        entry_type text DEFAULT 'standard' NOT NULL,
        status text DEFAULT 'posted' NOT NULL,
        reversal_of_entry_id uuid,
        currency text DEFAULT 'MAD' NOT NULL,
        exchange_rate_used decimal DEFAULT '1' NOT NULL,
        is_estimated_backfill boolean DEFAULT false NOT NULL,
        idempotency_key text,
        memo text,
        posted_at timestamp DEFAULT now() NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_user_idempotency_idx
        ON journal_entries(user_id, idempotency_key);

      CREATE TABLE IF NOT EXISTS journal_lines (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        account_code text NOT NULL,
        account_name text NOT NULL,
        account_class text NOT NULL,
        debit_mad decimal DEFAULT '0' NOT NULL,
        credit_mad decimal DEFAULT '0' NOT NULL,
        native_amount decimal DEFAULT '0' NOT NULL,
        native_currency text DEFAULT 'MAD' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS exchange_rates (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        base_currency text NOT NULL,
        quote_currency text DEFAULT 'MAD' NOT NULL,
        rate decimal NOT NULL,
        effective_date text NOT NULL,
        source text DEFAULT 'manual' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS statement_import_batches (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        file_name text NOT NULL,
        file_format text DEFAULT 'CSV' NOT NULL,
        statement_opening_balance decimal,
        statement_closing_balance decimal,
        statement_start_date text,
        statement_end_date text,
        total_rows integer DEFAULT 0 NOT NULL,
        matched_count integer DEFAULT 0 NOT NULL,
        unmatched_count integer DEFAULT 0 NOT NULL,
        ambiguous_count integer DEFAULT 0 NOT NULL,
        duplicate_count integer DEFAULT 0 NOT NULL,
        reconciled_variance decimal DEFAULT '0',
        status text DEFAULT 'pending_review' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS statement_import_rows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        batch_id uuid NOT NULL REFERENCES statement_import_batches(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id),
        wallet_id uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
        counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
        row_date text NOT NULL,
        description text NOT NULL,
        amount decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        external_reference text,
        row_hash text NOT NULL,
        match_status text DEFAULT 'unmatched' NOT NULL,
        match_confidence decimal DEFAULT '0' NOT NULL,
        linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        suggested_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        candidate_transaction_ids_json text,
        created_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE statement_import_rows ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS financial_review_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        source_type text NOT NULL,
        status text DEFAULT 'Needs Review' NOT NULL,
        confidence_score decimal DEFAULT '0.80' NOT NULL,
        parsed_amount decimal NOT NULL,
        parsed_currency text DEFAULT 'MAD' NOT NULL,
        parsed_date text NOT NULL,
        parsed_description text NOT NULL,
        parsed_category text DEFAULT '🛒 Groceries' NOT NULL,
        parsed_type text DEFAULT 'Expense' NOT NULL,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL,
        linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        raw_payload_json text,
        decision_notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE financial_review_items ADD COLUMN IF NOT EXISTS counterparty_id uuid REFERENCES counterparties(id) ON DELETE SET NULL;

      CREATE TABLE IF NOT EXISTS commitment_occurrences (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        source_type text NOT NULL,
        source_id uuid NOT NULL,
        title text NOT NULL,
        category text DEFAULT 'Subscriptions' NOT NULL,
        direction text DEFAULT 'outflow' NOT NULL,
        expected_date text NOT NULL,
        expected_amount decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        status text DEFAULT 'scheduled' NOT NULL,
        actual_date text,
        actual_amount decimal,
        principal_amount decimal,
        interest_amount decimal,
        fee_amount decimal,
        remaining_balance_after decimal,
        is_non_cash_event boolean DEFAULT false NOT NULL,
        rescheduled_to_date text,
        skip_or_renegotiate_reason text,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        variance_notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS counterparty_type text DEFAULT 'Person';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS principal_balance decimal;
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS rate_type text DEFAULT 'none';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS installment_frequency text DEFAULT 'one_time';
      ALTER TABLE debts ADD COLUMN IF NOT EXISTS fees_amount decimal DEFAULT '0';
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS funding_cadence text DEFAULT 'monthly';
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS planned_contribution_amount decimal DEFAULT '0';
      ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS icon text DEFAULT '🔁';
      ALTER TABLE stock_orders ADD COLUMN IF NOT EXISTS linked_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
      ALTER TABLE stock_orders ADD COLUMN IF NOT EXISTS total_native_amount decimal DEFAULT '0' NOT NULL;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS paid_amount decimal DEFAULT '0';
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS variance_amount decimal DEFAULT '0';
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS principal_amount decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS principal_component decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS interest_amount decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS interest_component decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS fee_amount decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS fee_component decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS installment_number integer;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS remaining_balance_after decimal;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS is_non_cash_event boolean DEFAULT false NOT NULL;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS rescheduled_to_date text;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS skip_or_renegotiate_reason text;
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS history_json text DEFAULT '[]';
      ALTER TABLE commitment_occurrences ADD COLUMN IF NOT EXISTS notes text;

      CREATE TABLE IF NOT EXISTS goal_contribution_events (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        goal_id uuid NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        source_wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        destination_wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL,
        transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
        event_type text DEFAULT 'contribution' NOT NULL,
        amount decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        note text,
        notes text,
        event_date text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      ALTER TABLE goal_contribution_events ADD COLUMN IF NOT EXISTS source_wallet_id uuid REFERENCES wallets(id) ON DELETE SET NULL;
      ALTER TABLE goal_contribution_events ADD COLUMN IF NOT EXISTS notes text;

      CREATE TABLE IF NOT EXISTS saved_scenarios (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        description text,
        baseline_snapshot_json text NOT NULL,
        events_json text NOT NULL,
        assumptions_json text NOT NULL,
        projected_summary_json text NOT NULL,
        is_approved_plan boolean DEFAULT false NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_rules (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        enabled boolean DEFAULT true NOT NULL,
        version integer DEFAULT 1 NOT NULL,
        trigger_type text NOT NULL,
        conditions_json text NOT NULL,
        action_type text NOT NULL,
        action_payload_json text NOT NULL,
        approval_policy text DEFAULT 'require_approval' NOT NULL,
        last_triggered_at timestamp,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_rule_logs (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        rule_id uuid NOT NULL REFERENCES financial_rules(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id),
        rule_version integer DEFAULT 1 NOT NULL,
        trigger_event_summary text NOT NULL,
        proposed_result_summary text NOT NULL,
        outcome_status text DEFAULT 'draft_created' NOT NULL,
        idempotency_key text NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS external_wealth_items (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        name text NOT NULL,
        item_class text NOT NULL,
        is_liability boolean DEFAULT false NOT NULL,
        is_liquid boolean DEFAULT false NOT NULL,
        estimated_value decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        valuation_date text NOT NULL,
        valuation_source text DEFAULT 'manual_estimate' NOT NULL,
        confidence_level text DEFAULT 'medium' NOT NULL,
        is_externally_verified boolean DEFAULT false NOT NULL,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL,
        updated_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS external_wealth_valuations (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        item_id uuid NOT NULL REFERENCES external_wealth_items(id) ON DELETE CASCADE,
        user_id uuid NOT NULL REFERENCES users(id),
        estimated_value decimal NOT NULL,
        currency text DEFAULT 'MAD' NOT NULL,
        fx_rate_used decimal DEFAULT '1' NOT NULL,
        fx_source text DEFAULT 'manual' NOT NULL,
        value_mad decimal NOT NULL,
        valuation_date text NOT NULL,
        valuation_source text DEFAULT 'manual_estimate' NOT NULL,
        confidence_level text DEFAULT 'medium' NOT NULL,
        notes text,
        created_at timestamp DEFAULT now() NOT NULL
      );

      CREATE TABLE IF NOT EXISTS financial_position_snapshots (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        snapshot_date text NOT NULL,
        reporting_currency text DEFAULT 'MAD' NOT NULL,
        bank_balance_mad decimal DEFAULT '0' NOT NULL,
        cash_balance_mad decimal DEFAULT '0' NOT NULL,
        savings_balance_mad decimal DEFAULT '0' NOT NULL,
        investment_cash_mad decimal DEFAULT '0' NOT NULL,
        credit_card_liability_mad decimal DEFAULT '0' NOT NULL,
        overdraft_liability_mad decimal DEFAULT '0' NOT NULL,
        receivables_mad decimal DEFAULT '0' NOT NULL,
        payables_mad decimal DEFAULT '0' NOT NULL,
        investment_market_value_mad decimal DEFAULT '0' NOT NULL,
        external_assets_mad decimal DEFAULT '0' NOT NULL,
        external_liabilities_mad decimal DEFAULT '0' NOT NULL,
        total_net_worth_mad decimal DEFAULT '0' NOT NULL,
        liquid_net_worth_mad decimal DEFAULT '0' NOT NULL,
        fx_rates_json text DEFAULT '{}' NOT NULL,
        components_json text DEFAULT '{}' NOT NULL,
        data_source text DEFAULT 'verified_computed' NOT NULL,
        confidence_level text DEFAULT 'high' NOT NULL,
        is_estimated boolean DEFAULT false NOT NULL,
        trigger_source text DEFAULT 'daily' NOT NULL,
        created_at timestamp DEFAULT now() NOT NULL
      );
      CREATE UNIQUE INDEX IF NOT EXISTS financial_position_snapshots_user_date_idx
        ON financial_position_snapshots(user_id, snapshot_date);

      CREATE TABLE IF NOT EXISTS domain_event_outbox (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users(id),
        event_type text NOT NULL,
        aggregate_id text NOT NULL,
        payload_json text NOT NULL,
        status text DEFAULT 'pending' NOT NULL,
        attempts integer DEFAULT 0 NOT NULL,
        last_error text,
        created_at timestamp DEFAULT now() NOT NULL,
        processed_at timestamp
      );
    `,
  },
  {
    id: '002_deduplicate_before_unique_indexes',
    description: 'Clean up any historical duplicate keys before creating strict unique indexes (DB-04 / DB-07)',
    sql: `
      -- 1. Deduplicate statement_import_rows on (wallet_id, row_hash), preserving matched/linked rows first
      WITH ranked_stmt AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY wallet_id, row_hash
            ORDER BY
              CASE WHEN linked_transaction_id IS NOT NULL THEN 0 ELSE 1 END,
              created_at ASC,
              id ASC
          ) AS rn
        FROM statement_import_rows
      )
      DELETE FROM statement_import_rows
      WHERE id IN (SELECT id FROM ranked_stmt WHERE rn > 1);

      -- 2. Deduplicate transactions on (user_id, idempotency_key) where idempotency_key IS NOT NULL
      WITH ranked_tx AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, idempotency_key
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM transactions
        WHERE idempotency_key IS NOT NULL
      )
      UPDATE transactions
      SET idempotency_key = NULL
      WHERE id IN (SELECT id FROM ranked_tx WHERE rn > 1);

      -- 3. Deduplicate commitment_occurrences on (user_id, source_type, source_id, expected_date)
      WITH ranked_occ AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, source_type, source_id, expected_date
            ORDER BY
              CASE WHEN status = 'completed' THEN 0 ELSE 1 END,
              created_at ASC,
              id ASC
          ) AS rn
        FROM commitment_occurrences
      )
      DELETE FROM commitment_occurrences
      WHERE id IN (SELECT id FROM ranked_occ WHERE rn > 1);

      -- 4. Deduplicate financial_rule_logs on (user_id, idempotency_key)
      WITH ranked_logs AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY user_id, idempotency_key
            ORDER BY created_at ASC, id ASC
          ) AS rn
        FROM financial_rule_logs
      )
      DELETE FROM financial_rule_logs
      WHERE id IN (SELECT id FROM ranked_logs WHERE rn > 1);
    `,
  },
  {
    id: '003_p0_ledger_indexes',
    description: 'Add P0 composite and partial indexes on transactions, splits, journal_entries, and journal_lines (DB-01)',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_transactions_user_created
        ON transactions (user_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_user_wallet_created
        ON transactions (user_id, wallet_id, created_at DESC, id DESC);

      CREATE INDEX IF NOT EXISTS idx_transactions_user_destination_created
        ON transactions (user_id, destination_wallet_id, created_at DESC)
        WHERE destination_wallet_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_transactions_user_payroll
        ON transactions (user_id, payroll_id)
        WHERE payroll_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS transactions_payroll_id_unique
        ON transactions (payroll_id)
        WHERE payroll_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_splits_transaction
        ON splits (transaction_id);

      CREATE INDEX IF NOT EXISTS idx_splits_linked_contact
        ON splits (linked_contact_id)
        WHERE linked_contact_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_journal_entries_user_tx_status
        ON journal_entries (user_id, transaction_id, status);

      CREATE INDEX IF NOT EXISTS idx_journal_entries_user_posted
        ON journal_entries (user_id, posted_at DESC);

      CREATE INDEX IF NOT EXISTS idx_journal_lines_entry
        ON journal_lines (journal_entry_id);

      CREATE INDEX IF NOT EXISTS idx_journal_lines_user_wallet
        ON journal_lines (user_id, wallet_id);
    `,
  },
  {
    id: '004_p1_operational_indexes',
    description: 'Add P1 composite indexes on debts, payrolls, subscriptions, contexts, goals, review inbox, commitments, and rules (DB-03)',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_debts_user_status_due
        ON debts (user_id, status, due_date);

      CREATE INDEX IF NOT EXISTS idx_payrolls_user_scheduled
        ON payrolls (user_id, scheduled_for DESC);

      CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status_next
        ON subscriptions (user_id, status, next_billing_date);

      CREATE INDEX IF NOT EXISTS idx_contexts_user_status_start
        ON financial_contexts (user_id, status, start_date DESC);

      CREATE INDEX IF NOT EXISTS idx_goals_user_updated
        ON goals (user_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_review_user_status_created
        ON financial_review_items (user_id, status, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_commitments_user_date_status
        ON commitment_occurrences (user_id, expected_date, status);

      CREATE INDEX IF NOT EXISTS idx_goal_events_user_goal_date
        ON goal_contribution_events (user_id, goal_id, event_date DESC);

      CREATE INDEX IF NOT EXISTS idx_scenarios_user_updated
        ON saved_scenarios (user_id, updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_rules_user_trigger_enabled
        ON financial_rules (user_id, trigger_type, enabled);

      CREATE INDEX IF NOT EXISTS idx_rule_logs_user_created
        ON financial_rule_logs (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_outbox_user_status_created
        ON domain_event_outbox (user_id, status, created_at);

      CREATE INDEX IF NOT EXISTS idx_snapshots_user_date
        ON financial_position_snapshots (user_id, snapshot_date DESC);
    `,
  },
  {
    id: '005_statement_reconciliation_indexes',
    description: 'Add statement import batch/row composite indexes and unique row_hash guard (DB-04)',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_statement_batches_user_created
        ON statement_import_batches (user_id, created_at DESC);

      CREATE INDEX IF NOT EXISTS idx_statement_rows_batch
        ON statement_import_rows (batch_id);

      CREATE INDEX IF NOT EXISTS idx_statement_rows_user_wallet_date
        ON statement_import_rows (user_id, wallet_id, row_date DESC);

      CREATE INDEX IF NOT EXISTS idx_statement_rows_linked_tx
        ON statement_import_rows (linked_transaction_id)
        WHERE linked_transaction_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_statement_rows_suggested_tx
        ON statement_import_rows (suggested_transaction_id)
        WHERE suggested_transaction_id IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_statement_rows_wallet_hash
        ON statement_import_rows (wallet_id, row_hash);
    `,
  },
  {
    id: '006_p2_investments_wealth_audit_indexes',
    description: 'Add P2 indexes on investments, market data, external wealth, notifications, and idempotency guards (DB-03 / DB-07)',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_stock_positions_user_watchlist
        ON stock_positions (user_id, is_watchlist_only);

      CREATE INDEX IF NOT EXISTS idx_stock_orders_user_executed
        ON stock_orders (user_id, executed_at DESC);

      CREATE INDEX IF NOT EXISTS idx_stock_orders_position_executed
        ON stock_orders (position_id, executed_at DESC);

      CREATE INDEX IF NOT EXISTS idx_dividends_user_payment
        ON dividend_events (user_id, payment_date DESC);

      CREATE INDEX IF NOT EXISTS idx_exchange_rates_user_pair_date
        ON exchange_rates (user_id, base_currency, quote_currency, effective_date DESC);

      CREATE INDEX IF NOT EXISTS idx_market_usage_provider_date
        ON market_data_usage (provider, date_key);

      CREATE INDEX IF NOT EXISTS idx_external_wealth_user_valuation
        ON external_wealth_items (user_id, valuation_date DESC);

      CREATE INDEX IF NOT EXISTS idx_external_valuations_item_date
        ON external_wealth_valuations (item_id, valuation_date DESC);

      CREATE INDEX IF NOT EXISTS idx_notification_deliveries_user_delivered
        ON notification_deliveries (user_id, delivered_at DESC);

      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
        ON push_subscriptions (user_id);

      CREATE INDEX IF NOT EXISTS idx_audit_target_created
        ON user_audit_logs (target_user_id, created_at DESC);

      CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_user_idempotency
        ON transactions (user_id, idempotency_key)
        WHERE idempotency_key IS NOT NULL;

      CREATE UNIQUE INDEX IF NOT EXISTS uq_commitment_source_date
        ON commitment_occurrences (user_id, source_type, source_id, expected_date);

      CREATE UNIQUE INDEX IF NOT EXISTS uq_financial_rule_logs_idempotency
        ON financial_rule_logs (user_id, idempotency_key);
    `,
  },
];

const MIGRATION_ADVISORY_LOCK_KEY = 84209153;

/**
 * Executes all unapplied migrations in order inside a tracked `schema_migrations` table.
 * Coordinates concurrent processes via a PostgreSQL session advisory lock.
 */
export async function runDatabaseMigrations(pool: Pool): Promise<{
  applied: string[];
  skipped: string[];
}> {
  const applied: string[] = [];
  const skipped: string[] = [];

  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id text PRIMARY KEY,
      description text NOT NULL,
      applied_at timestamp DEFAULT now() NOT NULL
    );
  `);

  const lockRes = await pool
    .query('SELECT pg_try_advisory_lock($1) AS locked', [MIGRATION_ADVISORY_LOCK_KEY])
    .catch(() => ({ rows: [{ locked: true }] }));
  const hasLock = Boolean(lockRes.rows?.[0]?.locked);

  try {
    const existingRes = await pool.query('SELECT id FROM schema_migrations');
    const existingIds = new Set<string>(existingRes.rows.map((r: any) => String(r.id)));

    for (const migration of SCHEMA_MIGRATIONS) {
      if (existingIds.has(migration.id)) {
        skipped.push(migration.id);
        continue;
      }

      await pool.query(migration.sql);
      await pool.query(
        `INSERT INTO schema_migrations (id, description, applied_at)
         VALUES ($1, $2, now())
         ON CONFLICT (id) DO NOTHING`,
        [migration.id, migration.description]
      );
      applied.push(migration.id);
    }
  } finally {
    if (hasLock) {
      await pool
        .query('SELECT pg_advisory_unlock($1)', [MIGRATION_ADVISORY_LOCK_KEY])
        .catch(() => undefined);
    }
  }

  return { applied, skipped };
}
