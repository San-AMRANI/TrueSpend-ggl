# API Documentation

## Authentication
Most API endpoints require authentication using a JWT token. The token should be included in the `Authorization` header as a Bearer token:
`Authorization: Bearer <token>`

## Endpoints

### Auth & System
- **GET `/api/health`**
  - Returns: `{ "status": "ok" }`
- **POST `/api/login`**
  - Body: `{ "username": "admin", "password": "password" }`
  - Returns: `{ "token": "<jwt>", "user": { ... } }`
- **POST `/api/seed`**
  - Description: Clears all current user data and populates the database with comprehensive sample seed data (transactions, debts, settings, and budgets).
  - Returns: `{ "message": "Seed data inserted" }`

### KPIs & Analytics
- **GET `/api/kpis`**
  - Description: Returns key performance indicators for the current monthly cycle (based on the user's defined payday).
  - Returns:
    ```json
    {
      "bankBalance": 1000,
      "cashOnHand": 200,
      "totalLiquidity": 1200,
      "monthlyExpenses": 500,
      "monthlyIncome": 2000,
      "adjustedTrueSpend": 450,
      "daysUntilPayday": 12,
      "dailyAllowance": 100,
      "dailySpent": 30,
      "dailyRemaining": 70,
      "dailyUsagePercent": 30,
      "dailyStatus": "on_track",
      "payday": 25,
      "emergencyBuffer": 0
    }
    ```

### Transactions
- **GET `/api/transactions`**
  - Description: Retrieves all transactions sorted by date descending.
- **POST `/api/transactions`**
  - Description: Logs a new transaction. If `reimbursable_amount` is provided, it automatically creates a corresponding debt record.
  - Body:
    ```json
    {
      "amount": 150.50,
      "type": "Expense", // "Expense", "Income", "Transfer"
      "source_wallet": "Bank", // "Bank", "Cash"
      "category": "Groceries",
      "notes": "Weekly shop",
      "transaction_date": "2026-08-08", // Optional, defaults to today
      "reimbursable_amount": 50.00, // Optional
      "linked_contact_name": "John Doe" // Optional
    }
    ```
- **DELETE `/api/transactions/:id`**
  - Description: Deletes a specific transaction. It also deletes any associated split records and cascades updates to the linked debt (reducing the debt's original amount, or deleting the debt if its original amount drops to zero).

### Debts & Splits
- **GET `/api/debts`**
  - Description: Retrieves all debts (receivables and payables), including their settlement history.
- **POST `/api/debts`**
  - Description: Acts as a dual-purpose route for either creating a new debt or settling an existing debt. When settling an existing debt, a new transaction (Income for Receivables, Expense for Payables) and split record are automatically created to maintain cash flow tracking.
  - Body (Create):
    ```json
    {
      "amount": 100.00,
      "contact": "Jane Doe",
      "type": "Payable"
    }
    ```
  - Body (Settle):
    ```json
    {
      "debt_id": "uuid",
      "amount": 50.00
    }
    ```
- **PUT `/api/debts/:id`**
  - Description: Updates an existing debt's details and recalculates the remaining balance based on the new original amount.
  - Body:
    ```json
    {
      "amount": 120.00,
      "contact": "Jane Doe",
      "type": "Payable"
    }
    ```
- **DELETE `/api/debts/:id`**
  - Description: Deletes a debt record directly, allowing for removal or forgiveness of a debt.

### Settings
- **GET `/api/settings`**
  - Description: Retrieves user settings (e.g., payday, emergencyBuffer).
  - Returns: `{ "payday": 25, "emergencyBuffer": 0 }`
- **POST `/api/settings`**
  - Description: Updates the user's settings.
  - Body: `{ "payday": 25, "emergencyBuffer": 500 }`
- **GET `/api/settings/export-sql`**
  - Description: Downloads a complete PostgreSQL backup of the TrueSpend database, including every user, transaction, debt, split, category value, enum, and table definition. Restore it into a new or empty database.
- **POST `/api/settings/import-sql`**
  - Description: Restores a SQL backup previously exported by TrueSpend. The backup is validated and all current TrueSpend records are replaced atomically; if validation or import fails, the existing records are preserved.
  - Body: `{ "sql": "-- TrueSpend Complete PostgreSQL Database Backup..." }`

### Category Budgets
- **GET `/api/category-budgets`**
  - Description: Retrieves all category budgets for the current user.
- **PUT `/api/category-budgets`**
  - Description: Upserts (creates or updates) a budget for a specific category, year, and month.
  - Body:
    ```json
    {
      "category": "Groceries",
      "year": 2026,
      "month": 8,
      "amount": 500
    }
    ```
- **POST `/api/category-budgets/copy-previous`**
  - Description: Copies all category budgets from the previous month to the specified target year and month.
  - Body: `{ "year": 2026, "month": 8 }`
  - Returns: `{ "success": true, "copied": 5 }`

### AI Chat Assistant
- **POST `/api/chat`**
  - Description: Sends a chat message to the Gemini AI assistant. It provides the AI with the user's current financial context (KPIs, transactions, debts, budgets) to generate personalized advice and propose actions.
  - Body:
    ```json
    {
      "messages": [
        { "role": "user", "content": "I just spent 50 MAD on coffee, please log it." }
      ]
    }
    ```
  - Returns: `{ "reply": "...", "actions": [...] }`
- **POST `/api/chat/actions`**
  - Description: Executes an array of actions proposed by the AI Assistant after the user explicitly approves them.
  - Body:
    ```json
    {
      "actions": [
        {
          "type": "create_transaction",
          "summary": "Log 50 MAD expense for coffee",
          "parameters": { "amount": 50, "type": "Expense", "source_wallet": "Cash", "category": "Food & Dining" }
        }
      ]
    }
    ```
  - Returns: `{ "success": true, "results": [...] }`
