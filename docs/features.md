# Application Features Documentation

## Core Purpose
The application is a personal finance tracker focused on liquidity, daily budgeting, and splitting expenses with friends.

## Key Features

### 1. KPI Overview & Daily Budgeting
- **Total Liquidity**: A unified view of available money across Bank and Cash.
- **Adjusted True Spend**: Monthly expenses minus any reimbursements or debt repayments.
- **Daily Allowance**: Dynamically calculated safe-to-spend amount per day. It divides the total liquidity by the number of days remaining until the next payday.
- **Customizable Payday**: Users can specify the exact day of the month they receive their salary, ensuring that the daily allowance and monthly pacing calculations are always accurate.

### 2. Transaction Management
- **Income, Expense, and Transfers**: Users can log multiple types of transactions.
- **Wallet Tracking**: Differentiates between Bank/Card money and physical Cash. Transfers allow moving money between these two wallets.
- **Categorization**: Expenses and incomes can be categorized (e.g., Food & Dining, Transportation, Salary).

### 3. Expense Splitting & Debt Tracking
- **Integrated Splitting**: When logging an expense, users can mark it as "Reimbursable (Fronting Money)", specifying how much is owed and by whom.
- **Debt Ledger**: A dedicated tab to track "Pending" and "Cleared" debts, both payables (money you owe) and receivables (money owed to you).
- **Settlement**: Users can mark debts as settled (logging partial or full repayments).

### 4. Historical Analytics & Reporting
- **Period Filtering**: Users can view analytics for "All Time" or filter by specific past months.
- **Spending by Category**: A pie chart breaking down where money was spent.
- **Income vs Expenses**: A bar chart comparing total inflows and outflows.
- **Daily Spending Trend**: A time-series chart showing spending spikes over the selected period.
- **Historical Averages Comparison**: When viewing a specific month, the application calculates the all-time monthly average for Income and Expenses, and displays the percentage variance (+/-) for the selected month against the global average.
