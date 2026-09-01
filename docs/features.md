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
- **Daily Insights & Push Notifications**: Users can opt-in to daily browser notifications summarizing their budget pacing, overspent categories, or remaining daily allowance. These are scheduled client-side using Web Notifications and Service Workers.
- **Full Data Sovereignty**: Users can export their entire database profile to raw SQL via the **Export to SQL** button, and similarly import raw `.sql` backups to instantly restore their profile across instances.

## The AI Assistant (TrueSpend Copilot)
An integrated Gemini-powered AI chat interface. The assistant possesses "Agentic" capabilities, utilizing server-side function calling (the `AiActionGateway`):
- **Conversational Queries**: "How much did I spend on dining out this month?"
- **Data Insertion**: "I just bought a coffee for 40 MAD from Starbucks in Cash." The AI parses the request, prepares the transaction payload, and requests the user's approval before committing it to the database.
- **Budget Advice**: "Based on my current spending pace, do I need to cut back on wants this week?"
- **Context Injection**: The application automatically injects the user's recent transactions and current budget health into the AI prompt to provide perfectly contextual answers without needing raw database reads.
