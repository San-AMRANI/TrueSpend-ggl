# Application Features Documentation

## Core Purpose
The application is a personal finance tracker focused on liquidity, daily budgeting, and splitting expenses with friends.

## Key Features

### 1. KPI Overview & Daily Budgeting
- **Total Liquidity**: A unified view of available money across Bank and Cash.
- **Adjusted True Spend**: Monthly expenses minus any reimbursements or debt repayments.
- **Daily Allowance**: Dynamically calculated safe-to-spend amount per day. It divides the total liquidity by the number of days remaining until the next payday.
- **Customizable Payday & Emergency Buffer**: Users can specify the exact day of the month they receive their salary and a safe liquidity buffer, ensuring that the daily allowance and monthly pacing calculations are always accurate.
- **Daily Allowance Tracking**: Each day’s allowance is fixed from that day’s opening balance. Expense outflows reduce the amount left for today; an 80% warning and a critical over-budget alert help prevent overspending. The next day recalculates from the new balance.

### 2. Transaction Management
- **Income, Expense, and Transfers**: Users can log multiple types of transactions.
- **Wallet Tracking**: Differentiates between Bank/Card money and physical Cash. Transfers allow moving money between these two wallets.
- **Consistent Categories**: Expenses and incomes use one shared category list across entry, analytics, and reports. Existing spelling and naming variants are consolidated in reports without changing historical records.
- **Transaction Dates**: Transactions can be backdated, so monthly analytics and spending trends reflect when the money was actually spent.
- **Cascade Deletion**: When deleting a transaction, any associated split records are removed, and linked debts are automatically updated (reduced or deleted).

### 3. Expense Splitting & Debt Tracking
- **Integrated Splitting**: When logging an expense, users can mark it as "Reimbursable (Fronting Money)", specifying how much is owed and by whom.
- **Standalone Debts**: Users can manually create standalone debts (Receivables or Payables) without an accompanying expense transaction.
- **Debt Ledger**: A dedicated tab to track "Pending" and "Cleared" debts.
- **Settlement & History**: Users can mark debts as settled (logging partial or full repayments). The application tracks and displays a detailed settlement history for each debt. Settling a debt automatically generates the corresponding cash flow transaction.
- **Debt Management**: Users can edit debt amounts, names, and types, or forgive/delete them directly.

### 4. Historical Analytics & Reporting
- **Period Filtering**: Users can view analytics for "All Time" or filter by specific past months.
- **Financial Calendar**: A daily view showing actual income/expenses overlaid with expected payday and debt due dates, providing a unified timeline of financial activity.
- **Monthly Digest**: A retrospective summary of the previous month's performance, highlighting total money saved and breaking down the top 5 expense categories.
- **Spending by Category**: A pie chart breaking down where money was spent.
- **Category Drilldown**: Select a pie slice or one of the top three categories to view its total, transaction count, average purchase, and every matching transaction for the selected period.
- **Income vs Expenses**: A bar chart comparing total inflows and outflows.
- **Daily Spending Trend**: A time-series chart showing spending spikes over the selected period.
- **Historical Averages Comparison**: When viewing a specific month, the application calculates the all-time monthly average for Income and Expenses, and displays the percentage variance (+/-) for the selected month against the global average.

### 5. Category Budgets & Spending Pace
- **Monthly Category Limits**: Users can set specific target amounts for various spending categories each month.
- **Spending Pace**: The dashboard calculates the ideal spending pace based on the current day in the monthly cycle and compares it to actual spending, showing if the user is ahead or behind their budget pace.
- **Rollover Budgets**: A single-click feature allows users to copy all their established budgets from the previous month into the current month.

### 6. AI Assistant
- **Context-Aware Chat**: An integrated AI assistant (powered by Gemini) that knows the user's current liquidity, recent transactions, pending debts, and category budgets.
- **Action Proposals**: Users can ask the AI to perform tasks (e.g., "I just paid Jane 50 MAD for dinner"). The AI parses this and proposes structured actions (creating transactions, debts, or updating settings).
- **Explicit Approval Flow**: Proposed actions are rendered as distinct UI blocks. They are never executed without the user explicitly clicking "Approve", ensuring complete safety and control over financial data.
- **Real-Time Data Sync**: Approving an AI action instantly executes it on the backend and seamlessly reloads the dashboard data without a page refresh.

### 7. What-If Purchase Simulation
- **Financial Forecasting**: A dedicated tool allows users to enter a hypothetical purchase amount to instantly see its impact on their Total Liquidity and Daily Allowance.
- **Safe Spending Check**: Helps users make informed decisions about discretionary purchases by showing exactly how much their daily budget will drop for the remainder of the pay cycle before they actually spend the money.

### 8. Testing & Demo Data
- **Demo Data Seeding**: A utility available in the Settings tab that securely resets the current user's profile and populates the database with a robust set of realistic, randomized sample data (including past/future transactions, active debts, category budgets, and intelligent dates).
