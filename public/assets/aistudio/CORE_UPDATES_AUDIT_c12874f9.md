# TrueSpend Core Updates — Main Branch Audit and Refined Recommendations

## Audit scope

- Repository: `San-AMRANI/TrueSpend-ggl`
- Audited branch: `main`
- Audited commit: `53bcfb6f7d3ad6bebe799a57b1bf8ddd703d87ed`
- Audit date: 2026-11-12
- Scope: the documented features, database schema, financial engines, dashboard components, API services, notification logic, Android bridge and service worker.

The repository metadata identifies `feature/checkpoint` as its default branch. This review intentionally targets `main`, as requested. The recommendations below are based on `main`, not on other feature branches.

This is a feature-overlap audit, not an implementation approval. It distinguishes existing functionality from focused extensions. A feature is not considered missing merely because its implementation has a different name or is distributed across multiple modules.

## 1. Existing functionality that should not be rebuilt

The following capabilities are already present on `main`. They should be preserved, integrated or improved in place—not recreated as separate modules.

| Area | Verified current implementation | Decision |
|---|---|---|
| Wallet/account basics | Wallet CRUD, multiple Bank/Cash/Savings/Investment wallets, balance calculation, reserve handling and Binance synchronization | Do not build another wallet manager. Extend the existing account model only where its type and currency limitations require it. |
| Manual reconciliation | `WalletsManager` compares the recorded balance with a manually entered actual bank/cash balance and supports baseline adjustment or logging an adjustment transaction | Do not add a second manual reconciliation screen. Add statement-file import and transaction-level matching. |
| Transactions and cash flow | Income, Expense, Transfer and Debt Repayment; wallet transfers; reimbursement splits; partial payable amounts; payroll linkage; transaction editing and deletion | Do not replace the transaction UI or add another cash-flow module. Add stronger accounting postings and data-integrity guarantees underneath it. |
| Financial periods | Custom payroll-anchored periods, historical financial-period ledger, opening/closing liquidity reconciliation and cycle retrospectives | Do not create another payday or financial-period engine. |
| Financial state and health | `computeFinancialState` calculates wallet balances, Safe-to-Spend, daily allowance, runway, forecast and a multi-factor health score | Do not introduce a second Financial Health Engine. Extend the existing calculations when the account and liability model expands. |
| Predictive cash flow | `computeHolisticForecast` projects daily cash flow for 30 days and a 24-month financial/net-worth trajectory, including scheduled payroll, subscription dates, debt due dates, spending patterns, goals, contexts and investment assumptions | Do not build a separate predictive engine. Improve forecast inputs, calibration, explainability and actual-versus-projected tracking. |
| Calendar/timeline | `FinancialCalendarTab` combines transactions, payroll dates, pending debt due dates, active/planned subscription projections and payday-related investment reminders | Do not add another financial calendar or timeline. Improve the shared event model behind the existing calendar and forecast. |
| Recurring commitments | Subscription CRUD, multiple billing cycles, planned/active/paused/reviewing/cancelled statuses, recurring detection, normalized monthly burn and one-click payment logging | Do not rebuild subscriptions or generic recurring-payment detection. Add occurrence history and common event handling where needed. |
| Debts | Receivables, payables, partial settlement, settlement transactions, forgiveness and remaining-balance tracking | Do not create another debt tracker. Add scheduled repayment plans, interest/fees and clearer payment allocation only if needed. |
| Budgeting | Category budgets, Envelope view, 50/30/20, personalized pattern allocations, retention-aware budgeting, debt servicing reserve and investment allocation/reserve | Do not build another allocation or envelope module. Extend existing budgets with explicit rollover/reserve rules and auditable allocation history where missing. |
| Goals and sinking goals | Goal creation, contributions, withdrawals, wallet auto-sync and calculator workflows that include sinking goals | Do not add a second goal system or basic contribution UI. Improve the traceability and reconciliation of contributions. |
| What-if and calculators | `CalculatorsHubTab` includes affordability, debt payoff, salary waterfall, inflation, bill split and a live what-if ledger simulator; `predictiveEngine` also accepts scenario parameters | Do not build a new what-if simulator. Add saved, comparable, multi-event scenarios. |
| Notifications | Client smart-notification generation, channel preferences, server-side scheduled delivery, push subscriptions, quiet hours and notification delivery records | Do not create a second notification centre. Add user-defined rules or thresholds only where current fixed rules do not cover them. |
| SPEX | Scoped financial context, historical financial information, forecast and investment context, structured action proposals and explicit approval before execution | Do not build another AI assistant or generic agent. Add pre-action simulation and a small number of missing domain actions. |
| Investments and net worth | Stock/ETF/BVC and crypto integration, Binance Spot/Funding/Simple Earn reads, orders, dividends, market-data history, portfolio snapshots and estimated unified net worth in AI context | Do not rebuild the investment suite or create a duplicate net-worth dashboard. Expand the assets/liabilities represented by the existing net-worth calculation. |
| Android shell | Capacitor Android project, native bridge, API routing, hardware back button, status bar, splash screen, haptics and keyboard behavior | Do not rebuild the Android wrapper. Add offline transaction capture and safe synchronization if offline use is required. |
| Backups | SQL export/import endpoints and scheduled Google Drive upload exist | Do not add another backup button or scheduler. Correct the coverage and recovery limitations described below. |

### Important existing implementation details

- The current account model is wallet-based. The database declares Bank, Cash, Savings and Investment wallet types. An `account_type` enum containing `Credit` also exists, but the inspected schema does not define a corresponding `financial_accounts` table.
- Manual account reconciliation already exists in `WalletsManager`. It accepts a manually entered real balance; it does not import bank statement lines or match them against transactions.
- The financial calendar already projects payroll, debt and subscription events. `predictiveEngine` separately simulates daily liquidity and longer-horizon trajectories.
- Sinking goals and a live what-if simulator already exist in `CalculatorsHubTab`. Their existence should be treated as a starting point, not as a reason to add a parallel planning tool.
- SPEX has more capabilities than the current AI documentation describes. `AiActionGateway` also contains approved stock-buy and dividend-recording actions. The AI documentation should be updated to reflect the actual code.

## 2. Verified gaps and worthwhile extensions

Only the following updates are recommended after removing duplicates.

### A. Add a balanced accounting-posting layer underneath existing transactions

**Status: Partial capability exists; the accounting layer is missing. Priority: Critical.**

TrueSpend already has a transaction ledger in the product sense: transaction records, wallet references and cash-flow calculations. What is not present in the inspected schema is a general-purpose double-entry journal with journal entries and balanced debit/credit lines.

Add an accounting-posting layer without replacing the existing transaction experience:

- Keep the current transaction as the user-facing business event.
- Create one or more balanced journal entries for each posted event.
- Support asset, liability, income, expense, equity and clearing accounts.
- Represent transfers as movements between accounts, not income or expense.
- Represent credit-card purchases as a liability increase and payments as liability settlement.
- Represent investment purchases, sales, fees, dividends and FX conversion without double-counting expenses or assets.
- Require every journal entry to balance before posting.
- Correct posted records through reversal/correction entries rather than silent deletion.
- Preserve a clear link between the business transaction and its accounting postings.

**Atomicity requirement:** `TransactionService` orchestrates creation of a transaction and related debt/split records through sequential repository calls. Verify whether repository/database layers provide an enclosing transaction; if not, wrap the full operation in one database transaction so a failure cannot leave a partially created financial event. Apply the same atomicity rule to goal contributions, debt settlements, investment cash synchronization and other multi-record financial commands. Add idempotency protection to prevent duplicate posting on retries.

This is an extension of the current transaction engine—not a second transaction system.

### B. Extend the existing wallet model into a richer financial-account model

**Status: Partial capability exists. Priority: High.**

The current wallet manager is already useful and should remain. The limitation is the underlying account vocabulary and attributes.

Extend existing wallets/accounts to support, where applicable:

- Credit-card and overdraft accounts.
- Account institution/provider and account reference metadata.
- Currency per account.
- Statement closing date, payment due date, minimum payment and available credit for credit products.
- Liability balance and credit limit, distinct from cash liquidity.
- External/manual valuation status and balance freshness.
- Account-specific reconciliation history.

Do not treat a credit-card account as an ordinary cash wallet. Spending on credit creates a liability; paying the card settles that liability and must not count as a second expense.

The `Credit` enum alone does not provide this functionality. Confirm its intended role before using it as the basis of a migration.

### C. Make multi-currency support consistent across the financial core

**Status: Partial capability exists in investments and subscriptions; missing from core cash transactions and wallets. Priority: High.**

Investment orders already preserve native amounts and an exchange rate used, and subscriptions support a currency field. The main transaction and wallet structures inspected do not expose a general currency field or historical FX record.

Add:

- Currency on accounts and monetary transactions.
- A reporting/base currency setting.
- Historical exchange-rate records with source and timestamp.
- The rate actually applied to each transaction, locked at posting.
- Explicit currency-conversion events with both source and destination amounts.
- Historical MAD reporting that does not revalue old transactions using today's rate.
- FX gain/loss reporting where relevant.

Do not rebuild the investment-specific currency handling. Reuse or normalize it behind a shared currency service.

### D. Extend manual reconciliation into statement import and transaction matching

**Status: Manual balance reconciliation exists; statement import/matching is missing. Priority: High.**

Keep the existing manual balance comparison in `WalletsManager`. Add a statement-import workflow rather than another reconciliation screen.

Start with CSV and XLSX because bank statement formats vary. Add configurable column mapping and other formats only where there is a reliable parser.

The workflow should:

1. Import a file into a tracked import batch.
2. Normalize date, description, amount, currency and reference.
3. Detect duplicates and repeated imports.
4. Suggest matches to existing TrueSpend transactions using amount, date, description and account.
5. Show matched, unmatched and ambiguous rows separately.
6. Let the user create a transaction from an unmatched row or link it to an existing transaction.
7. Reconcile the statement's opening and closing balances.
8. Preserve the import file metadata, matching decision and reconciliation result for audit.

Do not automatically post uncertain matches. Keep the user in control of final confirmation.

### E. Add a persistent financial review inbox, reusing existing capture tools

**Status: Partial capability exists. Priority: Medium.**

Receipt OCR, deterministic receipt parsing and voice dictation already exist. Do not rebuild those tools.

What is missing is a persistent review workflow that holds captured items before they become trusted financial records.

Use one review queue for:

- Parsed receipts.
- Imported statement rows.
- Manually captured draft transactions.
- Unmatched investment operations.
- Suspected duplicates.
- Suggested recurring-payment detections.

Each item should have a source, parsed values, confidence, review status, user decision and link to the resulting transaction. Suggested lifecycle: `Captured → Needs Review → Confirmed/Linked → Posted`, with `Rejected` and `Duplicate` outcomes.

This is a workflow around existing OCR and future statement import—not a replacement for transaction entry.

### F. Introduce reusable commitment occurrences behind the current calendar and forecast

**Status: Partial capability exists. Priority: High.**

Recurring subscriptions, scheduled payrolls and debt due dates already exist and are displayed in the calendar and forecast. The gap is that they are stored and projected through different domain models, and recurring subscriptions mainly retain a next-billing-date anchor rather than a first-class history of every scheduled occurrence.

Introduce a reusable occurrence model that can link to the existing source records:

- Subscription billing occurrence.
- Debt installment occurrence.
- Expected payroll occurrence.
- Planned bill or one-time commitment.
- Other scheduled financial events.

Each occurrence should record expected amount/date, status, actual paid/received amount/date, linked transaction, and any variance. Preserve completed occurrences instead of only advancing a single next-date field.

Connect the occurrence model to the existing Financial Calendar and Predictive Engine. Do not create a parallel calendar, another subscription manager or another forecast.

### G. Correct payroll from assumed posting to expected-versus-confirmed income

**Status: Payroll scheduling and automatic posting exist; receipt verification is missing. Priority: Critical.**

`PayrollService.reconcileDuePayrolls` currently creates an Income transaction on the scheduled date when no transaction is already linked. This can record money as received even if the employer pays late, pays a different amount, or has not deposited it.

Separate:

- **Expected payroll:** planned date and expected amount.
- **Confirmed payroll:** actual received date and amount.
- **Matched payroll:** linked bank statement row or user-confirmed transaction.
- **Variance:** short-paid, overpaid or delayed.

A scheduled date should create an expected event, not automatically assert that cash was received. Preserve the current custom-payday period logic, but anchor actual cash-flow and liquidity to confirmed receipt. Allow a manual confirmation path when statement import is not available.

### H. Extend debt plans, not the existing debt tracker

**Status: Existing debt tracking and settlements are substantial; repayment planning is partial. Priority: Medium.**

Keep current receivables/payables, partial settlement and forgiveness behavior. Consider adding the following only where the user has an actual need:

- Scheduled installment plan and due dates.
- Interest, fees and rate type.
- Principal-versus-interest allocation.
- Early-settlement simulation.
- Overdue aging and collection/payment history.
- Reusable counterparty records, rather than relying only on a contact name.

Debt schedules should feed the shared commitment occurrences and existing forecast/calendar. Do not create an independent debt reminder timeline.

### I. Make goal and sinking-fund contributions auditable

**Status: Goal contributions, withdrawals, wallet auto-sync and sinking-goal creation exist. Contribution traceability is partial. Priority: Medium.**

`GoalService` updates a goal's `currentAmount` and creates a transaction for supported contribution/withdrawal paths. The schema stores the goal balance but does not define a dedicated goal-contribution event table.

Improve the existing model by ensuring each contribution or withdrawal has an auditable event linked to its transaction, source account, destination account, amount and date. Reconcile non-wallet-linked goal balances against these events. For sinking goals, add a planned funding cadence and due-date target only if the existing calculator workflow does not already store the required schedule.

Do not add another goal feature, contribution form or savings calculator.

### J. Persist and compare multi-event what-if scenarios

**Status: Interactive what-if and predictive scenario parameters exist; reusable saved scenarios are missing. Priority: Medium.**

`CalculatorsHubTab` already has a live what-if simulation, and `PredictiveEngine` supports discretionary-spend changes, additional monthly investment contributions, one-time shocks, income changes and subscription-cancellation assumptions. It also produces daily and longer-horizon projections.

The worthwhile extension is persistence and composition:

- Save a named scenario.
- Combine multiple dated events, not just one immediate simulated action.
- Include recurring commitment changes, purchases, salary changes, debt repayment changes and investment allocations.
- Compare multiple scenarios against the same baseline.
- Record assumptions and the timestamp/data snapshot used.
- Convert an approved scenario into a plan or commitment without directly changing posted financial history.

Do not create a second simulator or duplicate the existing calculators.

### K. Add a user-configurable financial rules engine

**Status: Fixed system automations and scheduled notification/backup jobs exist; user-defined rules are missing. Priority: Medium.**

Current scheduled processes include notification delivery, backup checks and payroll reconciliation. These are application-defined jobs, not a general rules engine that a user can configure.

If added, keep the first version deliberately constrained:

- **Triggers:** salary confirmed, transaction posted, balance threshold crossed, commitment approaching, budget pace threshold crossed.
- **Conditions:** account, category, amount range, timing and user-defined threshold.
- **Actions:** create a draft, suggest a category, prepare an allocation, or send a notification.
- **Approval policy:** notify only, create draft, or request approval.
- **Audit:** rule version, trigger event, proposed result, approval and execution outcome.
- **Safety:** idempotency and rate limits to prevent repeated actions.

Do not permit unrestricted autonomous movement of money or investment execution.

### L. Expand the existing net-worth calculation to assets and liabilities outside wallets and market portfolios

**Status: Estimated unified net worth already exists; broader asset coverage is missing. Priority: Medium/optional.**

The current unified net-worth calculation includes non-investment liquidity, synced investment value, pending receivables and pending payables. Do not add another net-worth dashboard.

If broader wealth tracking is desired, extend the existing calculation to support manually valued assets and liabilities such as:

- Property and vehicles.
- Physical precious metals or other valuables.
- Private/manual investments.
- Personal loans and other financing obligations not represented by current debts.
- Credit-card balances and overdrafts.

Each valuation should carry currency, valuation date, source, confidence and whether it is manually estimated or externally verified. Clearly separate liquid funds from illiquid assets. Stale estimates must not be presented as live account balances.

### M. Add safe offline transaction capture to the existing Android app

**Status: Capacitor Android shell exists; offline financial capture/synchronization is not present in the inspected implementation. Priority: Medium.**

The Capacitor bridge routes API calls to the cloud backend. The service worker inspected handles push notifications and notification clicks; it does not implement application data caching or a transaction outbox.

Add offline functionality only for safe, bounded workflows:

- Capture a draft transaction locally when offline.
- Store an outbox item with a stable client-generated ID.
- Show pending-sync state.
- Sync when connectivity returns.
- Handle duplicate retries and conflicts explicitly.
- Never silently overwrite a server-posted financial record.
- Protect local financial data and clear it on logout according to the chosen security policy.

Biometric app lock and encrypted local storage can be considered as part of the same mobile-security work, but do not present the current Capacitor wrapper as already offline-first.

### N. Repair and verify full backup/restore coverage

**Status: Backup/export/import and scheduled Google Drive uploads exist, but the inspected implementation is materially narrower than the documentation implies. Priority: Critical.**

This is the most important audit finding beyond payroll posting.

`SettingsService` currently defines the backup/import allowlist and restore order as only:

- `users`
- `debts`
- `transactions`
- `splits`
- `category_budgets`

The export code also writes inserts for this limited set. It does not cover the full current application schema, including wallets, subscriptions, goals, financial contexts, investment positions/orders, market-data and portfolio snapshots, notification preferences/deliveries and other domain records.

Consequently, the current `SettingsService` SQL export/import should not be described as a complete PostgreSQL backup.

Update backup/restore to cover the full supported schema with:

- Explicit schema/migration compatibility metadata.
- Dependency-aware export and restore order.
- Referential-integrity validation.
- Integrity checksum and backup manifest.
- Encryption before upload/storage where application-level confidentiality is required.
- A restore preview and non-destructive validation mode.
- Scheduled restore drills against an isolated database.
- Success/failure telemetry and retention policy.
- Tests proving that all supported tables and relationships survive a full round trip.

Do not add another backup scheduler; fix the current backup system and its documentation.

### O. Add forecast quality, data freshness and model calibration to the existing intelligence

**Status: Forecasting and financial facts already exist; confidence and calibration are the proposed improvement. Priority: Medium.**

Do not add another forecast or health score. Extend the existing engines so each important projection can explain:

- Which transactions and commitments were included.
- Which values are confirmed versus estimated.
- When account, market and FX data were last updated.
- Which assumptions drive the expected/best/worst result.
- How past forecasts compared with actual results.
- Whether insufficient history makes the projection less reliable.

Track forecast-versus-actual variance over time and use it to improve assumptions. Avoid implying statistical confidence unless the engine calculates and validates it.

### P. Add pre-execution simulation to SPEX actions

**Status: SPEX context injection and explicit action approval exist; action impact simulation is the proposed extension. Priority: Medium.**

Keep the current approval gateway. Before showing an approval card for a financial mutation, run the proposed action through the existing financial-state and predictive engines.

Show the expected effect on:

- Source and destination account balances.
- Safe-to-Spend and reserves.
- Upcoming commitments.
- Payday runway.
- Budget and goal allocation.
- Investment exposure, where relevant.

Show warnings when the context is stale or an action would violate a financial constraint. The final mutation must still pass server-side validation and explicit user approval. The preview must not reserve or move money.

## 3. Recommended implementation order

This order minimizes data risk and avoids building dependent capabilities on top of incomplete financial records.

### Priority 0 — Data integrity and recovery

1. Expand and test full-schema backup/restore coverage.
2. Make related transaction, debt, split, goal and investment writes atomic.
3. Add idempotency to financial mutations and scheduled posting.
4. Add a balanced accounting-posting layer with reversals and audit history.
5. Correct payroll so expected income is not automatically treated as received cash.

### Priority 1 — Account and transaction foundations

1. Extend accounts for credit/liability semantics.
2. Add currency and historical FX support to the core transaction/account model.
3. Build statement import and transaction-level matching on top of existing manual reconciliation.
4. Add the persistent review inbox for imported and captured financial items.

### Priority 2 — Shared financial event model

1. Add commitment occurrences behind existing subscriptions, debts, payroll and calendar.
2. Connect actual occurrence settlement to existing transactions.
3. Extend debt repayment schedules and goal/sinking-fund contribution history.
4. Persist multi-event what-if scenarios and compare them against existing forecasts.

### Priority 3 — Intelligence, automation and coverage

1. Add forecast-versus-actual calibration and data freshness indicators.
2. Add SPEX pre-execution impact simulation.
3. Add constrained user-configurable rules.
4. Expand net-worth coverage to selected external assets/liabilities.
5. Add offline transaction capture and safe synchronization to Android.

## 4. Migration and design constraints

- Do not delete or replace the current wallet, transaction, subscription, debt, budget, goal, calendar, forecast, investment or SPEX modules as a first step.
- Migrate wallets into the richer account model while preserving IDs and transaction references.
- Keep the current transaction record as the business-event layer while the new accounting postings are introduced.
- Backfill opening balances and journal entries from the existing transaction history, and explicitly flag records that cannot be reconstructed with confidence.
- Run old and new balance calculations side by side during migration.
- Validate that each account balance, financial-period opening/closing balance, investment cash movement and net-worth calculation reconciles before switching any read path.
- Never fabricate historical currency, FX, credit-card or valuation details that were not recorded. Mark reconstructed values as estimated.
- Update `docs/` after implementation so documentation reflects actual endpoint, schema and UI behavior.

## 5. Source files reviewed

- [Feature guide](features.md)
- [REST API reference](api.md)
- [Database architecture](database.md)
- [AI/SPEX architecture](ai.md)
- [Software requirements](srs.md)
- [Stock and investment architecture](stocks-and-investments.md)
- [Database schema](../src/db/schema.ts)
- [Financial state engine](../src/lib/financialEngine.ts)
- [Predictive engine](../src/lib/predictiveEngine.ts)
- [Historical cash-flow engine](../src/lib/cashFlowEngine.ts)
- [Financial facts and insight generation](../src/lib/financialFacts.ts)
- [Wallet manager and manual reconciliation](../src/components/dashboard/WalletsManager.tsx)
- [Financial calendar](../src/components/dashboard/FinancialCalendarTab.tsx)
- [Budgeting](../src/components/dashboard/BudgetsTab.tsx)
- [Calculators and what-if simulator](../src/components/dashboard/CalculatorsHubTab.tsx)
- [Goals interface](../src/components/dashboard/GoalsTab.tsx)
- [Payroll service](../server/services/PayrollService.ts)
- [Transaction service](../server/services/TransactionService.ts)
- [Goal service](../server/services/GoalService.ts)
- [Backup and restore service](../server/services/SettingsService.ts)
- [Notification scheduler](../server/services/NotificationScheduler.ts)
- [Client notification logic](../src/hooks/useNotifications.ts)
- [SPEX action gateway](../server/services/AiActionGateway.ts)
- [AI financial context](../src/lib/aiContext.ts)
- [Capacitor bridge](../src/lib/capacitorBridge.ts)
- [Service worker](../public/sw.js)

## Conclusion

The main branch already contains much of the earlier proposal under different names and across several existing modules. The correct direction is not to add another financial health engine, forecast, timeline, budgeting system, debt tracker, goal manager, notification centre, AI assistant or net-worth dashboard.

The highest-value work is to strengthen the foundations those features depend on: balanced accounting postings, richer account semantics, consistent multi-currency handling, statement matching, verified payroll receipt, shared commitment occurrences, atomic financial mutations and complete recoverable backups. The remaining proposals are targeted extensions to existing systems, not parallel replacements.
