# Software Requirements Specification (SRS)

## 1. Introduction

### 1.1 Purpose
The purpose of this document is to specify the requirements for the Personal Finance Dashboard. The application is designed to help users track their liquidity, stick to a daily budget based on their payday, and seamlessly manage split expenses.

### 1.2 Scope
The system is a web-based, full-stack application utilizing React (Vite) on the frontend and Express (Node.js) on the backend, with a PostgreSQL database (via Drizzle ORM).

## 2. Overall Description

### 2.1 User Characteristics
The target user is an individual who wants strict control over their daily discretionary spending, actively manages cash flow between bank accounts and physical cash, and frequently fronts money for friends or shares expenses.

### 2.2 Operating Environment
- Frontend: Modern web browsers (Chrome, Safari, Firefox).
- Backend: Node.js environment.
- Database: PostgreSQL (Cloud SQL).

## 3. System Features

### 3.1 Authentication
- **Requirement**: The system shall allow access via a JWT-based login mechanism.
- **Requirement**: Unauthenticated users shall be redirected to the login view.

### 3.2 Dashboard & KPIs
- **Requirement**: The system shall display "Total Liquidity", combining Bank and Cash balances.
- **Requirement**: The system shall calculate a "Daily Allowance" based on Total Liquidity divided by the days remaining until the user's defined Payday, minus the Emergency Buffer.
- **Requirement**: The system shall track "Adjusted True Spend", subtracting reimbursements and debt repayments from gross monthly expenses.

### 3.3 Transaction Logging
- **Requirement**: The system shall allow users to create transactions (Expense, Income, Transfer).
- **Requirement**: The system shall allow categorizing transactions.
- **Requirement**: The system shall update wallet balances (Bank or Cash) appropriately.
- **Requirement**: The system shall cascade deletes on transactions to correctly update or remove associated split records and adjust remaining debt balances.

### 3.4 Debt & Split Management
- **Requirement**: The system shall allow users to create a linked receivable debt when logging a split expense.
- **Requirement**: The system shall allow users to create standalone debts (Payables or Receivables) independent of a transaction.
- **Requirement**: The system shall maintain a ledger of Pending and Cleared debts, along with their detailed settlement history.
- **Requirement**: The system shall allow users to settle debts, marking them as cleared when the remaining balance reaches zero, and automatically creating a matching transaction to update cash flow.
- **Requirement**: The system shall allow direct editing and deletion (forgiveness) of debts.

### 3.5 Analytics & Historical Reporting
- **Requirement**: The system shall aggregate expenses by category and display them visually.
- **Requirement**: The system shall allow filtering analytics by historical months.
- **Requirement**: The system shall compare the selected month's Income and Expenses against the all-time historical averages, displaying the variance percentage.
- **Requirement**: The system shall provide a Financial Calendar to visualize transaction history and upcoming debt/payday events on a daily grid.
- **Requirement**: The system shall generate a Monthly Digest summarizing the preceding month's total savings and top expense categories.

### 3.6 Settings
- **Requirement**: The system shall allow users to configure their specific Payday (1-31).
- **Requirement**: The system shall allow users to define an Emergency Liquidity Buffer that is excluded from the daily allowance calculation.

### 3.7 Category Budgets
- **Requirement**: The system shall allow users to define monthly limits for specific spending categories.
- **Requirement**: The system shall calculate an ideal spending pace based on current category budgets and the day of the cycle.
- **Requirement**: The system shall allow users to automatically copy previous month's budgets into the current month.

### 3.8 AI Assistant & Automation
- **Requirement**: The system shall provide an AI chat interface that contextually understands the user's financial state (KPIs, debts, transactions).
- **Requirement**: The system shall allow the AI to propose structured data modifications (logging transactions, creating debts, updating settings).
- **Requirement**: The system MUST NEVER execute AI-proposed write actions without explicit, manual approval from the user via the frontend UI.
- **Requirement**: The system shall seamlessly reload dashboard data upon successful execution of an approved AI action.

### 3.9 Purchase Simulation
- **Requirement**: The system shall provide a "What-If" simulator allowing users to visualize the impact of a hypothetical purchase on their Total Liquidity and Daily Allowance.

## 4. Non-Functional Requirements

### 4.1 Performance
- The application shall provide responsive UI updates via optimistic or rapid state fetching.

### 4.2 Security
- API endpoints shall be secured via JWT authentication.
- Secrets and database credentials must be managed via environment variables.

### 4.3 Maintainability
- The backend shall use Drizzle ORM for type-safe database queries and migrations.
