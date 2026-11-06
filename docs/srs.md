# Software Requirements Specification (SRS) - TrueSpend

## 1. Introduction
**TrueSpend** is a full-stack personal finance, multi-wallet wealth management, subscription tracking, and stock/cryptocurrency portfolio application designed for users operating on custom pay cycles (e.g., getting paid on the 25th of the month) with AI-assisted financial intelligence.

---

## 2. System Architecture

### 2.1. Client-Side (Frontend & Native Mobile)
- **Framework**: React 19, TypeScript, Vite 6.
- **Native Mobile Runtime**: Capacitor 8 (`@capacitor/core`, `@capacitor/android`) packaging the web application into a native Android APK (`com.truespend.app`) with hardware back-button navigation, haptics, and dynamic backend routing (`capacitorBridge.ts`).
- **Styling & Design System**: Tailwind CSS v4 with a 12-theme architectural style engine (`ThemeContext.tsx`) and independent corner radius, typography, and surface overrides.
- **State & Privacy**: React Context (`AuthContext`, `ThemeContext`, `PrivacyContext`), local storage caching, and global privacy blur mode.
- **Charts & Visualizations**: Recharts (`AreaChart`, `BarChart`, `PieChart`, `ComposedChart`) + custom interactive SPEX spritesheet animations (`SpexSpriteAnimator.tsx`).

### 2.2. Server-Side (Backend)
- **Runtime**: Node.js + Express (`server.ts`).
- **Database**: PostgreSQL (Cloud SQL / Neon) with 16 relational tables managed via Drizzle ORM (`src/db/schema.ts`).
- **External Integrations**:
  - **Binance Spot, Funding & Simple Earn API**: Server-side Ed25519 asymmetric cryptographic request signing (`BinanceService.ts`).
  - **Yahoo Finance Live Equities API**: Real-time US/Global stock quotes, 24h change, and live sector/industry discovery (`InvestmentService.ts`).
  - **AI Inference**: Multi-model LLM routing via OpenRouter and Google Gen AI SDK (`ChatService.ts`).
  - **Google Drive API**: Automated and on-demand PostgreSQL `.sql` cloud backups.

---

## 3. Core Functional Subsystems

1. **Custom Financial Month & Cash Flow Engine (`src/lib/financialMonth.ts`, `src/lib/cashFlowEngine.ts`)**:
   - Computes exact financial cycle boundaries from custom payday settings or calendar `payrolls` records.
   - Reconciles opening liquidity, salary income, net living expenses, reimbursable splits, debt repayments, investment deployments, and closing liquidity across all historical periods.
2. **Stocks & Investments Engine (`docs/stocks-and-investments.md`)**:
   - Strictly separates **US & Global Stocks (Funding Wallet & Local Equities)** from **Spot Cryptocurrencies**.
   - Auto-categorizes 650+ stock tickers (including Binance `EQ*` tokenized equities like `EQORCL`, `EQNVDA`, `EQJPM`, `EQUSAR`) across 8 canonical sectors, supplemented by live Yahoo Finance sector lookup and `< $0.05` crypto dust filtering (`NEBL`, `WTC`).
   - Provides breakeven share price calculation, fee drag forensics, 5-year DRIP dividend projections, and an interactive stock profit simulator.
3. **Subscriptions & Multi-Month Commitments (`src/components/dashboard/SubscriptionsTab.tsx`)**:
   - Native support for **Every 3 Months (`every_3_months`)** bills (e.g., gym memberships, car/health insurance), bi-monthly, semi-annual, monthly, and yearly cycles with auto-detection and one-click payment logging.
4. **Role-Based Access Control (RBAC) & Workspaces (`src/middleware/auth.ts`)**:
   - Supports `owner`, `admin`, `manager`, `member`, and `viewer` roles across `isolated` or `shared` workspace modes, with admin impersonation and `user_audit_logs`.
5. **SPEX AI Copilot & Action Gateway (`docs/ai.md`)**:
   - Injects a comprehensive, scoped financial snapshot (`src/lib/aiContext.ts`) and executes human-approved database mutations via `AiActionGateway.ts`.

---

## 4. Documentation Index (`/docs`)

- **[Features Guide](features.md)**: High-level overview of all user-facing modules.
- **[Stocks, Funding Equities & Investments Architecture](stocks-and-investments.md)**: Deep-dive into Funding Stocks vs. Spot Crypto separation, 8-sector auto-categorization, Binance Ed25519 sync, and Yahoo Finance enrichment.
- **[REST API Reference](api.md)**: Complete endpoint documentation across all 15 route modules.
- **[Database Schema & Architecture](database.md)**: Field-by-field specification of all 16 PostgreSQL tables and backup workflows.
- **[AI Copilot & SPEX Architecture](ai.md)**: Context snapshot structure, focus scopes, LLM failover, and `AiActionGateway`.
- **[Multi-Theme & Design System](themes.md)**: The 12 curated light/dark themes and SPEX avatar variants.
- **[Android Capacitor Guide](ANDROID_CAPACITOR.md)**: Building and configuring the native Android APK.
