# TrueSpend Features Guide

TrueSpend is a comprehensive personal finance tracking and budgeting application tailored around unique pay periods and AI-assisted financial management.

## Core Features

### Dashboard & Analytics
- **Overview**: Displays a real-time snapshot of the current financial month, including Income vs. Expense KPI cards, daily allowance calculations (remaining vs. recommended burn rate), and recent transactions.
- **Transactions Management**: Add, edit, and delete transactions. Supports categories, multiple transaction types (Income, Expense, Transfer, Debt Repayment), wallets (Bank, Cash), and rich list views with time-based grouping.
- **Analytics & Digest**: Visual breakdowns of spending via pie charts (category vs. category) and bar graphs. The **Digest Tab** generates summaries and comparisons to previous financial months.
- **Financial Calendar**: A visual view plotting payday boundaries and large expenses/due dates over a traditional calendar view.
- **What If? Simulator**: A speculative purchase simulator allowing users to input hypothetical purchases to see precisely how it impacts their remaining daily allowance and overall budget health before actually spending the money.

### Advanced Budgeting Strategies
Budgets are tracked on a rolling basis tied to the user's custom payday. The application offers three visual budget models:
1. **Category View**: Micro-manage every single category manually.
2. **Envelope View**: Classic cash-envelope style tracking emphasizing remaining balance over percentages.
3. **50/30/20 Rule View**: A dynamic macro-budgeting view. Categorizes spending into Needs, Wants, and Savings & Debt. Users can fully customize the split percentage (e.g., 60/20/20) and use the **"Calculate from Budgets"** engine to automatically tally their micro-budgets into exact real-time percentages.

**Budget Utilities**:
- **Batch Editing**: Edit all categories simultaneously and save them in one API call.
- **Copy Previous Month**: Carry over the exact category allocation from the last financial month.
- **Clear Month**: Wipe the slate clean for the current month.

### Debt Tracking (Receivables & Payables)
- Keep track of money lent (Receivables) and money owed (Payables).
- Settle debts completely or log partial payments which automatically register as 'Debt Repayment' transactions.
- Track due dates and view cleared vs. pending obligations.

### Settings & User Preferences
- **Custom Payday Tracking**: Financial months reset on a custom date (e.g., the 25th of the month) rather than the 1st of the calendar month. This drives all KPI and budget calculations.
- **Salary & Emergency Buffer**: Set fixed incomes and emergency thresholds to drive the What-If and KPI engines.
- **Daily Insights & Web Push Notifications**: Users can opt-in to daily notifications summarizing their budget pacing, overspent categories, or remaining daily allowance via Web Push (VAPID) and background service workers.
- **Google Drive Automated Cloud Backups**:
  - **Direct Drive Integration**: Authenticate with Google to backup your entire PostgreSQL database directly to your personal Google Drive account.
  - **Configurable Backup Intervals**: Schedule automated backups at custom cadences: **Daily** (every 24h), **Every 3 Days** (every 72h), or **Weekly** (every 7 days).
  - **Server-Side & Hybrid Cron Execution**: Automated recurring background jobs run every 15 minutes checking backup eligibility and uploading SQL dumps securely, backed by proactive client-side sync checks.
  - **Instant On-Demand Backups**: Trigger immediate cloud backups anytime via the "Backup to Drive Now" button.
- **Full Data Sovereignty**: Users can export their entire database profile to raw SQL via the **Export to SQL** button, and similarly import raw `.sql` backups to instantly restore their profile across instances. For complete database schema, tables, and restore mechanics, refer to **[TrueSpend Database Schema & Architecture](database.md)**.

### Financial Goals & Milestone Tracking
- Create custom financial targets with deadlines, priority tags, and target amounts (e.g., emergency fund, car down payment, vacation).
- Track real-time progress percentages, remaining balances, required monthly contributions, and required weekly contributions.
- Make direct progress contributions with automatic transaction logging and KPI synchronization.

### Personal Intelligence & Deep Insights
- **Financial Health Score**: Unified 0–100 score dynamically calculated across emergency buffer health, debt-to-income ratio, daily burn pacing, and goal progression.
- **Financial Runway & Forecasting**: Real-time runway analysis (e.g., "18 days of financial runway") paired with best-case, expected, and worst-case end-of-period balance predictions.
- **Merchant & Category Intelligence**: Breakdown of top merchants, frequency of visits, average spend per transaction, and month-over-month trend changes.
- **Spending Anomaly Detection**: Automated flagging of irregular spikes, off-pattern purchases, or unusually high ticket items with severity indicators.

### Account Reconciliation & Reports
- **Reconciliation Module**: Verify bank and cash balances against statement totals, highlight unaccounted discrepancies, and log balance adjustments.
- **Structured Financial Reports**: Generate monthly financial statements, budget adherence reports, and category expense breakdowns ready for export.

## The AI Assistant (TrueSpend Copilot / Spex)
An integrated AI chat interface. The assistant possesses "Agentic" capabilities, utilizing server-side function calling (the `AiActionGateway`). For an exhaustive technical breakdown of the AI architecture, prompt engineering, context serialization, and model failover, see **[TrueSpend AI Feature Architecture](ai.md)**.
- **Conversational Queries**: "How much did I spend on dining out this month?"
- **Data Insertion**: "I just bought a coffee for 40 MAD from Starbucks in Cash." The AI parses the request, prepares the transaction payload, and requests the user's approval before committing it to the database.
- **Budget Advice**: "Based on my current spending pace, do I need to cut back on wants this week?"
- **Context Injection**: The application automatically injects the user's recent transactions and current budget health into the AI prompt to provide perfectly contextual answers without needing raw database reads.
