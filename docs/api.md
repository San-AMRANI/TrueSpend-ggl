# API Documentation

## Authentication
Most API endpoints require authentication using a JWT token. The token should be included in the \`Authorization\` header as a Bearer token:
\`Authorization: Bearer <token>\`

## Endpoints

### Auth & System
- **GET \`/api/health\`**
  - Returns: \`{ "status": "ok" }\`
- **POST \`/api/login\`**
  - Body: \`{ "username": "admin", "password": "password" }\`
  - Returns: \`{ "token": "<jwt>", "user": { ... } }\`

### KPIs & Analytics
- **GET \`/api/kpis\`**
  - Description: Returns key performance indicators for the current monthly cycle (based on the user's defined payday).
  - Returns:
    \`\`\`json
    {
      "bankBalance": 1000,
      "cashOnHand": 200,
      "totalLiquidity": 1200,
      "monthlyExpenses": 500,
      "monthlyIncome": 2000,
      "adjustedTrueSpend": 450,
      "daysUntilPayday": 12,
      "dailyAllowance": 100,
      "payday": 25
    }
    \`\`\`

### Transactions
- **GET \`/api/transactions\`**
  - Description: Retrieves all transactions sorted by date descending.
- **POST \`/api/transactions\`**
  - Description: Logs a new transaction. If \`reimbursable_amount\` is provided, it automatically creates a corresponding debt record.
  - Body:
    \`\`\`json
    {
      "amount": 150.50,
      "type": "Expense", // "Expense", "Income", "Transfer"
      "source_wallet": "Bank", // "Bank", "Cash"
      "category": "Groceries",
      "notes": "Weekly shop",
      "reimbursable_amount": 50.00, // Optional
      "linked_contact_name": "John Doe" // Optional
    }
    \`\`\`
- **DELETE \`/api/transactions/:id\`**
  - Description: Deletes a specific transaction. Note: This does not automatically revert associated debts currently.

### Debts & Splits
- **GET \`/api/debts\`**
  - Description: Retrieves all debts (receivables and payables).
- **POST \`/api/debts\`**
  - Description: Settles a specific amount for an existing debt.
  - Body:
    \`\`\`json
    {
      "debt_id": "uuid",
      "amount": 50.00
    }
    \`\`\`

### Settings
- **GET \`/api/settings\`**
  - Description: Retrieves user settings (e.g., payday).
  - Returns: \`{ "payday": 25 }\`
- **POST \`/api/settings\`**
  - Description: Updates the user's payday.
  - Body: \`{ "payday": 25 }\`
