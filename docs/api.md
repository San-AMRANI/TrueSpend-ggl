# API Reference

This document outlines the REST API exposed by the TrueSpend Express server. All requests require authentication via Firebase Auth tokens, which should be provided in the `Authorization: Bearer <token>` header.

## Authentication

### `POST /api/auth/login`
- **Description**: Authenticate user and create their database record if they do not exist yet.
- **Body**: `{ "email": "user@example.com" }`

## Transactions

### `GET /api/transactions`
- **Description**: Retrieves all transactions for the authenticated user.
- **Query Params**: None (returns all transactions, client handles local filtering/sorting).

### `POST /api/transactions`
- **Description**: Creates a new transaction.
- **Body**: 
  ```json
  {
    "amount": 100.50,
    "type": "Expense",
    "sourceWallet": "Bank",
    "category": "🛒 Groceries",
    "notes": "Weekly shop",
    "createdAt": "2026-08-22T10:00:00Z"
  }
  ```

### `PUT /api/transactions/:id`
- **Description**: Updates an existing transaction by ID.
- **Body**: Partial updates to the transaction object.

### `DELETE /api/transactions/:id`
- **Description**: Deletes a transaction by ID.

## Budgets

### `GET /api/category-budgets`
- **Description**: Gets all category budgets for the user across all months.

### `PUT /api/category-budgets`
- **Description**: Upsert a single budget for a specific category, year, and month.
- **Body**: `{ "category": "🛒 Groceries", "year": 2026, "month": 8, "amount": 1200 }`

### `PUT /api/category-budgets/batch`
- **Description**: Batch upsert multiple category budgets simultaneously.
- **Body**: `{ "budgets": [ { "category": "🛒 Groceries", "year": 2026, "month": 8, "amount": 1200 }, ... ] }`

### `POST /api/category-budgets/copy-previous`
- **Description**: Copies budget allocations from the previous financial month to the target month.
- **Body**: `{ "targetYear": 2026, "targetMonth": 8 }`
- **Returns**: Number of categories copied.

### `DELETE /api/category-budgets/month/:year/:month`
- **Description**: Clears all budgets for a specified year and month.
- **Returns**: Number of categories deleted.

### `DELETE /api/category-budgets/:id`
- **Description**: Deletes a specific category budget entry by its UUID.

## Debts

### `GET /api/debts`
- **Description**: Retrieves all debt records (payables and receivables) for the user.

### `POST /api/debts`
- **Description**: Processes a new debt (creation or repayment).
- **Body**: 
  ```json
  {
    "contactName": "John Doe",
    "amount": 500,
    "type": "Receivable",
    "dueDate": "2026-09-01T00:00:00Z"
  }
  ```

### `PUT /api/debts/:id`
- **Description**: Updates an existing debt record.

### `DELETE /api/debts/:id`
- **Description**: Removes a debt record completely.

## KPIs & Analytics

### `GET /api/kpis`
- **Description**: Computes and returns Key Performance Indicators (total spent, daily allowance, burn rate, remaining budget) for the current financial month based on the user's custom payday.

## AI Chat & Actions

### `POST /api/chat`
- **Description**: Submits a prompt to the AI assistant. The AI can execute server-side function calls to analyze finances or propose database modifications.
- **Body**: 
  ```json
  {
    "messages": [ { "role": "user", "content": "How much did I spend on groceries?" } ]
  }
  ```
- **Returns**: AI text response and an optional list of `pendingActions` (e.g., adding transactions).

### `POST /api/chat/actions`
- **Description**: Approves and executes pending database actions proposed by the AI assistant.
- **Body**: 
  ```json
  {
    "actions": [
      { "type": "create_transaction", "payload": { /* tx data */ } }
    ]
  }
  ```

## User Settings & Data Management

### `GET /api/settings`
- **Description**: Retrieves the authenticated user's settings profile (payday, salary, emergency buffer).

### `POST /api/settings`
- **Description**: Updates user profile settings.
- **Body**: `{ "payday": 1, "salary": 5000, "emergencyBuffer": 1000 }`

### `GET /api/settings/export-sql`
- **Description**: Triggers a full raw PostgreSQL database dump for the specific user's data (Transactions, Debts, Budgets).
- **Returns**: `.sql` file attachment.

### `POST /api/settings/import-sql`
- **Description**: Parses a previously exported SQL dump and fully restores the user's records.

## System

### `POST /api/seed`
- **Description**: Clears the user's current data and inserts mock historical data for demonstration purposes. Use with extreme caution.
