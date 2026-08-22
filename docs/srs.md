# Software Requirements Specification (SRS) - TrueSpend

## 1. Introduction
**TrueSpend** is a modern, full-stack personal finance application designed for users who want granular control over their cash flow, debts, and budgets, combined with advanced AI insights. The application is tailored specifically for users operating on custom pay cycles (e.g., getting paid on the 25th of the month).

## 2. Architecture
The application follows a standard React SPA + Express API architecture.

### Client-Side (Frontend)
- **Framework**: React 18, Vite.
- **Styling**: Tailwind CSS, Lucide Icons, Shadcn UI components (Custom Radix UI).
- **State Management**: React Context (`AuthContext`, `ThemeContext`), local component state.
- **Charts**: Recharts for Analytics.

### Server-Side (Backend)
- **Runtime**: Node.js + Express.
- **Database**: PostgreSQL (Cloud SQL/Neon).
- **ORM**: Drizzle ORM.
- **AI Integration**: Google Gen AI SDK (`@google/genai`) configured for Gemini Pro models.

## 3. Data Model (Drizzle ORM Schema)
The PostgreSQL schema consists of several core tables linked by the user's UUID:

- **Users**: `id` (UUID), `uid` (Firebase UID), `email`, `payday`, `salary`, `emergencyBuffer`.
- **Transactions**: `id`, `userId`, `amount`, `type` (Enum: Income, Expense, Transfer, Debt Repayment), `sourceWallet` (Enum: Bank, Cash), `category`, `notes`, `createdAt`.
- **Debts**: `id`, `userId`, `contactName`, `type` (Enum: Receivable, Payable), `originalAmount`, `remainingBalance`, `status` (Enum: Pending, Cleared), `dueDate`.
- **CategoryBudgets**: `id`, `userId`, `category`, `year`, `month`, `amount`. (Unique constraint on userId + category + year + month).
- **Splits**: Links transactions that are reimbursable or tied specifically to a debt settlement (columns: `transactionId`, `reimbursableAmount`, `linkedContactId`).

## 4. Key Systems
### Authentication
- Relies on **Firebase Authentication** on the client.
- The client receives a Firebase Bearer token and sends it with every API request.
- The Express middleware (`middleware/auth.ts`) validates the token using `firebase-admin` and automatically retrieves or registers the PostgreSQL user record.

### Financial Math Engine
Located in `lib/finance.ts` and `lib/financialMonth.ts`. 
- Calculations rely on calculating the exact delta between `(current date)` and `(last payday)`. 
- The `getFinancialMonthBounds` function drives the logic for KPIs, determining what constitutes the "Current Month".

### AI Action Gateway
The application features a robust two-way AI system:
1. **Prompt Injection**: The UI sends the user's KPI summary and last 20 transactions invisibly alongside their chat message.
2. **Function Calling (Tools)**: The AI is equipped with tools like `create_transaction` or `create_debt`.
3. **Approval Flow**: Instead of the AI mutating the database directly, it returns an array of `pendingActions`. The UI renders these as actionable buttons. If the user clicks "Approve", the UI hits `/api/chat/actions` to commit the data.

## 5. Deployment Constraints
- Port 3000 is exposed via Express routing.
- Vite development server middleware is bound directly into Express in development mode.
- In production, Vite builds to `/dist` and Express statically serves the UI alongside the `/api` routes.
