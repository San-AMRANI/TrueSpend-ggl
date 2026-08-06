# TrueSpend API Documentation

This application uses a full-stack architecture where the React frontend communicates with an Express backend exclusively via RESTful APIs. 

Below is the complete documentation for all internal APIs.

## Base URL
All API endpoints are relative to the server root:
\`http://localhost:3000\`

---

## Authentication

Most endpoints require authentication. The app uses JSON Web Tokens (JWT).
To access protected endpoints, you must include the token in the request headers:

\`\`\`http
Authorization: Bearer <your_jwt_token>
\`\`\`

---

## Endpoints

### 1. System Health

#### \`GET /api/health\`
Checks if the API server is running.
- **Auth Required**: No
- **Response (200 OK)**:
  \`\`\`json
  {
    "status": "ok"
  }
  \`\`\`

---

### 2. Authentication

#### \`POST /api/login\`
Authenticates a user and returns a JWT token.
- **Auth Required**: No
- **Request Body**:
  \`\`\`json
  {
    "username": "admin",
    "password": "admin123"
  }
  \`\`\`
- **Response (200 OK)**:
  \`\`\`json
  {
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "user": {
      "email": "admin@local.host",
      "uid": "admin"
    }
  }
  \`\`\`
- **Response (401 Unauthorized)**:
  \`\`\`json
  {
    "error": "Invalid credentials"
  }
  \`\`\`

---

### 3. Analytics & KPIs

#### \`GET /api/kpis\`
Retrieves Key Performance Indicators (KPIs) for the currently authenticated user's dashboard.
- **Auth Required**: Yes
- **Response (200 OK)**:
  \`\`\`json
  {
    "totalLiquidity": 1865.48,
    "bankBalance": 1866.48,
    "cashOnHand": -1,
    "monthlyExpenses": 4601.22,
    "monthlyIncome": 6466.7,
    "adjustedTrueSpend": 2071.22,
    "daysUntilPayday": 19,
    "dailyAllowance": 98.18
  }
  \`\`\`

---

### 4. Transactions

#### \`GET /api/transactions\`
Retrieves a list of all transactions for the authenticated user, ordered by creation date (descending).
- **Auth Required**: Yes
- **Response (200 OK)**:
  \`\`\`json
  [
    {
      "id": "uuid-string",
      "userId": "uuid-string",
      "createdAt": "2026-08-03T13:00:00.000Z",
      "amount": "26.00",
      "type": "Expense",
      "sourceWallet": "Bank",
      "category": "Food",
      "notes": "Lunch at restaurant"
    }
  ]
  \`\`\`

#### \`POST /api/transactions\`
Creates a new transaction. Optionally creates a linked debt (Receivable) and split if the transaction was partially fronted for someone else.
- **Auth Required**: Yes
- **Request Body**:
  \`\`\`json
  {
    "amount": 50.00,
    "type": "Expense",           // "Income" | "Expense" | "Transfer" | "Debt Repayment"
    "source_wallet": "Bank",     // "Bank" | "Cash"
    "category": "Food",
    "notes": "Dinner",
    "reimbursable_amount": 25.00,  // Optional: If split with someone
    "linked_contact_name": "John"  // Optional: Contact name for the split
  }
  \`\`\`
- **Response (201 Created)**:
  \`\`\`json
  {
    "message": "Transaction created",
    "id": "new-uuid-string"
  }
  \`\`\`

#### \`DELETE /api/transactions/:id\`
Deletes a specific transaction by its ID. It also deletes any associated split records to maintain referential integrity.
- **Auth Required**: Yes
- **Path Parameter**: `id` - The UUID of the transaction.
- **Response (200 OK)**:
  \`\`\`json
  {
    "message": "Transaction deleted"
  }
  \`\`\`

---

### 5. Debts & Splits

#### \`GET /api/debts\`
Retrieves a list of all debts (Receivables and Payables) for the authenticated user.
- **Auth Required**: Yes
- **Response (200 OK)**:
  \`\`\`json
  [
    {
      "id": "uuid-string",
      "userId": "uuid-string",
      "contactName": "John",
      "type": "Receivable",
      "originalAmount": "25.00",
      "remainingBalance": "25.00",
      "status": "Pending",
      "createdAt": "2026-08-04T10:00:00.000Z"
    }
  ]
  \`\`\`

#### \`POST /api/debts\`
This endpoint acts as a dual-purpose route for either **creating** a new debt or **settling/updating** an existing debt.
- **Auth Required**: Yes

**Scenario A: Create a New Debt**
- **Request Body**:
  \`\`\`json
  {
    "amount": 100.00,
    "contact": "Jane Doe",
    "type": "Payable"       // "Receivable" | "Payable"
  }
  \`\`\`
- **Response (201 Created)**:
  \`\`\`json
  {
    "message": "Debt created"
  }
  \`\`\`

**Scenario B: Settle an Existing Debt**
- **Request Body**:
  \`\`\`json
  {
    "debt_id": "existing-uuid-string",
    "amount": 50.00
  }
  \`\`\`
- **Response (200 OK)**:
  \`\`\`json
  {
    "message": "Debt settled"
  }
  \`\`\`

---

### 6. Development & Seeding

#### \`POST /api/seed\`
Truncates the authenticated user's current data (Transactions, Debts, Splits) and repopulates the database from the `seed_data.json` file.
- **Auth Required**: Yes
- **Response (200 OK)**:
  \`\`\`json
  {
    "success": true
  }
  \`\`\`
