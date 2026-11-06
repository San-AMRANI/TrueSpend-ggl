# TrueSpend REST API Reference

This document outlines the complete REST API exposed by the TrueSpend Express server (`server/routes/index.ts`). Protected routes require authentication via Firebase Auth or session JWT tokens passed in the `Authorization: Bearer <token>` header.

---

## 1. Health & Native APK Distribution

### `GET /api/health`
- **Description**: Health check endpoint verifying Express server availability.
- **Returns**: `{ "status": "ok" }`

### `GET /api/download-apk`
- **Description**: Streams the compiled Android debug/release APK (`TrueSpend.apk`) with MIME type `application/vnd.android.package-archive`.

---

## 2. Authentication & Session Management (`authRoutes.ts`)

### `POST /api/login`
- **Description**: Authenticates a user (via Firebase token or username/password credentials) and initializes their PostgreSQL user record and default wallets (`Main Bank`, `Cash`, `Savings`, `Investment`).
- **Body**: `{ "email": "user@example.com", "username": "optional", "password": "optional" }`

### `GET /api/auth/me`
- **Description**: Returns the currently authenticated user profile, role, workspace mode, granular `UserPermissions`, and active impersonation metadata.

---

## 3. Stocks, Funding Equities & Investments (`investmentRoutes.ts`)

All `/api/investments*` endpoints enforce `requireAuth`, RBAC (`canAccessInvestments`), and strict `Cache-Control: private, no-store` headers. For full architectural details, see **[Stocks, Funding Equities & Investments Architecture](stocks-and-investments.md)**.

### `GET /api/investments`
- **Description**: Returns the unified investment portfolio state, including:
  - `positions`: Enriched stock & ETF holdings (both local PostgreSQL `stock_positions` and auto-imported Binance `EQ*` Funding equities) with canonical 8-sector classification (`AI & Semiconductors`, `Technology & Cloud`, `Mechanics, Automotive & Industrials`, `Banking & Financials`, `Consumer & Retail`, `Healthcare & Biotech`, `Energy, Utilities & Real Estate`, `Index & Dividend ETFs`), live Yahoo Finance quotes, breakeven share price, fee drag, and dividend yields.
  - `orders`: Historical `BUY`, `SELL`, and `DIVIDEND` orders.
  - `binance`: Read-only Binance Spot, Funding, and Simple Earn overview (`spotEquityMad`, `stockEquityMad`, `cryptoEquityMad`, `stablecoinDryPowderMad`, `totalFundingValueMad`, `totalEarnValueMad`, and itemized `balances`).
  - `analytics`: Health score, sector allocation weights, top movers, and 5-year DRIP dividend projections.
  - `catalog`: Curated US, Global, ETF, and Casablanca Stock Exchange (`BVC`) stock catalog.
- **Query Params**:
  - `refresh=true` *(optional)*: Bypasses the 25-second Binance/quote cache for a fresh live sync.

### `GET /api/investments/stocks/search`
- **Description**: Searches for stocks and ETFs across the curated catalog (`US`, `ETF`, `BVC`) and live Yahoo Finance search API, automatically mapping each result into its canonical TrueSpend stock category.
- **Query Params**: `q=<ticker_or_company_name>` (e.g., `?q=USAR`, `?q=NVDA`, `?q=JPM`)

### `GET /api/investments/binance/account`
- **Description**: Performs a read-only Ed25519-signed sync against Binance Spot (`/api/v3/account`), Funding (`/sapi/v1/asset/get-funding-asset`), and Simple Earn (`/sapi/v1/simple-earn/*`), enriched with Yahoo Finance live stock quotes for `EQ*` tokenized equities.
- **Query Params**: `refresh=true` *(optional)*

### `GET /api/investments/binance/trades`
- **Description**: Fetches personal Binance execution history (`/api/v3/myTrades`) for a specific pair and computes weighted average buy/sell prices, realized P&L, net P&L after fees, and total commission drag in USD and MAD.
- **Query Params**:
  - `symbol` *(required)*: Trading pair or ticker (e.g., `BTCUSDT`, `SOLUSDT`, `NVDAUSDT`).
  - `limit` *(optional)*: Max fills to return (default `100`, max `500`).
  - `refresh=true` *(optional)*: Force fresh fetch from Binance.

### `POST /api/investments/binance/sync-wallet`
- **Description**: Synchronizes the user's local TrueSpend `Investment` wallet balance with their live Binance balance (`stablecoins_only` or `full_spot_balance`).
- **Body**: `{ "walletId": "<uuid>", "mode": "full_spot_balance" | "stablecoins_only" }`

### `POST /api/investments/wallet-transfer`
- **Description**: Logs a capital deposit or withdrawal between a Bank/Cash wallet and an Investment wallet.
- **Body**:
  ```json
  {
    "direction": "deposit",
    "bankWalletId": "<uuid>",
    "investmentWalletId": "<uuid>",
    "amountMad": 2500,
    "notes": "Monthly brokerage funding"
  }
  ```

### `POST /api/investments/positions`
- **Description**: Creates or updates a stock/ETF position or watchlist item. Automatically normalizes the ticker (e.g., `EQNVDA` $\rightarrow$ `NVDA`) and assigns its canonical sector.
- **Body**:
  ```json
  {
    "ticker": "NVDA",
    "companyName": "NVIDIA Corporation",
    "market": "US",
    "sector": "AI & Semiconductors",
    "shares": 2.5,
    "avgCostPerShare": 118.50,
    "currentPrice": 138.60,
    "currency": "USD",
    "annualDividendPerShare": 0.04,
    "targetWeightPercent": 25,
    "convictionThesis": "Core AI data center GPU leader",
    "isWatchlistOnly": false,
    "walletId": "<optional_wallet_uuid>",
    "syncWithWallet": false
  }
  ```

### `PUT /api/investments/positions/:id`
- **Description**: Updates an existing stock position's shares, average cost, current price, target weight, sector, or conviction thesis.

### `DELETE /api/investments/positions/:id`
- **Description**: Deletes a stock position and its associated local order history.

### `POST /api/investments/orders`
- **Description**: Executes a `BUY`, `SELL`, or `DIVIDEND` order on a stock position, recalculating weighted average cost or realized P&L and optionally syncing the cash impact with a TrueSpend wallet.
- **Body**:
  ```json
  {
    "positionId": "<uuid>",
    "ticker": "JPM",
    "action": "BUY",
    "shares": 1.5,
    "pricePerShare": 235.40,
    "walletId": "<optional_wallet_uuid>",
    "syncWithWallet": true,
    "notes": "Added banking exposure"
  }
  ```

### `DELETE /api/investments/orders/:id`
- **Description**: Deletes a stock order record by ID.

### `POST /api/investments/payday-allocate`
- **Description**: Executes a batch payday allocation across multiple stock positions in a single atomic operation.
- **Body**:
  ```json
  {
    "walletId": "<uuid>",
    "syncWithWallet": true,
    "allocations": [
      { "positionId": "<uuid_1>", "amountMad": 1000 },
      { "positionId": "<uuid_2>", "amountMad": 1000 }
    ]
  }
  ```

### `POST /api/investments/fund-wallet`
- **Description**: Transfers capital from a source wallet (e.g., `Main Bank`) to an `Investment` wallet and records a `Transfer` transaction.

---

## 4. Subscriptions & Recurring Commitments (`subscriptionRoutes.ts`)

### `GET /api/subscriptions`
- **Description**: Retrieves all recurring subscriptions and multi-month bills (`monthly`, `every_2_months`, `every_3_months`, `quarterly`, `every_6_months`, `yearly`, `weekly`, `biweekly`).

### `GET /api/subscriptions/detect`
- **Description**: Scans the user's transaction history to auto-detect recurring charges and suggest billing cycles (`every_3_months`, `monthly`, etc.).

### `POST /api/subscriptions`
- **Description**: Creates a new subscription or recurring commitment (supports `active`, `planned`, `paused`, `reviewing`, `cancelled`).
- **Body**:
  ```json
  {
    "name": "Gym Membership (3 Months)",
    "amount": 900,
    "currency": "MAD",
    "billingCycle": "every_3_months",
    "category": "🩺 Health & Medical",
    "walletId": "<uuid>",
    "nextBillingDate": "2027-02-01T00:00:00Z",
    "status": "active",
    "icon": "🏋️",
    "notes": "Paid every 3 months"
  }
  ```

### `PUT /api/subscriptions/:id`
- **Description**: Updates an existing subscription's amount, billing cycle (`every_3_months`, etc.), status, wallet, or next billing date.

### `DELETE /api/subscriptions/:id`
- **Description**: Deletes a subscription record.

### `POST /api/subscriptions/:id/pay`
- **Description**: Logs a payment for the subscription, creates the corresponding `Expense` transaction in the linked wallet, and automatically advances `nextBillingDate` by the exact billing cycle (`+3 months`, `+1 month`, etc.).

---

## 5. Multi-Wallet Management (`walletRoutes.ts`)

### `GET /api/wallets`
- **Description**: Retrieves all wallets (`Bank`, `Cash`, `Savings`, `Investment`) with dynamically computed balances.

### `POST /api/wallets`
- **Description**: Creates a new wallet.
- **Body**: `{ "name": "CIH Bank", "type": "Bank", "isMain": false, "initialBalance": 5000 }`

### `PUT /api/wallets/:id`
- **Description**: Updates wallet name, type, `isMain` status, or balance adjustment.

### `DELETE /api/wallets/:id`
- **Description**: Deletes a wallet.

---

## 6. Transactions, Receipts & Financial Contexts

### `GET /api/transactions`
- **Description**: Retrieves all transactions (including split & partial payment metadata) for the user/workspace.

### `POST /api/transactions`
- **Description**: Creates an `Income`, `Expense`, `Transfer`, or `Debt Repayment` transaction with optional shared expense `splits`, `contextId`, and partial payment tracking.

### `PUT /api/transactions/:id`
- **Description**: Updates an existing transaction.

### `DELETE /api/transactions/:id`
- **Description**: Deletes a transaction.

### `POST /api/receipts/parse`
- **Description**: Parses raw OCR receipt text into structured `{ amount, merchant, date, category, confidence }` fields.

### `GET /api/contexts` | `POST /api/contexts` | `PUT /api/contexts/:id` | `DELETE /api/contexts/:id`
- **Description**: CRUD operations for Financial Contexts (`Trip`, `Work / Mission`, `Project`, `Life Event`, `Other`).

### `POST /api/contexts/link-transactions`
- **Description**: Bulk-links existing transactions to a specific Financial Context ID.

---

## 7. Budgets, Debts, Payrolls & Goals

### Budgets (`categoryBudgetRoutes.ts`)
- `GET /api/category-budgets`: Retrieves all monthly category budgets.
- `PUT /api/category-budgets`: Upserts a single category budget (`{ category, year, month, amount }`).
- `PUT /api/category-budgets/batch`: Batch upserts multiple category budgets in one atomic transaction.
- `POST /api/category-budgets/copy-previous`: Copies budgets from the previous financial cycle.
- `DELETE /api/category-budgets/month/:year/:month`: Clears all budgets for a specific month.
- `DELETE /api/category-budgets/:id`: Deletes a single category budget.

### Debts (`debtRoutes.ts`)
- `GET /api/debts`: Lists all `Receivable` and `Payable` obligations.
- `POST /api/debts`: Creates a new debt or logs a debt settlement/repayment.
- `PUT /api/debts/:id`: Updates a debt record.
- `DELETE /api/debts/:id`: Deletes a debt record.

### Payrolls (`payrollRoutes.ts`)
- `GET /api/payrolls` | `POST /api/payrolls` | `DELETE /api/payrolls/:id`: Manages custom scheduled payroll dates that anchor financial cycles.

### Savings Goals (`goalRoutes.ts`)
- `GET /api/goals` | `POST /api/goals` | `PUT /api/goals/:id` | `DELETE /api/goals/:id`: CRUD for savings milestones.
- `POST /api/goals/:id/contribute`: Contributes funds to a goal (with optional wallet transfer).
- `POST /api/goals/:id/withdraw`: Withdraws funds from a goal back to a wallet.

---

## 8. KPIs, Cycle Retrospectives & AI Copilot

### `GET /api/kpis`
- **Description**: Computes live financial cycle KPIs (`totalLiquidity`, `safeToSpend`, `dailyAllowance`, `dailyRemaining`, `emergencyBuffer`, `investmentReserve`, `runwayDays`, `healthScore`, and `forecast`).

### `GET /api/reports/cycles`
- **Description**: Lists all historical and active financial cycles derived from payroll boundaries.

### `GET /api/reports/cycle-retrospective` & `POST /api/reports/cycle-retrospective/generate`
- **Description**: Retrieves or generates an executive cycle retrospective comparing income, net living expenses, savings rate, and category variances.

### `POST /api/chat` & `POST /api/chat/actions`
- **Description**: Conversational AI Copilot (`Spex`) with live financial context injection and human-in-the-loop database mutation execution via `AiActionGateway`.

---

## 9. User Management, RBAC & Push Notifications

### User Management (`userManagementRoutes.ts`)
- `GET /api/users`: Lists workspace users and recent `user_audit_logs`.
- `POST /api/users`: Creates a managed user with custom role (`admin`, `manager`, `member`, `viewer`), `workspaceMode` (`shared` | `isolated`), and granular permissions.
- `PUT /api/users/:id`: Updates user role, status, workspace mode, password, or permissions.
- `DELETE /api/users/:id`: Removes a managed user.
- `POST /api/users/:id/impersonate`: Generates an impersonation session token for admin troubleshooting.

### Settings & Backups (`settingsRoutes.ts`)
- `GET /api/settings` | `POST /api/settings`: Reads or updates user payday, salary, emergency buffer, and Google Drive backup cadence.
- `GET /api/settings/export-sql` | `POST /api/settings/import-sql`: Full PostgreSQL `.sql` export and atomic restore.
- `POST /api/settings/backup-drive`: Triggers an immediate SQL backup upload to Google Drive.

### Push Notifications v2 (`NotificationController.ts`)
- `GET /api/notifications/vapid-public-key`: Returns the server VAPID public key.
- `POST /api/notifications/subscribe` | `POST /api/notifications/unsubscribe`: Registers or removes a Web Push endpoint.
- `GET /api/notifications/preferences` | `PUT /api/notifications/preferences`: Reads or updates notification toggles, delivery time, timezone, and quiet hours.
