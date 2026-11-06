# TrueSpend Stocks, Funding Equities & Investments Architecture

This document provides a complete technical and functional breakdown of the **Stocks & Investments** module in TrueSpend (`FundingStocksDashboard.tsx`, `InvestmentsTab.tsx`, `stockCategories.ts`, `InvestmentService.ts`, and `BinanceService.ts`).

---

## 1. Core Architectural Principle: Strict Separation of Funding Stocks vs. Spot Crypto

A foundational rule of TrueSpend's investment engine is the **strict isolation between US/Global Stocks (Funding Wallet & Local Positions) and Spot Cryptocurrencies**:

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     UNIFIED INVESTMENTS ENGINE (/api/investments)            │
├──────────────────────────────────────┬───────────────────────────────────────┤
│   US & GLOBAL STOCKS (FUNDING TAB)   │      SPOT CRYPTOCURRENCY TERMINAL     │
│  (FundingStocksDashboard.tsx)        │     (InvestmentsTab.tsx — Spot View)  │
├──────────────────────────────────────┼───────────────────────────────────────┤
│ • Source: Binance Funding Wallet     │ • Source: Binance Spot & Earn Wallets │
│   (EQ* Tokenized Equities) + Local   │ • Asset Class: Strictly 'CRYPTO' &    │
│   Stock Positions (`stock_positions`)│   'STABLECOIN' (`BTC`, `ETH`, `SOL`,  │
│ • Asset Class: Strictly 'STOCK'      │   `USDT`, `USDC`, plus 260+ altcoins) │
│ • Excludes all Spot Cryptocurrencies,│ • 24/7 crypto volatility never        │
│   Stablecoins, and <$0.05 dust       │   distorts stock sector weights or    │
│   (e.g., delisted `NEBL`, `WTC`)     │   equity dividend yields              │
│ • Focus: 8-Sector Breakdown,         │ • Focus: Spot Wallet Allocation,      │
│   Category Dominance Insights,       │   Personal Trade Forensics, Earn      │
│   Dividend Yield & 5Y DRIP,          │   APR, and Stablecoin Dry Powder      │
│   Breakeven Share Price & Simulator  │                                       │
└──────────────────────────────────────┴───────────────────────────────────────┘
```

### Why Separation Matters
1. **Accurate Sector Weights**: Allocating 100% across stock categories (e.g., *Technology & Cloud*, *AI & Semiconductors*, *Banking & Financials*, *Mechanics, Automotive & Industrials*) is calculated strictly as a percentage of **Total Held Stocks Value**, never diluted by Spot BTC/USDT balances.
2. **Dust & Delisted Crypto Protection**: Legacy delisted Binance tokens (such as `NEBL` / Neblio or `WTC` / Waltonchain) with `$0.00` value are explicitly classified as `CRYPTO` and filtered out by a `$0.05 USD / 0.50 MAD` minimum value threshold so they never leak into stock sector counts or "Top Stock Performer" cards.

---

## 2. The 8 Canonical Stock Sector Categories (`src/lib/stockCategories.ts`)

Every stock or ETF position is automatically classified into one of **8 canonical categories**:

| # | Category Name | Short Label | Core Industry Coverage | Representative Tickers |
| :- | :--- | :--- | :--- | :--- |
| **1** | **`AI & Semiconductors`** | `AI & Chips` | GPUs, AI accelerators, wafer foundries, EDA software, AI servers, optical interconnects | `NVDA`, `AMD`, `AVGO`, `TSM`, `ASML`, `ARM`, `MU`, `INTC`, `PLTR`, `SMCI`, `ANET`, `MRVL`, `KLAC`, `LRCX`, `SNPS`, `CDNS`, `AI`, `SOUN`, `IONQ` |
| **2** | **`Technology & Cloud`** | `Tech & Cloud` | Enterprise SaaS, cloud hyperscalers, cybersecurity, operating systems, consumer hardware | `ORCL`, `MSFT`, `AAPL`, `GOOGL`, `META`, `CRM`, `NOW`, `ADBE`, `PANW`, `CRWD`, `SNOW`, `NET`, `SHOP`, `SAP`, `IBM`, `CSCO`, `HPS`, `M2M` |
| **3** | **`Mechanics, Automotive & Industrials`** | `Mechanics & Auto` | Rare earth magnets & critical materials, EVs & automakers, heavy machinery, robotics, aerospace & defense | `USAR`, `TSLA`, `CAT`, `DE`, `GE`, `HON`, `LMT`, `RTX`, `BA`, `ETN`, `PH`, `ABB`, `BYD`, `TM`, `MP`, `RKLB`, `ASTS`, `JOBY`, `SERV`, `TGCC`, `LHM` |
| **4** | **`Banking & Financials`** | `Banking & Finance` | Global investment/commercial banks, payment networks, insurance, asset managers, fintech | `JPM`, `V`, `MA`, `BAC`, `GS`, `MS`, `WFC`, `C`, `BRK.B`, `BLK`, `AXP`, `SPGI`, `SCHW`, `PYPL`, `SOFI`, `ATW`, `BCP`, `BOA`, `CIH` |
| **5** | **`Consumer & Retail`** | `Consumer & Retail` | E-commerce, warehouse clubs, food & beverage, apparel, restaurants, travel & hospitality | `AMZN`, `WMT`, `COST`, `HD`, `KO`, `PEP`, `PG`, `MCD`, `SBUX`, `NKE`, `NFLX`, `DIS`, `BKNG`, `LULU`, `CMG`, `CSR`, `LBV`, `SBM` |
| **6** | **`Healthcare & Biotech`** | `Healthcare` | Pharmaceuticals, GLP-1 & biotech leaders, surgical robotics, medical devices, health insurers | `LLY`, `UNH`, `JNJ`, `ABBV`, `MRK`, `NVO`, `ISRG`, `TMO`, `ABT`, `AMGN`, `PFE`, `VRTX`, `REGN`, `SYK`, `BSX`, `SOT`, `PRO` |
| **7** | **`Energy, Utilities & Real Estate`** | `Energy & Real Estate` | Oil & gas majors, nuclear & renewable utilities, power grids, data-center & retail REITs | `XOM`, `CVX`, `NEE`, `CEG`, `VST`, `O`, `PLD`, `AMT`, `EQIX`, `SLB`, `COP`, `ENB`, `DUK`, `SO`, `TQM`, `TMA`, `ADH`, `RDS` |
| **8** | **`Index & Dividend ETFs`** | `ETFs & Index` | S&P 500, Nasdaq-100, total market, dividend growth, and sector/thematic ETFs | `VOO`, `SPY`, `QQQ`, `VTI`, `SCHD`, `JEPI`, `JEPQ`, `VYM`, `VXUS`, `IWM`, `DIA`, `SMH`, `SOXX`, `XLK`, `XLF`, `XLE`, `VNQ`, `TLT`, `GLD` |

---

## 3. Multi-Stage Auto-Categorization Pipeline

When a user holds stocks in their Binance Funding Wallet or adds a stock manually, TrueSpend resolves the stock's canonical sector through a **5-stage deterministic + live discovery pipeline**:

```
Raw Symbol (e.g. "EQJPM", "EQNVDA", "EQORCL", "EQUSAR", "JPMUSDT")
   │
   ▼
[Stage 1] normalizeStockTicker(raw)
   • Strips Binance tokenized equity prefix `EQ*` (EQORCL → ORCL, EQNVDA → NVDA, EQJPM → JPM, EQUSAR → USAR)
     while preserving natural EQ* tickers (EQIX, EQR, EQNR, EQH, EQT)
   • Strips `STK` and `LD` prefixes
   • Strips quote suffixes (`USDT`, `USDC`, `FDUSD`, `BUSD`, `USD`, `EUR`, `MAD`)
   • Strips tokenized `ON` / `X` suffixes and `B` / `D` wrapper prefixes
   • Normalizes class shares (`BRKB` → `BRK.B`)
   │
   ▼
[Stage 2] classifyAssetClass({ ticker, market, sector, walletScope })
   • Checks 260+ `KNOWN_CRYPTO_TICKERS` (including delisted tokens like `NEBL`, `WTC`) → always `'CRYPTO'`
   • Checks `STABLECOIN_TICKERS` (`USDT`, `USDC`, `FDUSD`, `DAI`, etc.) → always `'STABLECOIN'`
   • Checks `EQ*` prefix or `TICKER_TO_STOCK_SECTOR` (650+ stocks) → `'STOCK'`
   • Unknown tokens in `SPOT` or `EARN` default to `'CRYPTO'` so altcoins never leak into Stocks
   │
   ▼
[Stage 3] Exact Dictionary Lookup (`TICKER_TO_STOCK_SECTOR`)
   • Instant O(1) match across 650+ US, Global, ETF, and Casablanca BVC stock tickers
   • Resolves canonical company name via `TICKER_TO_COMPANY_NAME`
     (e.g., `EQUSAR` → `USA Rare Earth, Inc.`, `EQORCL` → `Oracle Corporation`)
   │
   ▼
[Stage 4] Live Yahoo Finance Sector & Industry Discovery (`InvestmentService.ts`)
   • For any newly listed or custom ticker not in the static dictionary, the server queries:
     `GET https://query1.finance.yahoo.com/v1/finance/search?q=<TICKER>`
   • Extracts Yahoo's live `sector`, `industry`, and `longname` (cached for 24 hours)
   │
   ▼
[Stage 5] Keyword & Industry Heuristic (`matchSectorFromText`)
   • Matches company name, Yahoo sector, and Yahoo industry against 120+ domain keywords
     (e.g. "rare earth", "magnet", "semiconductor", "bank", "financial services", "biotech", "reit", "etf")
```

### Real-World Example (Binance Funding Portfolio)
| Raw Binance Asset | Normalized Ticker | Resolved Company Name | Auto-Assigned Category | Dividend Yield |
| :--- | :--- | :--- | :--- | :--- |
| `EQORCL` | `ORCL` | Oracle Corporation | **Technology & Cloud** | `0.95%` |
| `EQNVDA` | `NVDA` | NVIDIA Corporation | **AI & Semiconductors** | `0.03%` |
| `EQJPM` | `JPM` | JPMorgan Chase & Co. | **Banking & Financials** | `2.15%` |
| `EQUSAR` | `USAR` | USA Rare Earth, Inc. | **Mechanics, Automotive & Industrials** | `0.00%` |
| `NEBL` | `NEBL` | Neblio *(Delisted Crypto)* | Classified as **`CRYPTO`** (Excluded from Stocks) | — |
| `WTC` | `WTC` | Waltonchain *(Delisted Crypto)* | Classified as **`CRYPTO`** (Excluded from Stocks) | — |

---

## 4. US & Global Stocks Dashboard Features (`FundingStocksDashboard.tsx`)

The **Funding & US Stocks Dashboard** is organized into four focused sub-tabs with dual currency display (`USD` primary + `MAD` secondary):

### 4.1. Overview & Live Category Breakdown (`overview`)
1. **Top KPI Command Strip**:
   - **Total Stocks Value (Funding)**: Displays total stock equity in USD & MAD, active stock count, and unallocated Funding cash.
   - **Net Stock Profit (After Fees)**: Realized + Unrealized P&L minus entry and exit brokerage/maker-taker fees (`0.10%` per leg).
   - **Most Held Stock Category**: Highlights the `#1` dominant stock sector by portfolio weight (e.g., *Technology & Cloud*, *AI & Semiconductors*, *Banking & Financials*, or *Mechanics & Auto*).
   - **Passive Dividend Cash Flow**: Annual and monthly projected dividend income (`$/yr` and `MAD/yr`) + portfolio-weighted dividend yield %.
2. **Interactive 8-Sector Breakdown Grid**:
   - Proportional multi-color stacked distribution bar across all held stock categories.
   - 8 interactive sector cards showing exact `% of Stocks`, USD/MAD value, net P&L, held tickers, and one-click filtering or quick stock addition (`+ Add NVDA`, `+ Add JPM`, etc.).
3. **Smart Stocks Insights & Category Recommendations**:
   - **Category Dominance Insight**: Evaluates sector concentration and suggests complementary sectors if a single category exceeds `45%`.
   - **Funding vs. Spot Separation Card**: Shows exact split between US Stocks (Funding Wallet) and Spot Cryptocurrencies.
   - **Top Stock Performer & Breakeven**: Identifies the highest-performing stock position after fees.
   - **Dividend Yield & 5-Year Compounding Card**: Summarizes annual cash payouts and 5-year DRIP growth.
4. **Stock Holdings Ledger Cards**:
   - Each card displays: Ticker badge, Company Name, Canonical Sector badge, Market (`US` / `ETF` / `BVC`), Share count, Average Cost vs. Live Price, **Exact Breakeven Share Price**, Gross P&L, Fee Drag, Net P&L after fees, and Dividend Yield.
   - Expandable forensics drawer with one-click **Buy More**, **Sell Shares**, **Log Dividend**, **Edit Position**, and **Delete**.

### 4.2. Category Insights & Portfolio Health (`insights`)
- **4-Pillar Stocks Health Score (0–100)**:
  1. *Sector Diversification (0–30 pts)*: Rewards balanced exposure across 3+ stock categories and penalizes single-sector concentration above 60%.
  2. *Position Sizing Balance (0–25 pts)*: Checks single-stock risk concentration.
  3. *Net Profitability & Fee Efficiency (0–25 pts)*: Evaluates net P&L vs. fee drag.
  4. *Dividend & Cash Flow Resilience (0–20 pts)*: Evaluates passive yield generation.
- **Sector-by-Sector Performance Matrix**: Full tabular comparison of all 8 categories (Holdings count, Tickers, Weight %, Market Value USD/MAD, Net P&L, Annual Dividends, and Yield %).
- **5-Year Dividend Compounding Trajectory (DRIP)**: Year-by-year projection (`Year 1` to `Year 5`) assuming automatic dividend reinvestment + `6%` conservative annual price appreciation.

### 4.3. Stock Profit, Fee & Breakeven Simulator (`simulator`)
- Interactive what-if calculator allowing users to pick any stock in their portfolio or from the curated catalog (`NVDA`, `ORCL`, `JPM`, `USAR`, `AAPL`, `MSFT`, `TSLA`, `VOO`, `SCHD`, `ATW`, `TGCC`, etc.).
- Simulates:
  - Investment amount in USD (`$25`, `$50`, `$100`, `$250`, `$500`, `$1,000`)
  - Target price movement (`-20%` to `+100%`)
  - Holding period (`1` to `60` months)
- Outputs exact **Shares Acquired**, **Breakeven Price (+0.20% round-trip fee coverage)**, **Net Capital Gain**, **Projected Dividends**, and **Total Net Return (USD & MAD)**.

### 4.4. Stock Order History (`orders`)
- Chronological ledger of all `BUY`, `SELL`, and `DIVIDEND` executions with realized P&L and linked wallet synchronization status.

---

## 5. Read-Only Binance Integration (`server/services/BinanceService.ts`)

TrueSpend integrates with Binance using **cryptographically signed read-only requests**:

### 5.1. Security Architecture
- **Asymmetric Ed25519 Signing**: Uses Node.js `crypto.sign(null, Buffer.from(queryString), privateKey)` with PKCS#8 PEM normalization (`BINANCE_API_KEY` + `BINANCE_PRIVATE_KEY` / `BINANCE_SECRET_KEY`).
- **Strictly Read-Only**: Only queries balance, price, earn, and historical trade endpoints. Never places exchange orders or initiates withdrawals.
- **Multi-Wallet Aggregation**:
  1. `GET /api/v3/account` (Spot Wallet balances)
  2. `POST /sapi/v1/asset/get-funding-asset` (Funding Wallet balances — where `EQ*` tokenized stocks reside)
  3. `GET /sapi/v1/simple-earn/flexible/position` & `locked/position` (Simple Earn positions & live APR)
  4. `POST /sapi/v3/asset/getUserAsset` (Fallback Spot asset valuation)
  5. `GET /api/v3/myTrades` (Personal execution history, weighted average buy/sell price, realized P&L, and exact commission fee forensics)

### 5.2. Live Stock Price & Dividend Enrichment
- Because US & Global stock tickers (`ORCL`, `NVDA`, `JPM`, `USAR`, `AAPL`, etc.) are not priced via standard crypto pairs when market hours vary, `InvestmentService.ts` fetches live quotes from **Yahoo Finance** (`query1.finance.yahoo.com/v7/finance/quote` and `/v8/finance/chart/:symbol`) and injects them into `BinanceService.getAccountOverview()`.
- Both raw (`EQJPM`) and normalized (`JPM`) ticker keys are indexed in the quote and metadata maps so tokenized equities automatically receive live Wall Street prices, 24h change percentages, and annual dividend yields.

---

## 6. Investment API Endpoints Summary

| Method | Endpoint | Purpose |
| :--- | :--- | :--- |
| `GET` | `/api/investments` | Full portfolio payload: enriched positions, orders, live Binance overview, analytics, and stock catalog |
| `GET` | `/api/investments/stocks/search?q=` | Search stocks across local catalog and live Yahoo Finance ticker search |
| `GET` | `/api/investments/binance/account` | Read-only Binance Spot + Funding + Earn overview (`?refresh=true` bypasses 25s cache) |
| `GET` | `/api/investments/binance/trades` | Personal Binance trade history and fee forensics for `?symbol=BTCUSDT` |
| `POST` | `/api/investments/binance/sync-wallet` | Syncs TrueSpend Investment wallet balance with live Binance portfolio value |
| `POST` | `/api/investments/wallet-transfer` | Logs a deposit or withdrawal between Bank/Cash and Investment wallets |
| `POST` | `/api/investments/positions` | Creates or updates a stock/ETF position or watchlist item |
| `PUT` | `/api/investments/positions/:id` | Updates shares, average cost, current price, sector, or thesis on a position |
| `DELETE` | `/api/investments/positions/:id` | Deletes a tracked stock position |
| `POST` | `/api/investments/orders` | Executes a local `BUY`, `SELL`, or `DIVIDEND` order with optional TrueSpend wallet sync |
| `DELETE` | `/api/investments/orders/:id` | Deletes a logged stock order |
| `POST` | `/api/investments/payday-allocate` | Executes a payday batch purchase across multiple target-weighted stocks |
| `POST` | `/api/investments/fund-wallet` | Transfers capital from a Bank/Savings wallet into an Investment wallet |
