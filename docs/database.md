# TrueSpend PostgreSQL Database Schema & Architecture

This document provides a comprehensive technical specification of the TrueSpend PostgreSQL database schema (`src/db/schema.ts`), relationships, custom enumerations, domain invariants, and backup/restore workflows.

---

## 1. Architectural Overview & Technology Stack

TrueSpend's persistence layer is built on **PostgreSQL** with **Drizzle ORM**, providing strict ACID guarantees, `DECIMAL` monetary precision, and automatic schema migration on startup (`src/db/index.ts`).

```
┌────────────────────────────────────────────────────────────────────────┐
│                          APPLICATION TIER                              │
│                                                                        │
│   Express.js Controllers ◄───► Domain Services                         │
│   (Investment, Binance, Subscription, Wallet, Transaction, Debt,       │
│    CategoryBudget, Goal, Context, Payroll, UserManagement, Settings)   │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Drizzle ORM (pg.Pool)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        POSTGRESQL DATABASE                             │
│                                                                        │
│   - 16 Relational Tables with Foreign Key Constraints & Cascades       │
│   - Custom ENUMs: transaction_type, wallet_type, debt_type,            │
│     debt_status, financial_context_type, financial_context_status      │
│   - Full SQL Dump & Restore Engine + Google Drive Backup Scheduler     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. PostgreSQL Custom ENUM Types

```sql
CREATE TYPE transaction_type AS ENUM ('Income', 'Expense', 'Transfer', 'Debt Repayment');
CREATE TYPE wallet_type AS ENUM ('Bank', 'Cash', 'Savings', 'Investment');
CREATE TYPE debt_type AS ENUM ('Receivable', 'Payable');
CREATE TYPE debt_status AS ENUM ('Pending', 'Cleared');
CREATE TYPE financial_context_type AS ENUM ('Trip', 'Work / Mission', 'Project', 'Life Event', 'Other');
CREATE TYPE financial_context_status AS ENUM ('Planned', 'Active', 'Completed');
```

---

## 3. Complete Table Inventory (34 Relational Tables)

| # | Table Name | Primary Domain Role |
| :- | :--- | :--- |
| **1** | `users` | User identity, RBAC role (`owner`/`admin`/`manager`/`member`/`viewer`), workspace mode (`shared`/`isolated`), payday, salary, emergency buffer, and Google Drive backup config |
| **2** | `user_audit_logs` | Immutable security audit trail of administrative user management actions |
| **3** | `wallets` | Multi-wallet accounts (`Bank`, `Cash`, `Savings`, `Investment`, `CreditCard`, `Overdraft`) with institution metadata, currency, credit limits, and statement/due days |
| **4** | `stock_positions` | US, Global, ETF, and Casablanca BVC stock holdings & watchlist positions (`ticker`, `sector`, `shares`, `avg_cost_per_share`, `current_price`, `annual_dividend_per_share`) |
| **5** | `stock_orders` | Execution ledger for `BUY`, `SELL`, and `DIVIDEND` stock orders with realized P&L and wallet sync |
| **6** | `subscriptions` | Recurring bills and multi-month commitments (`every_3_months`, `quarterly`, `every_2_months`, `every_6_months`, `monthly`, `yearly`, `weekly`, `biweekly`) |
| **7** | `transactions` | Core cash-flow ledger (`Income`, `Expense`, `Transfer`, `Debt Repayment`) with historical FX locking (`currency`, `native_amount`, `exchange_rate_used`, `fx_source`), `idempotency_key`, and reconciliation status |
| **8** | `splits` | Reimbursable shared-expense splits linked to transactions and debt counterparties |
| **9** | `debts` | Counterparty `Receivable` and `Payable` obligations with installment plans, APR/rate type, fees, and counterparty classification |
| **10** | `payrolls` | Dated salary inflows anchoring custom financial month boundaries with expected vs. confirmed status, actual receipt date/amount, and linked income transaction |
| **11** | `category_budgets` | Monthly category spending limits (`UNIQUE(user_id, category, year, month)`) with `rollover_enabled`, `carryover_amount`, and `alert_threshold_percent` |
| **12** | `goals` | Savings milestones with deadlines, `auto_sync_balance`, `funding_mode` (`manual`, `mirrored_wallet`, `allocated_slice`), and `allocated_amount` |
| **13** | `financial_contexts` | Event/project/trip containers for grouping contextual spending |
| **14** | `push_subscriptions` | Web Push VAPID browser/PWA endpoints |
| **15** | `notification_preferences` | Per-user alert rules, delivery times, timezone, and quiet hours |
| **16** | `notification_deliveries` | Idempotency log (`UNIQUE(user_id, type, scheduled_for)`) preventing duplicate notifications *(plus `notification_devices`)* |
| **17** | `journal_entries` | Immutable double-entry accounting headers (`transaction_id`, `entry_type`, `status`, `reversal_of_entry_id`) |
| **18** | `journal_lines` | Balanced double-entry debit/credit lines (`entry_id`, `wallet_id`, `account_code`, `debit_mad`, `credit_mad`, `native_currency`, `exchange_rate`) |
| **19** | `exchange_rates` | Historical FX rates ledger (`rate_date`, `base_currency`, `quote_currency`, `rate`, `source`) |
| **20** | `statement_import_batches` | Bank/card CSV/TSV import batch telemetry (`wallet_id`, `file_name`, `file_hash`, `total_rows`, `imported_rows`, `duplicate_rows`) |
| **21** | `statement_import_rows` | Individual parsed bank statement rows with confidence scoring, duplicate detection, and matched transaction link |
| **22** | `financial_review_items` | Persistent review inbox for OCR receipts, voice captures, statement imports, and anomaly flags |
| **23** | `commitment_occurrences` | Unified dated billing & obligation ledger across subscriptions, debts, and payrolls (`expected`, `paid`, `skipped`, `overdue`, `rescheduled`) |
| **24** | `goal_contribution_events` | Immutable audit history of goal contributions, withdrawals, wallet auto-syncs, and manual adjustments |
| **25** | `saved_scenarios` | Persisted What-If simulation configurations and comparison results (`income_drop`, `subscription_trim`, `debt_payoff`, `stock_crash`, `major_purchase`, `composite`) |
| **26** | `financial_rules` | User-defined deterministic IF/THEN automation rules (`transaction_created`, `salary_confirmed`, `subscription_due`) |
| **27** | `financial_rule_logs` | Execution audit trail for automated financial rules |
| **28** | `external_wealth_items` | Non-bank net worth assets & liabilities (`RealEstate`, `Vehicle`, `Retirement`, `PrivateEquity`, `PreciousMetals`, `BusinessOwnership`, `OtherAsset`, `OtherLiability`) |
| **29–34** | `market_data_*` & `portfolio_*` | `market_data_symbols`, `market_data_daily_bars`, `market_data_usage`, `portfolio_daily_snapshots`, `investment_dividend_events`, and `investment_settings` |

---

## 4. Detailed Specifications for Core Audit, Investment, Wallet & Subscription Tables

### 4.1. `stock_positions` (Equities & ETF Holdings Ledger)
Stores local and synced US, Global, ETF, and Casablanca BVC stock positions.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | **No** | `gen_random_uuid()` | **PRIMARY KEY** |
| `user_id` | `uuid` | **No** | — | **FOREIGN KEY** $\rightarrow$ `users(id) ON DELETE CASCADE` |
| `wallet_id` | `uuid` | Yes | `NULL` | **FOREIGN KEY** $\rightarrow$ `wallets(id) ON DELETE SET NULL` |
| `ticker` | `text` | **No** | — | Normalized stock symbol (e.g., `ORCL`, `NVDA`, `JPM`, `USAR`, `VOO`, `ATW`) |
| `company_name` | `text` | **No** | — | Full canonical corporate name (e.g., `JPMorgan Chase & Co.`) |
| `market` | `text` | **No** | `'US'` | Market classification: `'US'`, `'ETF'`, `'BVC'`, or `'GLOBAL'` |
| `sector` | `text` | **No** | `'Technology'` | Canonical 8-sector category (resolved dynamically via `stockCategories.ts`) |
| `shares` | `decimal` | **No** | `'0'` | Quantity of shares held (supports fractional shares up to 6 decimals) |
| `avg_cost_per_share` | `decimal` | **No** | `'0'` | Weighted average entry price per share in native currency |
| `current_price` | `decimal` | **No** | `'0'` | Latest market price per share in native currency |
| `currency` | `text` | **No** | `'USD'` | Native quote currency (`'USD'`, `'MAD'`, `'EUR'`) |
| `annual_dividend_per_share` | `decimal` | **No** | `'0'` | Annual cash dividend paid per share |
| `target_weight_percent` | `decimal` | **No** | `'0'` | Target portfolio allocation weight (`0`–`100`) |
| `conviction_thesis` | `text` | Yes | `NULL` | Investment thesis and notes |
| `is_watchlist_only` | `boolean` | **No** | `false` | `true` if tracked on watchlist with `0` shares |
| `created_at` / `updated_at` | `timestamp` | **No** | `NOW()` | Creation and modification timestamps |

### 4.2. `stock_orders` (Stock Execution & Dividend History)
Captures every `BUY`, `SELL`, and `DIVIDEND` event tied to a stock position.

| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | **No** | `gen_random_uuid()` | **PRIMARY KEY** |
| `user_id` | `uuid` | **No** | — | **FOREIGN KEY** $\rightarrow$ `users(id) ON DELETE CASCADE` |
| `position_id` | `uuid` | **No** | — | **FOREIGN KEY** $\rightarrow$ `stock_positions(id) ON DELETE CASCADE` |
| `wallet_id` | `uuid` | Yes | `NULL` | **FOREIGN KEY** $\rightarrow$ `wallets(id) ON DELETE SET NULL` |
| `linked_transaction_id` | `uuid` | Yes | `NULL` | **FOREIGN KEY** $\rightarrow$ `transactions(id) ON DELETE SET NULL` |
| `action` | `text` | **No** | — | `'BUY'`, `'SELL'`, or `'DIVIDEND'` |
| `shares` | `decimal` | **No** | `'0'` | Number of shares bought or sold |
| `price_per_share` | `decimal` | **No** | `'0'` | Execution price per share in native currency |
| `total_native_amount` | `decimal` | **No** | — | Total order value in native currency (`USD`/`MAD`) |
| `total_mad_amount` | `decimal` | **No** | — | Total order value converted to `MAD` |
| `exchange_rate_used` | `decimal` | **No** | `'1'` | FX rate (`USD/MAD`) applied at execution |
| `realized_pnl_mad` | `decimal` | **No** | `'0'` | Realized capital gain/loss or dividend cash flow in `MAD` |
| `notes` | `text` | Yes | `NULL` | Execution notes |
| `executed_at` | `timestamp` | **No** | `NOW()` | Execution timestamp |

### 4.2.1. Market Data Cache & Investment Intelligence Tables
- **`market_data_symbols`**: Canonical instrument metadata (`symbol` PK, `raw_held_symbol`, `underlying_symbol`, `instrument_type`, `exchange`, `country`, `sector`, `currency`, `provider`).
- **`market_data_daily_bars`**: Persistent daily OHLCV time-series cache (`symbol`, `bar_date`, `open`, `high`, `low`, `close`, `volume`, `currency`, `provider`, `is_adjusted`, unique index on `(symbol, bar_date)`).
- **`market_data_usage`**: Atomic Twelve Data credit governance ledger (`utc_date`, `utc_minute`, `provider`, `endpoint`, `credit_weight`, `symbols_count`, `credits_reserved`, `credits_used_header`, `credits_left_header`, `status`).
- **`portfolio_daily_snapshots`**: Daily end-of-day portfolio valuation snapshots (`user_id`, `snapshot_date`, `total_market_value_mad`, `investment_cash_mad`, `net_contributions_mad`, `cost_basis_mad`, `unrealized_pnl_mad`, `realized_pnl_mad`, `dividends_received_mad`, `positions_json`, unique index on `(user_id, snapshot_date)`).
- **`investment_dividend_events`**: Dividend calendar and cash-flow ledger (`id`, `user_id`, `position_id`, `ticker`, `declaration_date`, `ex_dividend_date`, `record_date`, `payment_date`, `dividend_per_share`, `eligible_shares`, `gross_amount`, `withholding_tax`, `fee_amount`, `net_amount`, `net_amount_mad`, `status`, `source`).
- **`investment_settings`**: Per-user investment analytics configuration (`user_id` unique, `reporting_currency`, `selected_benchmarks`, `risk_free_rate_percent`, `manual_usd_mad_rate`, `twelve_data_display_approved`, `target_allocations_json`, `goals_json`).

### 4.3. `wallets` (Multi-Wallet Liquidity, Credit Card Liabilities & Investment Accounts)
| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | **No** | `gen_random_uuid()` | **PRIMARY KEY** |
| `user_id` | `uuid` | **No** | — | **FOREIGN KEY** $\rightarrow$ `users(id)` |
| `name` | `text` | **No** | — | Unique per user (`UNIQUE(user_id, name)`), e.g., `'Main Bank'`, `'Cash'`, `'Savings'`, `'Investment'` |
| `type` | `wallet_type` | **No** | — | Enum: `'Bank'`, `'Cash'`, `'Savings'`, `'Investment'` |
| `account_subtype` | `text` | **No** | `'Checking'` | `'Checking'`, `'Cash'`, `'Savings'`, `'Investment'`, `'CreditCard'`, `'Overdraft'` |
| `institution_name` | `text` | Yes | `NULL` | Financial institution or card issuer name |
| `currency` | `text` | **No** | `'MAD'` | Native account currency (`'MAD'`, `'USD'`, `'EUR'`) |
| `credit_limit` | `decimal` | **No** | `'0'` | Credit card or overdraft limit (never counted as liquid cash) |
| `statement_closing_day` | `integer` | Yes | `NULL` | Monthly statement closing day (`1`–`31`) |
| `payment_due_day` | `integer` | Yes | `NULL` | Monthly payment due day (`1`–`31`) |
| `is_archived` | `boolean` | **No** | `false` | Soft archive flag |
| `is_main` | `boolean` | **No** | `false` | Indicates primary default wallet for category type |
| `initial_balance` | `decimal` | **No** | `'0'` | Opening baseline balance |
| `current_balance` | `decimal` | **No** | `'0'` | Cached current balance |

### 4.4. `subscriptions` (Recurring & 3-Month Commitments)
| Column | Type | Nullable | Default | Description |
| :--- | :--- | :---: | :--- | :--- |
| `id` | `uuid` | **No** | `gen_random_uuid()` | **PRIMARY KEY** |
| `user_id` | `uuid` | **No** | — | **FOREIGN KEY** $\rightarrow$ `users(id) ON DELETE CASCADE` |
| `name` | `text` | **No** | — | Service or commitment name (e.g., `'Gym Membership'`, `'Car Insurance'`) |
| `amount` | `decimal` | **No** | — | Billing amount per cycle |
| `currency` | `text` | **No** | `'MAD'` | `'MAD'`, `'USD'`, or `'EUR'` |
| `billing_cycle` | `text` | **No** | `'monthly'` | `'every_3_months'`, `'quarterly'`, `'every_2_months'`, `'every_6_months'`, `'monthly'`, `'yearly'`, `'weekly'`, `'biweekly'` |
| `category` | `text` | **No** | `'Subscriptions & Streaming'` | Expense category |
| `wallet_id` | `uuid` | Yes | `NULL` | **FOREIGN KEY** $\rightarrow$ `wallets(id) ON DELETE SET NULL` |
| `next_billing_date` | `timestamp` | Yes | `NULL` | Next scheduled renewal date |
| `status` | `text` | **No** | `'active'` | `'active'`, `'planned'`, `'paused'`, `'reviewing'`, `'cancelled'` |
| `icon` / `website_url` / `notes` | `text` | Yes | `NULL` | Visual icon, URL, and notes |

### 4.5. Double-Entry Accounting & Core Audit Tables (`journal_entries`, `journal_lines`, `financial_review_items`, `commitment_occurrences`)
- **Double-Entry Invariant**: Every posted `journal_entries` record requires `SUM(debit_mad) == SUM(credit_mad)` across its `journal_lines`. Updating or deleting a transaction posts an immutable reversal entry (`entry_type = 'reversal'`) before posting the replacement entry.
- **Historical FX Rate Locking**: Every transaction stores `currency`, `native_amount`, `exchange_rate_used`, and `fx_source` at creation time so historical periods never drift when live FX rates fluctuate.
- **Expected vs. Confirmed Payrolls**: `payrolls` tracks `status` (`expected` | `confirmed` | `missed`), `expected_amount`, `actual_amount`, `received_at`, and `linked_transaction_id`. Scheduled payrolls never fabricate cash until explicitly confirmed via `POST /api/payrolls/:id/confirm`.

---

## 5. Canonical Category System

Transactions and category budgets use 15 canonical expense categories plus 3 system cash-flow categories:
- **Expense Categories (15)**: `🏠 Housing & Utilities`, `🛒 Groceries`, `🍔 Dining & Takeaway`, `☕ Coffee & Quick Food`, `🚗 Transportation`, `📱 Telecom & Subscriptions`, `🩺 Health & Medical`, `👕 Personal & Clothing`, `🎬 Entertainment`, `👥 Social`, `👨‍👩‍👦 Family & Gifts`, `📚 Education & Development`, `💳 Debt & Obligations`, `💰 Savings & Goals`, `🚨 Unexpected`.
- **System Categories (3)**: `📥 Income`, `🔄 Transfer`, `📦 Miscellaneous`.

---

## 6. Database Operations & Maintenance (Schema v2.0 Backup Engine)

- **Full-Schema v2.0 SQL Dump Export (`GET /api/settings/export-sql`)**: Generates a complete, transactional `.sql` backup script across all 24 user-data tables in topological dependency order with `-- Schema-Version: 2.0`, `-- Checksum-SHA256`, and `-- Manifest-JSON` headers.
- **Non-Destructive Backup Validation Preview (`POST /api/settings/validate-backup`)**: Parses and verifies backup headers, SHA-256 checksums, and per-table row counts before executing any destructive restore.
- **Atomic SQL Restore (`POST /api/settings/import-sql`)**: Validates header integrity, acquires `ACCESS EXCLUSIVE` table locks, and restores data inside a single `BEGIN ... COMMIT` block.
- **Automated Google Drive Backups**: `NotificationScheduler.ts` checks eligibility every 15 minutes (`daily`, `3days`, `weekly`) and uploads encrypted multipart `.sql` dumps to Google Drive.
