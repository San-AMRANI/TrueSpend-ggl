# TrueSpend V2 — Financial Operating System Specification

**Status:** Implementation-ready product and technical specification  
**Audience:** Engineering / AI implementation agent  
**Scope:** Additive V2 evolution of the existing TrueSpend application  
**Primary outcome:** Transform TrueSpend from a recording tool into a personalized, explainable financial planning and coaching system.

---

## 1. Product Definition

### 1.1 Vision

TrueSpend V2 is a personal financial operating system. It does not merely tell a user what happened to their money. It uses their income, wallets, debts, commitments, goals, spending history, and investment position to explain their current situation and recommend the safest next action.

The core promise is:

> **When money arrives, TrueSpend helps the user give every unit of money a purposeful job—while protecting their immediate stability and long-term future.**

### 1.2 Product shift

| V1 capability | V2 capability |
|---|---|
| Records transactions | Understands financial behavior and commitments |
| Displays budgets | Proposes an affordable, personalized spending plan |
| Displays wallet balances | Separates spendable cash, reserved cash, savings, and investments |
| Offers a What-If calculator | Simulates financial decisions and trade-offs |
| Provides an AI chat | Provides proactive, explainable recommendations with approval-based actions |
| Tracks savings goals | Coordinates goals, buffers, debt, and investing within one plan |

### 1.3 Non-goals for the first V2 releases

- Do **not** execute trades or connect to brokerage/exchange accounts in the first release.
- Do **not** present recommendations as regulated, individualized investment advice or promise returns.
- Do **not** classify investment market gains as salary or ordinary income.
- Do **not** include investments in `safeToSpend`, daily allowance, or emergency cash by default.
- Do **not** overwrite, delete, or reinterpret historical transactions during migration.
- Do **not** allow AI-generated financial mutations to happen without explicit user approval.

---

## 2. Existing Application Baseline

### 2.1 Current technology and architecture

Preserve the current stack:

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, Recharts, Lucide.
- Backend: Express with authenticated REST routes.
- Persistence: PostgreSQL with Drizzle ORM and `pg` pool.
- Authentication: Firebase Auth bearer token middleware.
- Existing AI: OpenRouter-backed chat with structured action proposals and an approval gateway.
- Notifications: Web Push / VAPID, `node-cron`, user notification preferences.

Current data flow:

```text
React tabs/components
        ↓
useDashboardData + dashboardService
        ↓
Express routes → controllers → services → repositories
        ↓
Drizzle schema + PostgreSQL
        ↓
KpiService → financialEngine → existing KPI response
```

### 2.2 Existing data to preserve

Do not replace these entities or their data:

- `users`: payday, emergency buffer, salary, notifications, backup settings.
- `wallets`: existing `Bank`, `Cash`, and `Savings` accounts.
- `transactions`: the historical cash ledger, including transfer and debt-repayment records.
- `payrolls`: financial-month definition and scheduled salary records.
- `category_budgets`: current calendar-month budgets.
- `debts`, `splits`, `goals`, `subscriptions`, and `financial_contexts`.
- Existing notifications, backups, and AI chat behavior.

### 2.3 Current extension points

V2 must extend, rather than duplicate, the current architecture:

- `src/lib/financialEngine.ts` is the current source for liquidity, safe-to-spend, runway, forecast, and health score.
- `server/services/KpiService.ts` gathers core records and passes them into the financial engine.
- `src/hooks/useDashboardData.ts` is the primary frontend data and mutation orchestration layer.
- `src/services/api/dashboardService.ts` is the existing typed REST client pattern.
- `server/services/AiActionGateway.ts` and `server/services/ChatService.ts` provide a structured, approval-based AI workflow.
- `server/pushCron.ts` and notification preferences provide an existing delivery mechanism for coaching alerts.

---

## 3. V2 Financial Philosophy and Guardrails

The recommendation engine must have explicit, inspectable values. These values are product rules—not hidden AI behavior.

### 3.1 Priority order

When funds are allocated, use this default order. Users may configure eligible preferences, but may not accidentally bypass safety checks without a clear override.

1. **Maintain solvency:** reserve known essential commitments before discretionary spending.
2. **Meet obligations:** account for due payables, debt minimums, and recurring bills.
3. **Protect resilience:** build and preserve a cash emergency buffer.
4. **Fund time-bound goals:** reserve money needed for accepted goals and deadlines.
5. **Create sustainable investment capacity:** invest only from money that does not endanger items 1–4.
6. **Allow flexible spending:** give the user realistic, shame-free discretionary room.
7. **Leave a margin:** do not allocate every monetary unit by default; retain an unallocated buffer.

### 3.2 Required recommendation behavior

Every recommendation must contain:

- A human-readable explanation of the input facts and logic.
- The proposed amount, source, destination, and expected effect.
- The policy rule(s) that influenced it.
- Confidence: `high`, `medium`, or `low`.
- Assumptions that require confirmation.
- A reversible user action: approve, edit, postpone, or dismiss.

Example:

> **Reserve 900 MAD for your emergency fund.** You currently hold 1.4 months of essential expenses in cash; your target is 3 months. This amount is available after your scheduled bills, debt due this period, and active goal contributions. Confidence: medium, because two recurring bills have not yet been confirmed.

### 3.3 Safety rules

- Never recommend an investment contribution that makes projected liquid funds lower than the protected emergency-buffer target, unless the user explicitly overrides it.
- Never count receivables as cash available to allocate.
- Never include unconfirmed future income as available cash; it can be displayed separately in forecasts.
- Never assume an `Investment Account` is liquid or guaranteed in value.
- Show an educational disclaimer in Portfolio and investment recommendation flows: results are planning guidance based on user-entered data, not a guarantee or investment recommendation from a regulated adviser.
- Show loss risk for volatile assets such as crypto; use risk categories, not promises of expected return.

---

## 4. Core V2 User Experience

### 4.1 Financial Home (new default overview)

Replace the V1 balance-first overview emphasis with an action-first home screen while retaining existing KPI cards as drill-down information.

Required sections, ordered by importance:

1. **Next Best Action** — one highest-impact, actionable card.
2. **Current Plan status** — allocated, reserved, remaining to assign, and plan health.
3. **Safe to Spend** — only immediately spendable cash after protections and reservations.
4. **Financial position** — Liquid cash / reserved / investments / debts / net worth.
5. **This financial month** — forecast, spending pace, budget risks, and upcoming commitments.
6. **Progress** — emergency buffer, debt payoff, goals, and recurring investment plan.
7. **Coaching feed** — a small list of meaningful insights; no notification noise.

The header should answer, at a glance:

```text
Safe to spend today: 1,340 MAD
Next action: Review your 6,000 MAD salary plan
Plan status: 4,700 MAD assigned · 1,300 MAD still unassigned
```

### 4.2 Salary Plan (primary V2 feature)

This is the central pay-cycle flow. It must open automatically as a prominent card when a payroll income is recorded or manually from Financial Home.

#### Plan flow

```text
Salary/Income received
       ↓
Financial snapshot created
       ↓
Engine calculates protections and capacity
       ↓
Draft plan generated
       ↓
User reviews/edit allocations
       ↓
User approves selected allocations
       ↓
Transactions/reservations/goal contributions are created atomically
       ↓
Plan is monitored until the next pay cycle
```

#### Salary Plan requirements

- Support one plan per major income event / financial cycle. A plan may be revised; revisions preserve prior versions.
- Show income amount, effective date, plan period, and source wallet.
- Present allocation buckets in priority order:
  - Required commitments
  - Debt payoff / minimum obligations
  - Emergency buffer contribution
  - Time-bound goal contributions
  - Category budgets / flexible spending
  - Investment contribution
  - Unallocated margin
- Every bucket can be edited by the user before approval.
- Explain why a recommendation is zero, reduced, or high.
- Allow a partial approval: user may approve bills and budgets now but postpone investing.
- Do not create cash transactions for a purely planned category budget. Persist the planned allocation and update the budget where relevant.
- Create real transfers only where money is actually moved, such as Bank → Savings wallet or Bank → investment account funding.
- Mark plan allocations as `planned`, `approved`, `executed`, `skipped`, `changed`, or `failed`.
- Detect a later shortfall and suggest a controlled replan instead of silently changing allocations.

#### Example output

```text
Income received: 6,000 MAD

Required commitments                2,100 MAD
Debt obligation                       300 MAD
Emergency fund                        900 MAD
Goal: Laptop                          700 MAD
Investment contribution               600 MAD
Flexible category budgets            1,000 MAD
Unallocated safety margin             400 MAD
----------------------------------------------
Total                                 6,000 MAD
```

### 4.3 Adaptive Budgets

V2 budgets are no longer isolated manual limits. They are a plan output and a behavior-aware guide.

Required capabilities:

- Continue supporting current category and calendar-month budget records.
- Add financial-period budget plans tied to a Salary Plan.
- Propose amounts from historical spending, known commitments, income variability, goals, and user-selected priorities.
- Support `essential`, `flexible`, `growth`, and `excluded` budget classifications.
- Calculate a pacing allowance: remaining budget ÷ remaining days in the financial period.
- Show the effect of changing a budget on goal and investment capacity.
- Allow a user to lock a category or tell the engine to never auto-change it.
- Require approval before changing any existing budget.

### 4.4 Financial Roadmap

Introduce a dedicated planning view that makes trade-offs understandable.

Required roadmap tracks:

- Emergency fund: target, amount protected, months of essential coverage, planned monthly contribution.
- Debt: outstanding payables, due dates, minimum payments, recommended payoff order.
- Goals: deadline feasibility, contribution requirement, risk of falling behind.
- Investing: planned contribution, current value, allocation, and risk exposure.
- Net worth: history and composition.

The roadmap must distinguish **cash facts** from **forecasts** and label forecasts with assumptions.

### 4.5 Coach / Recommendations

The coach is an action system, not an infinite stream of generic tips.

Recommendation types:

- `SALARY_PLAN_READY`
- `UNALLOCATED_INCOME`
- `EMERGENCY_BUFFER_GAP`
- `BILL_RESERVE_REQUIRED`
- `BUDGET_PACE_RISK`
- `GOAL_AT_RISK`
- `DEBT_DUE_SOON`
- `INVESTMENT_CAPACITY_AVAILABLE`
- `ALLOCATION_DRIFT`
- `UNUSUAL_SPENDING`
- `PLAN_REVIEW_REQUIRED`

Rules:

- Rank by material financial impact, urgency, confidence, and user preferences.
- Limit the home feed to the top three actionable items.
- Deduplicate the same recommendation for a configurable cooldown period.
- Users can dismiss, snooze, or mark a recommendation as not relevant; use this feedback to avoid repetition.
- Store the evidence used to generate a recommendation so it can be explained later.

### 4.6 Decision Lab (V2 What-If)

Extend the current calculator hub with scenarios that never mutate live data until the user explicitly converts a scenario to a plan.

Required scenarios:

- One-time purchase.
- Monthly investment contribution.
- Emergency fund catch-up.
- Budget reduction or increase.
- Debt payoff amount or payoff date change.
- Salary increase/decrease or missed income.
- Goal contribution change.
- Asset value decline scenario for volatile investments.

Each scenario must show changes to:

- Safe to spend.
- Forecast end balance.
- Runway.
- Emergency buffer coverage.
- Goal deadline feasibility.
- Debt timeline, when relevant.
- Investment allocation and estimated portfolio value, when relevant.

---

## 5. Investment and Portfolio Module

### 5.1 Position in the product

Investment tracking belongs in **Wealth**, alongside but separate from spendable money. The first release is manual-first for **trade entry** but market-data enabled for supported crypto assets: users record what they bought and where, while CoinGecko supplies current and historical market prices. It supports crypto, gold/bullion, stocks, ETFs, funds, or other assets without requiring account credentials from a broker or exchange.

Suggested navigation:

```text
Home
Money       Transactions · Wallets · Bills · Debts
Plan        Salary Plan · Budgets · Goals · Decision Lab
Wealth      Portfolio · Allocation · Performance · Roadmap
Insights    Analytics · Reports · Coach
```

For the current tab architecture, introduce `plan` and `portfolio` tabs first. A full grouped-navigation redesign can follow once V2 features are stable.

### 5.2 Investment account model

An investment account is not a V1 wallet. Examples: Binance, brokerage account, gold holdings, pension fund, or a manually tracked ETF account.

Fields exposed to users:

- Account name.
- Institution / platform (optional).
- Account class: `Exchange`, `Brokerage`, `Retirement`, `Precious Metals`, `Manual`, `Other`.
- Base currency, defaulting to the user’s base currency (`MAD` for existing users).
- Liquidity profile: `Liquid`, `Restricted`, `Illiquid`.
- Include in net worth: default `true`.
- Include in emergency reserve: default `false`; only configurable for a genuinely cash-like asset with warning.

### 5.3 Supported asset classes

- `Crypto`
- `Stock`
- `ETF`
- `Mutual Fund`
- `Bond`
- `Precious Metal`
- `Cash Equivalent`
- `Retirement`
- `Other`

Asset metadata:

- Symbol / user identifier.
- Display name.
- Asset class.
- Quote currency.
- Units precision (crypto needs higher precision than stocks/cash).
- Risk category: `Low`, `Medium`, `High`, `Very High`.
- Price source: `CoinGecko` for supported crypto, with `Manual` as the fallback and for unsupported assets.

For crypto assets, store a provider identifier rather than relying on a ticker symbol alone. Symbols are ambiguous (for example, more than one asset can use the same ticker); CoinGecko's canonical coin ID is the primary identifier.

### 5.4 Investment events and accounting invariants

#### Funding an investment account

Bank/Cash → investment account funding is a paired transfer. It reduces cash liquidity but does **not** count as an expense, a budget spend, or an immediate portfolio gain/loss.

#### Buy

Create a `BUY` event with units, execution price, fees, and trade date. It creates or updates holding lots. The amount paid is the sum of `units × price + fees`.

#### Sell

Create a `SELL` event with units, execution price, fees, and trade date. It reduces lots using the selected cost basis method. Default cost basis: `FIFO`; make it explicit and configurable before tax reporting is attempted.

#### Dividend/interest

Create `DIVIDEND` or `INTEREST` as cash credited to the investment account. It is portfolio cash flow. Whether it should be classified as taxable income is jurisdiction-dependent; do not calculate tax in V2 MVP.

#### Fees

Trade fees are capitalized into buy cost basis and reduce sell proceeds. Account-level service fees can be a separate `FEE` event.

#### Valuation

Price snapshots create unrealized value changes only. Unrealized gain/loss is **not** an income transaction and cannot be used for spending capacity.

#### Withdrawal

Investment-account cash → Bank/Cash is a transfer. If it follows a sale, the sale and withdrawal remain separate auditable events.

### 5.5 Portfolio dashboard requirements

Display:

- Portfolio market value.
- Total contributions / net deposits.
- Unrealized gain or loss.
- Realized gain or loss (for the selected period).
- Total return and percentage return, clearly dated.
- Allocation by asset class, account, and asset.
- Asset risk concentration.
- Historical value chart from snapshots.
- A distinction between current value, cost basis, and cash invested.
- Planned recurring investment contribution and its effect on the Salary Plan.

### 5.6 Investment capacity calculation

The engine must calculate an investment ceiling. It is not a command to invest; it is a safe upper-bound planning number.

```text
investmentCapacity = max(0,
  liquidCash
  - protectedEmergencyCash
  - knownCommitmentsUntilNextIncome
  - pendingDebtObligationsDue
  - approvedGoalReserves
  - minimumFlexibleSpendingReserve
  - unallocatedSafetyMargin
)
```

The view must show each term and never imply that the entire capacity should be invested. Default recommendation amount can be lower, based on user strategy and contribution history.

### 5.7 CoinGecko market-data integration

CoinGecko is the V2 market-data provider for supported crypto assets. It powers valuation and education; it does **not** grant trading access, import exchange balances, or authorize automatic buying/selling.

#### CoinGecko capabilities to use

| Capability | TrueSpend use |
|---|---|
| Canonical coin catalogue / search | Let a user select the correct crypto asset and save its stable CoinGecko ID rather than guessing from a symbol. |
| Current multi-coin price | Value holdings, portfolio value, net worth, allocation, return, and price freshness. |
| Price in supported quote currencies | Quote assets in the user's base currency when available; otherwise use a documented conversion path and persist the rate used. |
| Historical market chart | Draw portfolio/value history, calculate valuation at trade date where needed, and power Decision Lab market-decline scenarios. |
| Coin market details | Show contextual, factual metadata such as market capitalization and 24-hour change with a data timestamp. |
| Global market/category data | Optional educational market context, never a prompt to chase trends or buy a particular asset. |

CoinGecko’s API supports current simple prices, coin market data, historical market charts, and supported quote currencies. Its API surface and plan availability change over time, so the implementation must consult the live provider documentation when selecting the exact endpoint and plan. [CoinGecko API documentation](https://docs.coingecko.com/)

#### Provider architecture

Create an adapter so the rest of TrueSpend does not depend directly on CoinGecko response shapes:

```ts
interface MarketDataProvider {
  searchAssets(query: string): Promise<MarketAssetSearchResult[]>;
  getLatestPrices(assetIds: string[], vsCurrency: string): Promise<LatestPrice[]>;
  getHistoricalPrices(assetId: string, vsCurrency: string, from: Date, to: Date): Promise<HistoricalPricePoint[]>;
  getSupportedCurrencies(): Promise<string[]>;
}

class CoinGeckoMarketDataProvider implements MarketDataProvider { /* server-only adapter */ }
```

Rules:

- Keep the CoinGecko API key server-side only (`COINGECKO_API_KEY`); never expose it in Vite client code or browser network requests.
- Configure a base URL by plan/environment, for example Demo versus Pro, via environment variables. Do not hard-code a provider plan in product logic.
- Resolve an asset once through provider search/selection, then persist `coingecko_coin_id`. Do not fetch prices by ticker alone.
- Batch price queries for all active portfolio assets; never make one provider call per rendered holding.
- Cache current quotes server-side with a plan-configurable TTL. The UI must show **Price as of [timestamp]** and use the last successful snapshot if refresh fails.
- Run scheduled portfolio refreshes server-side. A user page visit may request a refresh only when the cached quote is stale and rate limits permit it.
- Use exponential backoff for rate-limit/server failures. Persist an error/status record and degrade to the last known price or a user-entered manual price.
- Never overwrite a manual trade execution price with a market quote. Provider prices are for valuation; trade data remains the user’s accounting record.
- Preserve every pricing snapshot used for a displayed historical valuation, including source and capture timestamp.
- Use direct base-currency quotes when the provider supports them. If an intermediate conversion is necessary, store both quote price and conversion rate in the price snapshot.

#### Features enabled by CoinGecko

- Automatic daily/current valuation of crypto holdings in Portfolio.
- Accurate current crypto share within overall net worth and asset allocation.
- Gain/loss and contribution-versus-value reporting with explicit price freshness.
- Price history charts and historical portfolio valuation from the user’s trade dates onward.
- Decision Lab scenarios such as “What if my crypto allocation falls 20%?” using current actual holdings as a starting point.
- Allocation-drift alerts such as “Crypto is now 18% of net worth, above your 10% preferred cap.”
- Currency-aware display for a MAD-based user holding USD-quoted crypto values.
- Rich but non-promotional asset lookup when recording a trade (name, symbol, icon, asset ID).

Do not use trending lists, top gainers, or social momentum as a purchase recommendation engine. They may be available as an explicitly educational, opt-in market-context card, clearly separated from the user’s Financial Plan.

---

## 6. Financial Profile and Strategy Setup

### 6.1 Onboarding / Financial Checkup

The Financial Checkup must be optional, resumable, and usable at any time from Settings or Financial Home.

Collect:

- Base currency and locale.
- Income frequency, regularity, next expected pay date, and typical net income.
- Household/dependents: optional simple disclosure; do not request unnecessary personal information.
- Essential spending estimate or categories.
- Mandatory debt / repayment information.
- Existing emergency cash reserve.
- Short-, medium-, and long-term goals.
- Investment experience: `None`, `Beginner`, `Intermediate`, `Experienced`.
- Loss comfort / risk preference: `Conservative`, `Balanced`, `Growth`, `High Risk`.
- Investment time horizon: `< 1 year`, `1–3 years`, `3–5 years`, `5+ years`.
- Preferred strategy: buffer first, debt first, goal first, balanced, or user-customized.
- Minimum unallocated margin preference.

### 6.2 Strategy behavior

This profile changes recommendation weights, but cannot violate the core safety rules.

Example defaults:

| Strategy | Default emphasis |
|---|---|
| Buffer first | Emergency coverage before substantial investing |
| Debt first | Extra free cash directed to costly/urgent debt |
| Goal first | Deadline feasibility prioritized after essentials |
| Balanced | Buffer, goals, and investments share eligible surplus |
| Custom | User sets target ratios and protected floors |

### 6.3 Insufficient data handling

Do not pretend to have certainty for a new user. Use a staged confidence model:

- `low`: less than one complete financial period or missing commitments.
- `medium`: one to three periods with enough transaction coverage.
- `high`: three or more periods with stable data and confirmed commitments.

When confidence is low, suggest setup tasks and use transparent generic defaults rather than personalized claims.

---

## 7. Recommendation and Planning Engine

### 7.1 Architecture

Create a deterministic domain layer separate from AI prose:

```text
Raw financial records
        ↓
FinancialSnapshotService
        ↓
FinancialPlanningEngine (deterministic rules + calculations)
        ↓
RecommendationService (rank, persist, deduplicate)
        ↓
AI explanation layer (optional natural-language explanation only)
        ↓
Approval / execution service
```

The AI model can summarize and explain results. It must not invent monetary calculations, account IDs, or execute plans directly. Server-side deterministic code remains authoritative.

### 7.2 Financial snapshot

Build a single normalized `FinancialSnapshot` object used by Financial Home, Salary Plan, Coach, Portfolio, notifications, Decision Lab, and AI context.

Required snapshot fields:

```ts
interface FinancialSnapshot {
  asOf: string;
  financialPeriod: { start: string | null; end: string | null; daysRemaining: number };
  liquidCash: number;
  protectedEmergencyCash: number;
  reservedForCommitments: number;
  reservedForGoals: number;
  safeToSpend: number;
  investmentCapacity: number;
  pendingPayables: number;
  pendingReceivables: number;
  investmentMarketValue: number;
  netWorth: number;
  forecast: { expected: number; best: number; worst: number };
  buffer: { current: number; target: number; coverageMonths: number };
  plan: { activePlanId?: string; unallocatedIncome: number; status?: string };
  confidence: 'low' | 'medium' | 'high';
  assumptions: string[];
}
```

### 7.3 Calculation order

1. Determine actual wallet balances from the immutable transaction ledger.
2. Calculate liquid cash using only `Bank`, `Cash`, and eligible user-designated cash-equivalent balances.
3. Identify known commitments before the next expected income: active subscriptions, due debt, and approved plan reservations.
4. Determine the emergency fund target from user strategy and observed essential expenses.
5. Calculate protected emergency cash: the smaller of actual eligible reserve and target reserve; user may set a lower protected floor only after a warning.
6. Assess financial-period budget pace and required remaining category funds.
7. Assess active goal contribution requirements and deadline risk.
8. Calculate surplus / investment capacity only after steps 1–7.
9. Generate and rank recommendations.
10. Generate a draft Salary Plan only when there is an income event or explicit user request.

### 7.4 Default allocation algorithm

The system must use named, configurable rules—not one permanent 50/30/20 template.

Pseudocode:

```ts
function proposeSalaryPlan(snapshot: FinancialSnapshot, income: number, profile: FinancialProfile) {
  let remaining = income;
  const allocations: ProposedAllocation[] = [];

  allocate('commitments', min(remaining, commitmentsDue(snapshot)), required = true);
  allocate('debt', min(remaining, debtMinimumsDue(snapshot)), required = true);
  allocate('emergency_buffer', emergencyContribution(snapshot, profile));
  allocate('goals', goalContributionsRequired(snapshot, profile));
  allocate('budgets', recommendedFlexibleBudgets(snapshot, profile));

  const safetyMargin = minimumSafetyMargin(remaining, profile);
  const investable = max(0, remaining - safetyMargin);
  allocate('investments', recommendedInvestmentContribution(investable, profile));
  allocate('unallocated_margin', remaining);

  return validatePlan(allocations, income, snapshot);
}
```

Requirements:

- Allocation sum must exactly equal income, subject to a tolerance of 0.01 in the base currency.
- Unfunded mandatory items must be visibly marked as a shortfall, never hidden by a balanced-looking plan.
- The engine should make lower-risk allocations before investing where the profile strategy requires it.
- A user edit creates a new draft plan version and must trigger recalculation of downstream effects.
- No percentage template can override real commitments and actual cash availability.

### 7.5 Explainability contract

Every calculation-heavy card must include a `Why this?` panel showing inputs and formula in plain language. Example:

```text
Investment contribution: 600 MAD

Income received:                 6,000 MAD
Less bills and debt due:        -2,400 MAD
Less protected emergency cash:    -900 MAD
Less goal commitments:            -700 MAD
Less flexible spending plan:    -1,000 MAD
Less safety margin:               -400 MAD
Eligible surplus:                  600 MAD
```

---

## 8. Data Model Additions

### 8.1 Migration policy

- Use new additive tables and nullable foreign keys. Do not alter or backfill historical data destructively.
- Add a formal Drizzle migration for each schema change under `drizzle/`; do not add substantial V2 schema through runtime `ALTER TABLE` statements in `src/db/index.ts`.
- Existing runtime compatibility initialization may remain temporarily, but must be removed after migrations are deployed and verified.
- Use PostgreSQL `numeric` / Drizzle `decimal` for money, quantities, price, and exchange rates.
- All data-bearing records must have `user_id`, timestamps, and server-side ownership checks.

### 8.2 New enums

```text
plan_status: Draft | Active | Superseded | Completed | Cancelled
plan_allocation_status: Planned | Approved | Executed | Skipped | Changed | Failed
plan_allocation_type: Commitment | Debt | EmergencyBuffer | Goal | Budget | Investment | UnallocatedMargin
recommendation_type: SalaryPlanReady | UnallocatedIncome | EmergencyBufferGap | BillReserveRequired | BudgetPaceRisk | GoalAtRisk | DebtDueSoon | InvestmentCapacityAvailable | AllocationDrift | UnusualSpending | PlanReviewRequired
recommendation_status: Active | Viewed | Approved | Dismissed | Snoozed | Expired
investment_account_type: Exchange | Brokerage | Retirement | PreciousMetals | Manual | Other
asset_class: Crypto | Stock | ETF | MutualFund | Bond | PreciousMetal | CashEquivalent | Retirement | Other
investment_event_type: Funding | Withdrawal | Buy | Sell | Dividend | Interest | Fee | Adjustment
price_source: Manual | Provider | Import
risk_level: Low | Medium | High | VeryHigh
```

### 8.3 `financial_profiles`

One active financial profile per user.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK, unique | references `users.id`, cascade delete |
| `base_currency` | text | default `MAD` |
| `income_frequency` | text | monthly / weekly / irregular |
| `income_stability` | text | stable / variable / irregular |
| `strategy` | text | BufferFirst / DebtFirst / GoalFirst / Balanced / Custom |
| `risk_preference` | risk level | default `Medium` |
| `investment_experience` | text | None / Beginner / Intermediate / Experienced |
| `investment_horizon` | text | user selected range |
| `emergency_target_months` | numeric | default 3; configurable |
| `minimum_unallocated_amount` | numeric | fixed protected margin |
| `minimum_unallocated_percent` | numeric | optional percentage floor |
| `allow_cash_equivalent_reserve` | boolean | default false |
| `created_at`, `updated_at` | timestamp | |

### 8.4 `financial_plans`

Represents a full financial-cycle or income-event plan. Preserve history rather than overwriting.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `parent_plan_id` | UUID nullable FK | prior version, if revised |
| `payroll_id` | UUID nullable FK | linked existing payroll when applicable |
| `source_transaction_id` | UUID nullable FK | income transaction that initiated plan |
| `status` | plan status | |
| `period_start`, `period_end` | timestamp | financial period covered |
| `income_amount` | numeric | planned/received income amount |
| `base_currency` | text | snapshot currency |
| `snapshot_json` | jsonb | immutable financial inputs and assumptions at creation |
| `engine_version` | text | supports future rule evolution |
| `created_at`, `updated_at`, `approved_at`, `completed_at` | timestamp | |

Indexes: `(user_id, status)`, `(user_id, period_start)`, unique partial index for one `Active` plan per user and financial period if supported by migration approach.

### 8.5 `plan_allocations`

Each plan has multiple auditable allocation lines.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `plan_id` | UUID FK | cascade delete |
| `user_id` | UUID FK | direct access control / query efficiency |
| `type` | allocation type | |
| `name` | text | e.g. `Rent`, `Emergency Fund`, `Dining` |
| `amount` | numeric | non-negative |
| `status` | allocation status | |
| `priority` | integer | lower number = higher priority |
| `category` | text nullable | existing budget category when applicable |
| `goal_id` | UUID nullable FK | goal allocation |
| `investment_account_id` | UUID nullable FK | investment allocation |
| `source_wallet_id` | UUID nullable FK | source liquidity wallet |
| `destination_wallet_id` | UUID nullable FK | savings wallet / transfer target |
| `executed_transaction_id` | UUID nullable FK | real cash ledger event when executed |
| `rationale` | text | short explanation |
| `evidence_json` | jsonb | input values / rule IDs |
| `created_at`, `updated_at`, `executed_at` | timestamp | |

Constraint: `(amount >= 0)`. Enforce allocation-type compatibility in service validation.

### 8.6 `recommendations`

Persist recommendations for auditability, user feedback, and notification deduplication.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `type` | recommendation type | |
| `status` | recommendation status | |
| `priority_score` | numeric | rank calculation output |
| `title`, `summary`, `rationale` | text | user-facing / explainable content |
| `confidence` | text | low / medium / high |
| `action_payload` | jsonb | validated typed command payload, no execution by itself |
| `evidence_json` | jsonb | source facts and rule IDs |
| `dedupe_key` | text | same recommendation detection |
| `available_from`, `expires_at`, `snoozed_until` | timestamp | |
| `created_at`, `updated_at`, `acted_at` | timestamp | |

Unique index: `(user_id, dedupe_key)` for active recommendations or enforce deduplication in the service using current status.

### 8.7 `investment_accounts`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `name` | text | e.g. Binance, Gold, Brokerage |
| `institution` | text nullable | |
| `type` | investment account type | |
| `base_currency` | text | default user base currency |
| `liquidity` | text | Liquid / Restricted / Illiquid |
| `include_in_net_worth` | boolean | default true |
| `include_in_emergency_reserve` | boolean | default false |
| `is_archived` | boolean | default false |
| `created_at`, `updated_at` | timestamp | |

### 8.8 `investment_assets`

Global or user-owned asset registry. Start user-owned to keep the MVP simple; later add a canonical provider-backed instrument catalogue.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK nullable | nullable if introduced as globally managed later |
| `symbol` | text | BTC, XAU, VOO, etc. |
| `name` | text | |
| `asset_class` | asset class | |
| `coingecko_coin_id` | text nullable | Canonical CoinGecko ID for supported crypto; never infer from symbol after selection |
| `quote_currency` | text | e.g. USD / MAD |
| `units_precision` | integer | default 8 |
| `risk_level` | risk level | |
| `market_data_provider` | text nullable | `CoinGecko` for provider-linked crypto; null for manual assets |
| `is_active` | boolean | default true |
| `created_at`, `updated_at` | timestamp | |

Unique index: `(user_id, symbol, quote_currency)` for user-defined assets.

### 8.9 `investment_events`

The portfolio’s immutable event ledger. Do not store only a mutable current balance.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `investment_account_id` | UUID FK | |
| `asset_id` | UUID nullable FK | null for account-level funding / withdrawal if appropriate |
| `type` | investment event type | |
| `trade_date` | timestamp | effective date |
| `units` | numeric nullable | positive quantity |
| `unit_price` | numeric nullable | in quote currency |
| `quote_currency` | text | |
| `gross_amount` | numeric | positive event value before fees |
| `fee_amount` | numeric | default 0 |
| `fee_currency` | text | |
| `exchange_rate_to_base` | numeric | required if quote differs from base |
| `base_amount` | numeric | immutable normalized MAD/base value |
| `linked_transaction_id` | UUID nullable FK | cash funding/withdrawal only when present |
| `notes` | text nullable | |
| `created_at`, `updated_at` | timestamp | |

Validation:

- `Buy` and `Sell` require asset, units > 0, unit price >= 0, and gross amount > 0.
- `Funding` and `Withdrawal` require a linked cash transaction when created through the plan execution flow.
- `Fee` has no units and must have a positive fee/base amount.
- No deletion once an event is used in valuation history; use a correcting `Adjustment` event or soft-delete with audit record.

### 8.10 `investment_lots`

Lots support cost-basis calculations and partial sales.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `investment_event_id` | UUID FK | originating Buy event |
| `investment_account_id` | UUID FK | |
| `asset_id` | UUID FK | |
| `acquired_at` | timestamp | |
| `original_units`, `remaining_units` | numeric | |
| `cost_basis_base` | numeric | includes buy fees |
| `created_at`, `updated_at` | timestamp | |

Default sell matching: FIFO. Maintain `lot_disposals` if accurate realized P/L is implemented in the MVP; otherwise make realized gain a later phase and clearly label it unavailable.

### 8.11 `price_snapshots`

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `asset_id` | UUID FK | |
| `user_id` | UUID FK nullable | owner for manual user-specific price |
| `price` | numeric | |
| `currency` | text | |
| `exchange_rate_to_base` | numeric | |
| `price_in_base` | numeric | materialized for query simplicity |
| `source` | price source | |
| `provider` | text nullable | `CoinGecko` for automatic crypto prices |
| `provider_asset_id` | text nullable | CoinGecko coin ID used to retrieve this quote |
| `provider_price_timestamp` | timestamp nullable | provider quote time if supplied |
| `captured_at` | timestamp | |

Unique index: `(asset_id, captured_at, source)`.

### 8.12 `financial_snapshots`

Periodic snapshots support historical charts without recalculating old financial state using later data/configuration.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID PK | |
| `user_id` | UUID FK | |
| `snapshot_date` | date | |
| `liquid_cash`, `reserved_cash`, `safe_to_spend` | numeric | |
| `investment_value`, `total_debt`, `net_worth` | numeric | |
| `emergency_coverage_months` | numeric | |
| `data_json` | jsonb | detailed breakdown / engine version |
| `created_at` | timestamp | |

Unique index: `(user_id, snapshot_date)`.

---

## 9. Ledger and Financial Calculation Rules

### 9.1 Separate financial concepts

| Measure | Definition | Investment included? |
|---|---|---:|
| Wallet balance | Current balance of a Bank/Cash/Savings wallet | No |
| Liquid cash | Cash usable soon: Bank + Cash + eligible cash equivalents | No by default |
| Reserved cash | Amount protected for bills, debt, goals, or plan allocations | No |
| Safe to spend | Liquid cash minus all protections/reservations | No |
| Investment value | Latest valuation of holdings/account cash | Yes, separately |
| Net worth | Liquid cash + investment value + receivables − payables | Yes |

### 9.2 V2 safe-to-spend formula

Replace the simplified V1 formula in future engine versions with a breakdown that preserves backward compatibility in the existing KPI response.

```text
safeToSpend = max(0,
  liquidCash
  - protectedEmergencyCash
  - reservedForUpcomingCommitments
  - pendingPayablesDueBeforeNextIncome
  - approvedGoalReserves
  - remainingRequiredBudgetReserve
)
```

Do not subtract the same cash twice. Reservations must be normalized and assigned a source / purpose. The engine must expose the line-item breakdown to UI and tests.

### 9.3 Net-worth formula

```text
netWorth = liquidCash
         + eligibleSavings
         + investmentMarketValue
         + pendingReceivables
         - pendingPayables
```

Do not include the same savings wallet twice in both liquid cash and eligible savings. The financial snapshot service must define a single balance classification for each asset/wallet.

### 9.4 Financial period compatibility

TrueSpend currently uses payroll-defined financial periods. Preserve this behavior:

- Financial-month budgeting and plan pacing should use the existing payroll/financial-month utilities.
- Calendar-month reports and existing `category_budgets` remain supported.
- A new `financial_plan` records exact start/end boundaries, preventing ambiguity if a payroll schedule changes later.

### 9.5 Money precision

- Persist money and units as decimals/numerics.
- Avoid `parseFloat` in values persisted or compared for accounting-critical logic. Convert to a decimal-safe representation or numeric-string utilities in domain services.
- UI may display rounded values, but server calculation and persisted values retain precision.
- Define consistent rounding: base-currency display rounds to 2 decimals; crypto units follow asset precision; formulas round only at display/output boundaries.

---

## 10. API Specification

All endpoints require the existing `requireAuth` middleware unless stated otherwise. Controllers must resolve the database user from the authenticated Firebase identity; never trust `userId` supplied by the client.

### 10.1 Financial profile

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/financial-profile` | Return profile or defaults + completion status |
| `PUT` | `/api/financial-profile` | Create/update validated profile |
| `POST` | `/api/financial-profile/checkup` | Save a checkup step or full onboarding response |

### 10.2 Financial Home / planning snapshot

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/financial-home` | Full V2 snapshot, top recommendations, active plan summary |
| `GET` | `/api/financial-snapshots?from=&to=` | Historical net-worth/position series |
| `POST` | `/api/financial-snapshots/refresh` | Recompute current snapshot; admin/internal route only if necessary |

`GET /api/financial-home` response must include `FinancialSnapshot`, active plan summary, actionable recommendations, and a `dataCompleteness` list.

### 10.3 Financial plans

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/financial-plans` | List plan history |
| `GET` | `/api/financial-plans/:id` | Plan detail and allocation history |
| `POST` | `/api/financial-plans/draft` | Generate a deterministic draft from income / period |
| `PUT` | `/api/financial-plans/:id` | Edit allowable draft allocation fields; create a new version if active |
| `POST` | `/api/financial-plans/:id/approve` | Approve selected allocations |
| `POST` | `/api/financial-plans/:id/replan` | Generate revision using current snapshot |
| `POST` | `/api/financial-plans/:id/cancel` | Cancel draft/active plan with reason |

`POST /approve` payload:

```json
{
  "allocationIds": ["uuid-1", "uuid-2"],
  "sourceWalletId": "uuid",
  "confirmWarnings": ["investment-before-target-buffer"]
}
```

Approval must be transactional: create needed transfers / goal contributions / account funding events, update allocation statuses, and return the plan. If one cash-moving execution fails, rollback the database transaction and return a clear error.

### 10.4 Recommendations

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/recommendations` | Active and optionally historical recommendations |
| `POST` | `/api/recommendations/:id/viewed` | Mark viewed |
| `POST` | `/api/recommendations/:id/dismiss` | Dismiss with optional feedback |
| `POST` | `/api/recommendations/:id/snooze` | Snooze until date |
| `POST` | `/api/recommendations/:id/approve` | Route recommendation through the same validated action/plan approval logic |

### 10.5 Investments

| Method | Path | Purpose |
|---|---|---|
| `GET/POST` | `/api/investment-accounts` | List/create investment accounts |
| `GET/PUT/DELETE` | `/api/investment-accounts/:id` | Read/update/archive account |
| `GET/POST` | `/api/investment-assets` | List/create manually tracked assets |
| `GET/POST` | `/api/investment-events` | List/create immutable investment events |
| `POST` | `/api/investment-events/:id/correct` | Append correcting adjustment rather than mutate audited event |
| `GET` | `/api/portfolio` | Holdings, values, gain/loss, allocation, risk summary |
| `GET` | `/api/portfolio/performance?from=&to=` | Historical performance series |
| `POST` | `/api/portfolio/prices` | Create a manual price snapshot |
| `POST` | `/api/investment-accounts/:id/fund` | Validated paired wallet transfer + Funding event |
| `POST` | `/api/investment-accounts/:id/withdraw` | Validated paired withdrawal + wallet transfer |

### 10.6 Market data (CoinGecko-backed, server-side)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/market-data/assets/search?q=` | Search CoinGecko assets for trade-entry selection; returns sanitized/normalized results |
| `GET` | `/api/market-data/assets/:coinGeckoId` | Return provider metadata and latest cached quote for a selected asset |
| `POST` | `/api/market-data/prices/refresh` | Refresh a bounded set of active portfolio crypto prices; protected/rate-limited server operation |
| `GET` | `/api/market-data/assets/:coinGeckoId/history?from=&to=&currency=` | Return cached/provider historical series for charts and simulations |
| `GET` | `/api/market-data/status` | Return provider availability, last refresh, freshness, and fallback state; never exposes provider keys/limits unnecessarily |

The browser communicates only with these TrueSpend API routes. `CoinGeckoMarketDataProvider` makes outbound requests from the server and persists normalized `price_snapshots`.

### 10.7 AI action gateway additions

Add structured action types only after their deterministic endpoints/services exist:

- `create_financial_plan_draft`
- `approve_financial_plan`
- `update_financial_profile`
- `create_investment_account`
- `create_investment_event`
- `record_manual_price`
- `create_decision_scenario`

The AI may propose these actions, but the frontend must display review data and obtain approval. All action payloads must be schema-validated server-side.

---

## 11. Frontend Specification

### 11.1 New TypeScript types

Add typed interfaces in `src/types/index.ts` for:

- `FinancialProfile`
- `FinancialSnapshot`
- `FinancialPlan`
- `PlanAllocation`
- `Recommendation`
- `InvestmentAccount`
- `InvestmentAsset`
- `InvestmentEvent`
- `InvestmentHolding`
- `PortfolioSummary`
- `PriceSnapshot`
- `DecisionScenario`

No `any` payloads for V2 financial or investment data.

### 11.2 New components

Suggested component structure:

```text
src/components/dashboard/
  FinancialHomeTab.tsx
  SalaryPlanTab.tsx
  FinancialRoadmapTab.tsx
  PortfolioTab.tsx
  RecommendationFeed.tsx
  FinancialPositionCard.tsx
  NextBestActionCard.tsx
  PlanAllocationEditor.tsx
  PlanRationalePanel.tsx
  FinancialCheckupModal.tsx
  InvestmentAccountForm.tsx
  InvestmentEventForm.tsx
  CryptoAssetPicker.tsx
  PortfolioAllocationChart.tsx
  PortfolioValueChart.tsx
  MarketDataFreshnessBadge.tsx
  InvestmentCapacityCard.tsx
  DecisionLabTab.tsx
```

Use the existing shared `Card`, `Button`, `Input`, `Select`, `Skeleton`, Tailwind styles, Lucide icons, and Recharts patterns. Ensure mobile usability: Salary Plan editing must be readable and actionable on small screens.

### 11.3 Dashboard integration

- Add `financial-home`, `plan`, `portfolio`, and `roadmap` values to `DashboardTab` in `src/types/index.ts`.
- Keep existing tabs functional throughout migration.
- Make `financial-home` the default tab for users with a completed Financial Checkup or an active plan. Keep Overview available for familiar V1 analytics during transition.
- Extend `useDashboardData` with V2 fetches and mutation handlers; use `Promise.all` for independent fetches and refetch only affected resources after mutations.
- Extend `dashboardService` with typed methods for every V2 endpoint.

### 11.4 Key UX states

Every V2 screen needs:

- Loading skeleton.
- Empty state.
- Missing-data / setup state.
- Error state with retry.
- No-plan state.
- Low-confidence recommendation state.
- Pending user approval state.
- Completed / revised plan history.

Example empty Portfolio state:

> You have not added investments yet. TrueSpend will first calculate your protected cash and investment capacity. Then you can track a manual account, crypto, gold, funds, or another asset.

### 11.5 Accessibility and clarity

- Never use color alone to represent gain/loss, risk, or urgency; include icons/text.
- Use `MAD` consistently with readable number formatting.
- Distinguish actuals from forecasts visually and verbally.
- Show date range and currency on every chart or plan.
- Use confirmation dialogs for plan execution, funding, withdrawals, and investment events.

---

## 12. Backend Services and Responsibilities

Create these services/repositories following the current service/repository/controller pattern.

### 12.1 `FinancialSnapshotService`

Responsibilities:

- Load wallets, transactions, budgets, payrolls, subscriptions, debts, goals, plan allocations, and portfolio valuation.
- Use/extend the current `computeFinancialState` without duplicating balance math.
- Produce the canonical `FinancialSnapshot` and explainable line-item breakdown.
- Determine data completeness and recommendation confidence.
- Save daily `financial_snapshots` via a scheduled idempotent task.

### 12.2 `FinancialPlanningEngine`

Responsibilities:

- Deterministically create a draft salary plan from snapshot/profile/income.
- Validate user plan edits.
- Detect shortfalls and conflicts.
- Calculate deadlines, buffer coverage, budget pacing, and investment capacity.
- Return machine-readable rationale/evidence alongside each output.

This service must be pure or nearly pure, with injected data; write unit tests before UI integration.

### 12.3 `FinancialPlanService`

Responsibilities:

- Create, version, read, revise, approve, execute, complete, and cancel plans.
- Enforce plan lifecycle and single-active-plan policy.
- Execute selected allocations in a database transaction.
- Delegate real ledger entries to `TransactionService`, `GoalService`, and `InvestmentService`; do not hand-code duplicate transaction semantics.

### 12.4 `RecommendationService`

Responsibilities:

- Run recommendation rules against the snapshot.
- Calculate a priority score.
- Persist/deduplicate recommendation events.
- Respect dismissed/snoozed settings and cooldowns.
- Expose top recommendations for Financial Home and notifications.

### 12.5 `InvestmentService`

Responsibilities:

- Validate accounts, assets, events, lots, price snapshots, and account ownership.
- Create paired wallet transfers for funding/withdrawal using the existing transaction service.
- Compute holdings, cost basis, unrealized/realized return, allocation, and risk concentration.
- Provide automatic CoinGecko valuation for supported crypto with a timestamped manual-price fallback for unsupported assets or provider failures.
- Never alter wallet balances merely because a market price changes.

### 12.6 `CoinGeckoMarketDataProvider` and `MarketDataService`

Responsibilities:

- Keep CoinGecko HTTP/streaming integration isolated behind the `MarketDataProvider` interface in Section 5.7.
- Search and normalize crypto assets, including the canonical CoinGecko ID, name, symbol, image URL where permitted, and supported quote metadata.
- Batch-refresh prices for active crypto holdings, persist normalized price snapshots, and expose latest successful price/freshness.
- Retrieve/cache historical price points only for bounded chart/scenario date ranges.
- Enforce provider configuration, request budgets, cache TTLs, retry/backoff, and fallback behavior centrally.
- Return a typed provider failure result to Portfolio rather than throwing an unhandled error that breaks Financial Home.

Configuration required:

```text
COINGECKO_API_KEY=...              # server-only secret
COINGECKO_API_BASE_URL=...         # provider endpoint appropriate to the selected plan
COINGECKO_PRICE_TTL_SECONDS=...    # conservative, plan-aware cache duration
COINGECKO_HISTORY_TTL_SECONDS=...
```

Do not log the API key. Do not add it to `.env.example` with a real value. Document a blank placeholder and the provider plan assumptions.

### 12.7 `FinancialNotificationService`

Extend the current notification scheduler rather than sending generic daily spend recaps only.

Priority notification candidates:

- Salary Plan ready.
- Bill or debt reserve shortfall.
- Emergency buffer falling below protected level.
- Goal deadline at risk.
- Critical budget pace breach.
- Important plan review.

Respect `notification_preferences`, delivery timezone, quiet hours, and idempotency in `notification_deliveries`. Use a dedicated recommendation notification preference rather than forcing all users into financial coaching notifications.

---

## 13. AI and Financial Intelligence Requirements

### 13.1 AI role

The AI is a conversational interface and explainer. Deterministic services remain the source of truth for calculations, eligibility, and mutations.

AI responsibilities:

- Explain plan recommendations in plain language.
- Help the user fill missing context.
- Answer questions using the canonical financial snapshot.
- Propose structured, permissioned actions.
- Summarize trade-offs from the Decision Lab.

AI must not:

- Claim to know future prices or guarantee returns.
- Select individual securities as a personalized recommendation.
- Invent balances, portfolio performance, wallet IDs, or price data.
- Treat volatile assets as emergency cash.
- execute a financial action without approval.

### 13.2 AI context additions

Append compact V2 context to the existing AI context only after it is available:

- Financial snapshot and calculation breakdown.
- Financial profile, strategy, risk preference, and data confidence.
- Active plan and allocations.
- Top recommendations with IDs.
- Portfolio summary and price timestamp(s).
- Clear disclaimers/limitations for investment discussion.

Do not send raw full transaction histories unnecessarily. Reuse the existing context-length controls and include only relevant aggregates / recent events.

### 13.3 AI prompts and action schemas

Update the current chat system instruction to teach the AI:

- Financial Home/Salary Plan/Portfolio meanings.
- The distinction between an investment funding transfer, a buy, a valuation change, and income.
- The priority/safety rules from Section 3.
- The requirement to use live IDs only from context.
- The requirement to present assumptions and confidence.

Validate actions with a runtime schema library or explicit validators before `AiActionGateway` execution. TypeScript types alone are insufficient for request safety.

---

## 14. Migration and Compatibility Plan

### 14.1 Phase 0 — Stabilize foundations

Before V2 logic is relied on:

- Add regression tests around `financialEngine` wallet totals, transfers, safe-to-spend, payroll periods, debts, budgets, and savings behavior.
- Document current edge cases: legacy `sourceWallet` strings versus `walletId`; default wallet fallback; savings use as emergency buffer.
- Ensure V1 UI remains usable if no V2 data exists.
- Add a formal migration process for V2 instead of continued runtime schema mutation.

### 14.2 Phase 1 — Financial profile and snapshot

- Add `financial_profiles`, `financial_snapshots`.
- Implement `FinancialSnapshotService` and read-only `/api/financial-home`.
- Display Financial Home with no mutation capabilities initially.
- Add Financial Checkup modal.
- Preserve existing KPIs; add a detailed safe-to-spend breakdown rather than silently changing a number without explanation.

### 14.3 Phase 2 — Salary Plan and adaptive budgets

- Add plans, allocations, recommendations.
- Build deterministic draft, edit, approval, partial approval, replan, and audit history.
- Integrate with existing `category_budgets`, Goals, Subscriptions, Wallets, and transactions.
- Add recommendation feed and notifications.

### 14.4 Phase 3 — Portfolio MVP with CoinGecko

- Add investment accounts, assets, events, lots, and price snapshots, including CoinGecko canonical crypto IDs.
- Implement the server-only CoinGecko provider adapter, cache/fallback policy, scheduled price refresh, and asset search.
- Build manual trade-event forms and a Portfolio dashboard with automatic current/historical crypto valuation, price timestamps, and manual-price fallback.
- Add investment capacity to Financial Home and Salary Plan.
- Include investments in net worth but exclude them from liquidity by default.

### 14.5 Phase 4 — Advanced intelligence

- Decision Lab scenarios linked to active plans.
- Portfolio allocation rules / drift reminders.
- Additional market-data providers for non-crypto assets behind the existing provider abstraction, cache, timestamp, and graceful fallback.
- CSV imports for a carefully selected exchange/broker format.
- More sophisticated debt/goal optimization after the basic rules and trust model are proven.

### 14.6 Backfill policy

- Do not fabricate plans or investment events from historical expenses.
- Create a profile with conservative defaults only after user confirmation or on first V2 visit.
- Optionally create a first `financial_snapshot` from existing data on V2 initialization.
- Existing `Savings` wallets remain Savings. Do not auto-convert them to investment accounts.
- Existing goals and budgets continue to work without links to a plan; offer a user-initiated “include in plan” transition.

---

## 15. Testing and Acceptance Criteria

### 15.1 Required automated tests

Add focused unit tests for:

- Salary Plan allocation totals exactly match available income.
- Mandatory commitments are funded before investments under default strategy.
- Investment capacity is zero when liquidity is below protections/reservations.
- Receivables do not increase safe-to-spend.
- Investment value does not increase safe-to-spend.
- Bank → Investment Account funding does not count as expense or income.
- Buy/sell events calculate holdings and cost basis correctly.
- Market price update changes portfolio and net worth but does not create cash ledger income.
- CoinGecko asset selection persists the canonical coin ID; later price refreshes never rely on a possibly ambiguous ticker symbol.
- Provider rate-limit/error response keeps the last successful price, labels it stale, and does not block Financial Home.
- A provider quote is stored with source/timestamp and never replaces the user-entered trade execution price.
- Transfers leave net worth unchanged before market effects.
- Goal allocations and wallet transfers do not double-count in reservations.
- Financial period boundaries remain correct around payday/payroll dates.
- Recommendation deduplication, snooze, and dismissal work.
- Plan approval is atomic: failures do not leave partial transactions/allocations.
- Every V2 endpoint denies access to another user’s records.

### 15.2 Manual acceptance scenarios

#### Scenario A: first salary plan

1. A new user completes Financial Checkup with monthly 6,000 MAD income, 1,000 MAD emergency reserve, active rent/subscriptions, and a laptop goal.
2. The user records/receives a 6,000 MAD salary.
3. TrueSpend creates a visible, editable draft plan with explanations and low/medium confidence where appropriate.
4. The user approves emergency and goal contributions but postpones investment.
5. Only approved transfers/goal actions are executed; category budget plans are saved without a false cash expense.
6. Financial Home updates without double-counting money.

#### Scenario B: investing only after safety

1. User has insufficient protected emergency cash.
2. Financial Home may show investment capacity as 0 and recommends buffer contribution first.
3. User can override only after a clear warning; the override is recorded in plan rationale/audit history.

#### Scenario C: manual crypto purchase

1. User funds Binance from Main Bank with 500 MAD.
2. Wallet liquidity decreases by 500 MAD; net worth does not change from funding alone.
3. User records a BTC buy using account cash, units, price, and fee.
4. No expense is added to category budgets.
5. User records a new manual BTC price.
6. Portfolio value and net worth change; safe-to-spend remains unchanged.

#### Scenario D: plan re-evaluation

1. An unplanned high expense occurs after the user approved a plan.
2. Financial Home identifies the material impact and creates one prioritized replan recommendation.
3. It does not silently cancel goals or investments.
4. User reviews the changed trade-off and approves/dismisses it.

### 15.3 Definition of done for a V2 phase

A phase is done only when:

- DB migrations are checked in and apply to a fresh and existing database.
- API input/output types and ownership checks exist.
- Financial calculations are unit-tested and explainable in UI.
- Loading, empty, error, and mobile states are implemented.
- Existing V1 transaction, goal, budget, debt, and wallet flows still work.
- `npm run lint` and existing financial tests pass.
- No financial mutation happens from an AI response without review/approval.

---

## 16. Implementation Conventions for the Coding Agent

### 16.1 Work incrementally

Do not attempt a wholesale frontend rewrite. Implement in vertical slices:

1. Schema/migration + repository.
2. Pure service calculation + tests.
3. Controller/routes + typed client method.
4. Hook integration.
5. One complete UI path.
6. Regression verification.

### 16.2 Maintain one source of truth

- Cash balances: existing transaction/wallet ledger and financial engine.
- Portfolio holdings/value: investment events/lots/prices through `InvestmentService`.
- Financial position: `FinancialSnapshotService`.
- Plan state: `FinancialPlanService`.
- Recommendation ranking: `RecommendationService`.

Do not independently recalculate safe-to-spend in React components, AI prompts, controllers, and services. UI consumes the canonical server response.

### 16.3 Transaction execution

For plan approvals, use a database transaction where repositories/services support it. The final state must not show an allocation as executed unless its linked ledger operation succeeded.

### 16.4 Auditability

Financial facts must be traceable:

- Plan allocations retain rationale and evidence.
- Recommendation responses retain status/history.
- Investment corrections append a correction event rather than erasing history.
- When an AI-generated proposal is approved, store enough metadata to identify the proposal/action source without saving unnecessary conversation content.

### 16.5 Performance

- Avoid loading unbounded transaction history on the dashboard; aggregate by financial period/date range in repositories/services where possible.
- Cache or persist daily financial snapshots for charts.
- Price fetches, when introduced, must be backgrounded, rate-limited, timestamped, and never block the financial home response.
- Run recommendation generation idempotently after relevant events and on scheduled jobs; do not generate duplicate records on every page load.

---

## 17. Recommended Initial Build Backlog

Build in this exact order unless a blocking repository issue requires adjustment:

1. Regression test current financial engine and document baseline behavior.
2. Add `FinancialProfile` schema/API/checkup UI.
3. Add `FinancialSnapshotService` and `GET /api/financial-home`.
4. Build Financial Home read-only with safe-to-spend breakdown and data completeness.
5. Add `FinancialPlan` + `PlanAllocation` schema and deterministic draft-generation tests.
6. Implement Salary Plan review/edit/approve flow with category budget integration.
7. Add Recommendations persistence, feed, and one high-value notification: Salary Plan Ready.
8. Add Investment Account, Asset, Event, Price Snapshot schema/API, plus server-only CoinGecko provider adapter and caching.
9. Build Portfolio MVP with manual trade entry, automatic CoinGecko crypto valuation, manual fallback, and investment value in V2 net worth.
10. Add investment-capacity logic and Salary Plan investment allocation.
11. Expand Decision Lab and AI action schemas after deterministic services are reliable.

---

## 18. Product Success Signals

V2 is succeeding when a user can answer these without manually calculating them:

1. **What can I safely spend today?**
2. **What money is already committed?**
3. **What should I do with this salary?**
4. **Am I building enough protection for emergencies?**
5. **Will I still reach my goals if I change this decision?**
6. **How much can I invest without putting my stability at risk?**
7. **What do I own, what do I owe, and how is my net worth changing?**

The experience must feel like a calm, transparent personal CFO: helpful, educational, and practical—never a black box, a source of shame, or a trading app that encourages risky behavior.
