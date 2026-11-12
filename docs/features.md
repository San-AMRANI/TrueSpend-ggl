# TrueSpend Features Guide

TrueSpend is a full-stack personal finance, multi-wallet wealth management, subscription intelligence, and stock/crypto portfolio platform tailored around custom pay cycles and AI-assisted financial decision-making.

---

## 1. Stocks, Funding Equities & Spot Crypto Portfolio (`Investments`)

TrueSpend features a dual-engine investment suite that strictly separates **US & Global Stocks (Funding Wallet & Local Equities)** from **Spot Cryptocurrencies**. For a complete deep-dive into the categorization pipeline, formulas, and APIs, see **[TrueSpend Stocks, Funding Equities & Investments Architecture](stocks-and-investments.md)**.

### 1.1. US & Global Stocks Dashboard (`FundingStocksDashboard.tsx`)
- **Strict Asset Isolation**: Tracks US equities, global stocks, Casablanca Stock Exchange (`BVC`) holdings, and ETFs separately from 24/7 cryptocurrency volatility. Automatically filters out `< $0.05` delisted crypto dust (such as `NEBL` and `WTC`).
- **8-Sector Auto-Categorization Engine (`src/lib/stockCategories.ts`)**:
  - Automatically classifies 650+ stock tickers—including Binance `EQ*` tokenized equities (`EQORCL` $\rightarrow$ `ORCL`, `EQNVDA` $\rightarrow$ `NVDA`, `EQJPM` $\rightarrow$ `JPM`, `EQUSAR` $\rightarrow$ `USAR`)—into 8 canonical sectors:
    1. **AI & Semiconductors** (`NVDA`, `AMD`, `AVGO`, `TSM`, `ASML`, `PLTR`, `ARM`, `MU`)
    2. **Technology & Cloud** (`ORCL`, `MSFT`, `AAPL`, `GOOGL`, `META`, `CRM`, `NOW`, `CRWD`)
    3. **Mechanics, Automotive & Industrials** (`USAR`, `TSLA`, `CAT`, `DE`, `GE`, `HON`, `LMT`, `MP`)
    4. **Banking & Financials** (`JPM`, `V`, `MA`, `BAC`, `GS`, `MS`, `BRK.B`, `ATW`, `BCP`)
    5. **Consumer & Retail** (`AMZN`, `WMT`, `COST`, `HD`, `KO`, `PEP`, `MCD`, `NKE`)
    6. **Healthcare & Biotech** (`LLY`, `UNH`, `JNJ`, `ABBV`, `NVO`, `ISRG`, `MRK`, `TMO`)
    7. **Energy, Utilities & Real Estate** (`XOM`, `CVX`, `NEE`, `CEG`, `O`, `PLD`, `AMT`, `TQM`)
    8. **Index & Dividend ETFs** (`VOO`, `SPY`, `QQQ`, `VTI`, `SCHD`, `JEPI`, `JEPQ`, `SMH`)
  - **Live Yahoo Finance Sector Fallback**: Any ticker not in the built-in 650+ dictionary is automatically queried against Yahoo Finance's `/v1/finance/search` API to retrieve its live sector, industry, and company name.
- **Category Dominance & Smart Insights**:
  - Live stacked allocation bar and 8 interactive category cards showing which stock sector represents the highest percentage of the portfolio.
  - Automated plain-English insights for sector concentration, Funding vs. Spot separation, top stock performer after fees, and dividend compounding.
- **Breakeven Share Price & Fee Drag Forensics**:
  - Computes exact entry + exit brokerage fee drag (`0.10%` per leg) and displays the exact **Breakeven Share Price** on every stock card so users never sell at a hidden net loss.
- **Dividend Yield & 5-Year DRIP Trajectory**:
  - Tracks annual and monthly passive dividend income in USD and MAD, portfolio-weighted yield %, and a 5-year dividend reinvestment (DRIP) projection.
- **Interactive Stock Profit & Fee Simulator**:
  - Simulates hypothetical investments (`$25`–`$1,000+`), target price moves (`-20%` to `+100%`), holding periods (`1`–`60` months), round-trip fees, and dividend payouts.

### 1.2. Spot Cryptocurrency & Binance Read-Only Terminal (`InvestmentsTab.tsx`)
- **Ed25519 Signed Read-Only Sync**: Connects to Binance Spot, Funding, and Simple Earn APIs using server-side Ed25519 cryptographic signatures without withdrawal or trading permissions.
- **Personal Trade Forensics**: Fetches historical fills (`/api/investments/binance/trades`), computing weighted average buy/sell prices, realized vs. unrealized P&L, and commission fee drag.
- **Brokerage Capital Flows**: One-click wallet synchronization (`/api/investments/binance/sync-wallet`), capital transfer logging (`deposit` / `withdrawal`), and payday batch stock allocation (`/api/investments/payday-allocate`).

---

## 2. Subscriptions & Recurring Bills Hub (`SubscriptionsTab.tsx`)

Enhanced specifically for multi-month commitments (such as **Every 3 Months** gym memberships, car/health insurance, and bi-monthly utilities) alongside standard monthly and yearly subscriptions:

- **First-Class Multi-Month Billing Cycles**:
  - **Every 3 Months (`every_3_months` / `quarterly`)**: Dedicated 3-month cycle tracking with normalized monthly burn (`amount / 3`), daily cost, and 90-day renewal countdowns.
  - **Every 2 Months (`every_2_months`)** & **Every 6 Months (`every_6_months`)**: Bi-monthly and semi-annual support.
  - **Weekly, Bi-Weekly, Monthly & Yearly**: Full cycle normalization into MAD (`USD` and `EUR` auto-converted).
- **Quick-Add Templates**: Built-in presets for **Gym & Fitness (3 Months)**, **Car / Health Insurance (3 Months)**, Cloud/AI subscriptions, Streaming, and Telecom.
- **Smart Auto-Detection (`/api/subscriptions/detect`)**: Scans historical transactions to detect recurring merchant charges and suggests billing cycles automatically.
- **Planned vs. Active Commitments**: Simulate upcoming subscriptions (e.g., a planned 3-month gym membership) with a toggle to preview their impact on Safe-to-Spend before activating.
- **One-Click Payment Logging (`/api/subscriptions/:id/pay`)**: Logs the expense transaction, deducts from the linked wallet, and advances `nextBillingDate` by the exact cycle interval (`+3 months`, `+1 month`, etc.).

---

## 3. Core Financial & Cash Flow Features

### 3.1. Dashboard, Custom Pay Cycles & Historical Financial Periods
- **Custom Payday Financial Months**: Financial cycles reset on the user's actual payday (or calendar-scheduled `payrolls` dates) rather than the 1st of the calendar month.
- **Expected vs. Confirmed Payroll Verification (`FinancialCalendarTab.tsx`)**: Scheduled payrolls remain `expected` until explicitly confirmed by the user (`POST /api/payrolls/:id/confirm`) with actual amount and receipt date—never fabricating cash prematurely.
- **Historical Financial Periods Ledger (`cashFlowEngine.ts`)**: Reconciles opening liquidity, salary income, other income, gross outflow, net living expenses, reimbursable splits, debt repayments, investment deployments, and closing liquidity across every historical pay cycle.
- **Multi-Wallet & Credit Card Liability Separation (`WalletsManager.tsx`)**: Manage `Checking`, `Cash`, `Savings`, `Investment`, `CreditCard`, and `Overdraft` accounts with institution metadata, native currency (`MAD`, `USD`, `EUR`), credit limits, statement closing days, and payment due days. Credit card balances and limits are strictly isolated as liabilities so credit headroom is never mistaken for liquid cash.
- **Double-Entry Journal, Statement CSV Import & Review Inbox (`WalletsManager.tsx`)**:
  - **Double-Entry Accounting Ledger**: Every transaction posts balanced debit/credit lines (`journal_entries` & `journal_lines`), and edits/deletes post immutable reversal entries.
  - **Bank/Card Statement CSV Import**: Upload CSV/TSV statements with SHA-256 deduplication, confidence-scored transaction matching, and one-click reconciliation.
  - **Persistent Review Inbox**: Captures OCR receipt scans, voice dictations, statement rows, and anomaly alerts in `financial_review_items` until reviewed.
  - **External Wealth & Historical FX Rates**: Track non-bank assets/liabilities (`RealEstate`, `Vehicle`, `Retirement`, `PrivateEquity`, etc.) and lock historical exchange rates per transaction.
- **Unified Commitment Occurrences Ledger (`FinancialCalendarTab.tsx`)**: Synchronizes subscriptions, debt installments, and payrolls into dated `commitment_occurrences` with `expected`, `paid`, `skipped`, `overdue`, and `rescheduled` lifecycle tracking.
- **Forecast Calibration & Saved What-If Scenarios (`PredictiveForecastTab.tsx` & `CalculatorsHubTab.tsx`)**: Displays model confidence, historical cycles analyzed, backtest MAPE %, and data freshness timestamps, plus persistent side-by-side comparison of saved What-If scenarios (`saved_scenarios`).
- **Financial Contexts / Projects (`ContextsTab.tsx`)**: Group transactions under specific trips, work missions, projects, or life events with dedicated context budgets.
- **Cycle Retrospectives (`ReportsTab.tsx`)**: AI-assisted and deterministic end-of-cycle financial retrospectives comparing cycle-over-cycle savings rates and category drift.

### 3.2. Advanced Budgeting Strategies (`BudgetsTab.tsx`)
1. **Category View**: Granular monthly limits across the 15 canonical expense categories with rollover support (`rolloverEnabled`, `carryoverAmount`).
2. **Envelope View**: Cash-envelope tracking emphasizing remaining spendable balance.
3. **50/30/20 Rule View**: Customizable macro allocation across Needs, Wants, and Savings/Investments.
4. **SPEX AI Pattern-Driven Auto-Budget**: Analyzes all historical financial periods (net of linked reimbursements) and optional user notes for next month to generate a personalized budget plan.
- **Batch Utilities**: Batch upsert (`/api/category-budgets/batch`), copy previous financial month (`/api/category-budgets/copy-previous`), and clear month.

### 3.3. Debts, Installment Plans & Shared Expense Splits (`DebtsTab.tsx`)
- Track **Receivables** (money owed to the user) and **Payables** (money the user owes) with APR/interest rate, installment frequency, fees, and early-settlement interest savings calculation.
- **Shared Transaction Splits (`splits`) & Net Reimbursement Accounting**: Deducts reimbursable portions and linked debt reimbursements from gross bills so personal burn rate and income metrics only reflect net expenses and true income.
- **Partial Bill Telemetry**: Log partial payments on expenses while automatically tracking the unpaid remainder.

### 3.4. Savings Goals, Allocation Modes & Event History (`GoalsTab.tsx`)
- Create milestone targets with deadlines, priority tags, explicit `fundingMode` (`manual`, `mirrored_wallet`, or `allocated_slice` to prevent multiple goals from double-counting the same Savings wallet), and an immutable `goal_contribution_events` audit log.

---

## 4. SPEX AI Copilot & Interactive Mascot Companion

### 4.1. Agentic AI Financial Copilot (`ai.md`)
- Powered by live financial context injection (`src/lib/aiContext.ts`) covering KPIs, historical payroll cycles, active subscriptions, debt positions, and live stock/crypto holdings.
- **Human-in-the-Loop Action Gateway & Pre-Execution Simulation (`AiActionGateway.ts`)**: Proposes structured actions (`create_transaction`, `create_debt`, `upsert_budget`, `create_goal`, `contribute_goal`, `settle_debt`, `update_settings`, `buy_stock`, `record_dividend`, `confirm_payroll`) with a **Simulate Impact** preview showing exact Before $\rightarrow$ After deltas on Liquidity, Safe-to-Spend, Daily Allowance, and Runway Days before execution.
- **Multimodal Input**: Client-side receipt OCR (`Tesseract.js`), deterministic receipt parser (`/api/receipts/parse`) persisted automatically to the Financial Review Inbox, and voice dictation.

### 4.2. Interactive SPEX Sprite Animator (`SpexSpriteAnimator.tsx` & `SpexCompanionWidget.tsx`)
- High-resolution WebP/PNG spritesheet animation engine (`SPEX-spritesheet-v2.webp`) supporting 9 choreographed animation rows (`idle`, `running-right`, `running-left`, `waving`, `jumping`, `failed`, `waiting`, `running`, `review`) plus **16-angle 360° cursor gaze tracking** (`look 000-157.5` and `look 180-337.5`).
- Transparent theme-adaptive 3D avatars (`SpexAvatar.tsx`) that harmonize with all 12 light and dark themes.

---

## 5. Multi-User RBAC, Automation Rules, Cloud Backups & Offline Outbox

- **Role-Based Access Control (`UserManagementTab.tsx`)**: Supports `owner`, `admin`, `manager`, `member`, and `viewer` roles, `shared` vs. `isolated` workspace modes, granular permissions, user impersonation (`/api/users/:id/impersonate`), and audit logging (`user_audit_logs`).
- **Automated Financial Rules Engine (`SettingsTab.tsx`)**: Create deterministic IF/THEN rules triggered by `transaction_created`, `salary_confirmed`, or `subscription_due` to auto-categorize, link contexts, or allocate funds to goals.
- **Full-Schema v2.0 SQL Backups & Validation Preview**: Full 24-table PostgreSQL `.sql` dump export/import (`/api/settings/export-sql`, `/api/settings/import-sql`), non-destructive backup preview (`/api/settings/validate-backup`), and scheduled Google Drive backups (`daily`, `3days`, `weekly`).
- **Offline Outbox & Capacitor 8 Native Android App (`offlineOutbox.ts` & `ANDROID_CAPACITOR.md`)**: Queues draft transactions offline with `idempotencyKey` deduplication and auto-flushes on network reconnect, paired with the native Android WebView bridge (`capacitorBridge.ts`).
