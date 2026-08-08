# Application Features Documentation

## Core Purpose
The application is a personal finance tracker focused on liquidity, daily budgeting, and splitting expenses with friends.

## Key Features

### 1. KPI Overview & Daily Budgeting
- **Total Liquidity**: A unified view of available money across Bank and Cash.
- **Adjusted True Spend**: Monthly expenses minus any reimbursements or debt repayments.
- **Daily Allowance**: Dynamically calculated safe-to-spend amount per day. It divides the total liquidity by the number of days remaining until the next payday.
- **Customizable Payday & Emergency Buffer**: Users can specify the exact day of the month they receive their salary and a safe liquidity buffer, ensuring that the daily allowance and monthly pacing calculations are always accurate.

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
- **Spending by Category**: A pie chart breaking down where money was spent.
- **Category Drilldown**: Select a pie slice or one of the top three categories to view its total, transaction count, average purchase, and every matching transaction for the selected period.
- **Income vs Expenses**: A bar chart comparing total inflows and outflows.
- **Daily Spending Trend**: A time-series chart showing spending spikes over the selected period.
- **Historical Averages Comparison**: When viewing a specific month, the application calculates the all-time monthly average for Income and Expenses, and displays the percentage variance (+/-) for the selected month against the global average.
