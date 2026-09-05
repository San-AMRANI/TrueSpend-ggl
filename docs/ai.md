# TrueSpend AI Feature Architecture & Technical Guide

This document provides a comprehensive, end-to-end explanation of how the AI feature (**Spex**, TrueSpend's intelligent financial assistant) works across the frontend, backend, LLM integration, and database action execution layers.

---

## 1. High-Level Overview

TrueSpend incorporates a full-stack, conversational AI copilot named **Spex**. Unlike generic chatbots, Spex has deep domain awareness of personal finance principles and direct, real-time visibility into the user's financial ledger.

### Core Domain Principles
1. **TrueSpend Liquidity Formula**: 
   $$\text{True Spendable Liquidity} = \text{Bank Balance} + \text{Cash on Hand} - \text{Emergency Buffer}$$
2. **Financial Month vs. Calendar Month**:
   TrueSpend operates on **Financial Months** tied to the user's custom payday (e.g., 25th of the month) rather than the 1st of a calendar month. Spex references data exclusively through this financial period lens.
3. **Primary Currency**:
   All figures are denominated in Moroccan Dirhams (`MAD`).
4. **Human-in-the-Loop Safety**:
   The AI **never modifies the database silently or autonomously**. It proposes structured mutation actions, which are rendered as visual approval cards in the UI. Data mutations only execute after the user explicitly clicks **"Approve"**.

---

## 2. End-to-End System Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                               CLIENT (React)                           │
│                                                                        │
│  ┌────────────────────┐     ┌───────────────────────────────────────┐  │
│  │ User Prompt /      │     │ Financial Context Builder             │  │
│  │ Voice Dictation /  │     │ (src/lib/aiContext.ts)                │  │
│  │ Receipt OCR        │     │ Injects: KPIs, Budgets, Txns, Debts,  │  │
│  │ (Tesseract.js)     │     │ Payday dates, Emergency Buffer        │  │
│  └─────────┬──────────┘     └──────────────────┬────────────────────┘  │
│            │                                   │                       │
│            └─────────────────┬─────────────────┘                       │
│                              │ POST /api/chat                          │
└──────────────────────────────┼─────────────────────────────────────────┘
                               │ (Bearer Token Auth)
┌──────────────────────────────▼─────────────────────────────────────────┐
│                          BACKEND (Express.js)                          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ ChatController (server/controllers/ChatController.ts)            │  │
│  │ - Validates user session and payload                             │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ ChatService (server/services/ChatService.ts)                     │  │
│  │ 1. Dynamic Model Discovery (fetches free OpenRouter models)      │  │
│  │ 2. System Instruction Assembly + Context Serialization           │  │
│  │ 3. Multi-model fallback array (Gemini, Llama, DeepSeek)          │  │
│  │ 4. Resilience: 30s timeout, retries, model cache file            │  │
│  │ 5. Response Sanitizer & JSON Extractor                           │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
└─────────────────────────────────────┼──────────────────────────────────┘
                                      │ HTTP Request
┌─────────────────────────────────────▼──────────────────────────────────┐
│                      OPENROUTER AI INFERENCE API                       │
│                                                                        │
│  Executes prompt with dynamic fallback across top free models:         │
│  - google/gemini-2.0-flash-exp:free                                    │
│  - meta-llama/llama-3.3-70b-instruct:free                              │
│  - deepseek/deepseek-chat:free / openrouter/free                       │
│  Returns raw structured JSON: { reply, actions, suggestions }          │
└─────────────────────────────────────┬──────────────────────────────────┘
                                      │
┌─────────────────────────────────────▼──────────────────────────────────┐
│                               CLIENT (React)                           │
│                                                                        │
│  - Renders markdown reply from Spex                                    │
│  - Displays dynamic follow-up prompt chips                             │
│  - Renders Action Proposal Card:                                       │
│    [ ✅ Approve ]    [ ✕ Reject ]                                      │
│                               │                                        │
│                               │ User clicks "Approve"                  │
│                               │ POST /api/chat/actions                 │
└───────────────────────────────┼────────────────────────────────────────┘
                                │
┌───────────────────────────────▼────────────────────────────────────────┐
│                     BACKEND ACTION GATEWAY                             │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ AiActionGateway (server/services/AiActionGateway.ts)             │  │
│  │ - Sanitizes and validates action parameters                      │  │
│  │ - Executes authorized service mutations:                         │  │
│  │   • TransactionService.createTransaction                         │  │
│  │   • DebtService.processDebt                                      │  │
│  │   • SettingsService.updateSettings                               │  │
│  │   • CategoryBudgetService.upsertBudget                           │  │
│  │   • GoalService.createGoal / contributeToGoal                    │  │
│  └──────────────────────────────────┬───────────────────────────────┘  │
│                                     │                                  │
│  ┌──────────────────────────────────▼───────────────────────────────┐  │
│  │ PostgreSQL Database (Drizzle ORM)                                │  │
│  │ Records updated -> Client triggers fetchData() -> UI refreshed  │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Real-Time Financial Context Injection (`src/lib/aiContext.ts`)

Every chat message sent to `/api/chat` packages a live context snapshot generated client-side by `buildAiContextSnapshot`. This provides Spex with precise ground-truth financial state without requiring extra database roundtrips during prompt compilation.

### Context Snapshot Structure
```typescript
{
  asOf: "2026-09-04",
  currency: "MAD",
  financialPeriod: {
    label: "Aug 25 – Sep 24, 2026",
    start: "2026-08-25",
    end: "2026-09-24",
    startsWithPayroll: 18000,
    closesWithPayroll: "2026-09-25"
  },
  kpis: {
    totalLiquidity: 14250.00,
    bankBalance: 16500.00,
    cashOnHand: 1750.00,
    monthlyIncome: 18000.00,
    monthlyExpenses: 3750.00,
    dailyAllowance: 475.00,
    dailySpent: 120.00,
    dailyRemaining: 355.00,
    daysUntilPayroll: 20
  },
  financialPeriodSummary: {
    income: 18000.00,
    expenses: 3750.00,
    netPosition: 14250.00,
    previousPeriodExpenses: 11200.00
  },
  payrolls: [ { date: "2026-08-25", amount: 18000 } ],
  budgets: [ { category: "🛒 Groceries", amount: 2500, year: 2026, month: 8 } ],
  emergencyBuffer: 4000.00,
  debts: [ { contact: "Karim", type: "Receivable", remaining: 400, dueDate: "2026-09-15" } ],
  recentTransactions: [
    {
      date: "2026-09-03",
      amount: 65.00,
      type: "Expense",
      category: "☕ Coffee & Quick Food",
      note: "Starbucks",
      inCurrentFinancialPeriod: true
    }
  ]
}
```

### Context Safety Boundaries
- **History truncation**: Retains the last 16 conversational messages.
- **Message char limit**: Caps individual messages at 2,000 characters.
- **Context payload limit**: Context JSON string is capped at 18,000 characters to prevent prompt injection and stay safely within token limits.

---

## 4. LLM Routing & Resilience (`server/services/ChatService.ts`)

TrueSpend connects to OpenRouter to leverage high-performance, cost-effective LLMs with zero downtime.

### 1. Dynamic Free Model Discovery
Instead of hardcoding a single static model that may become rate-limited or deprecated, `ChatService` dynamically queries OpenRouter's catalog:
- Runs `GET https://openrouter.ai/api/v1/models` (cached in-memory for 1 hour).
- Filters models where prompt and completion pricing are both `"0"`.
- Prioritizes top model families by keyword:
  1. `gemini` (e.g., `google/gemini-2.0-flash-exp:free`)
  2. `llama` (e.g., `meta-llama/llama-3.3-70b-instruct:free`)
  3. `deepseek` (e.g., `deepseek/deepseek-chat:free`)
- Fallback: `openrouter/free`.

### 2. Multi-Model Failover Array
OpenRouter accepts a prioritized array of up to 3 candidate models in a single request (`models: [modelA, modelB, modelC]`). If the primary model is busy or throttled, OpenRouter automatically routes to the secondary model.

### 3. Persistent Working Model Cache
- Successful model IDs are persisted to disk at `.last_working_model`.
- Subsequent user requests prioritize the known-working model to eliminate routing latency.

### 4. Robust Retry & Timeout Mechanism
- **Timeout**: `AbortController` enforces a strict 30,000 ms timeout per request.
- **Retries**: Up to 2 automatic retries on network or transient errors with exponential backoff (`800ms * attempt`).

---

## 5. Output Format & Response Parsing

To guarantee clean UI rendering and programmatic action handling, Spex is strictly instructed to return **only raw JSON** with no markdown code fences:

```json
{
  "reply": "You have **355.00 MAD** remaining in your daily allowance today.",
  "actions": [],
  "suggestions": [
    "How much did I spend on food?",
    "Show my progress towards vacation",
    "What is my safe-to-spend balance?"
  ]
}
```

### Response Sanitization Pipeline
1. `extractJson(raw)`: Strips markdown backticks (````json ... ````) if emitted by conversational models.
2. Locates the outermost `{` and `}` delimiters to isolate the valid JSON object.
3. `JSON.parse` validation: Confirms that `reply` is non-empty.
4. Fallback defaults: If `suggestions` is missing or empty, default contextual prompts are populated.

---

## 6. The AI Action Gateway (`server/services/AiActionGateway.ts`)

When a user asks to record an expense, log a debt, set a budget, or update settings, Spex generates an **Action Proposal**.

### Supported Action Types

| Action Type | Key Parameters | Description |
| :--- | :--- | :--- |
| `create_transaction` | `amount`, `type`, `source_wallet`, `category`, `notes`, `transaction_date` | Logs an Income, Expense, Transfer, or Debt Repayment. |
| `create_debt` | `amount`, `contact`, `type` (`Receivable` \| `Payable`), `due_date`, `notes` | Logs money lent to or borrowed from another person. |
| `update_settings` | `payday`, `emergencyBuffer`, `salary` | Adjusts payday schedule or buffer thresholds. |
| `upsert_budget` | `category`, `amount`, `year`, `month` | Sets or updates monthly category spending limits. |
| `create_goal` | `name`, `targetAmount`, `currentAmount`, `deadline`, `category` | Creates a new savings milestone. |
| `contribute_goal` | `goalId`, `amount` | Adds funds to an active savings goal. |
| `settle_debt` | `debtId`, `amount`, `sourceWallet` | Records a debt payment and adjusts balance. |

### Smart Category & Wallet Inference
Spex infers categories and payment methods automatically without badgering the user with clarifying questions:
- *Keywords like "Carrefour", "Marjane", "supermarket"* $\rightarrow$ `🛒 Groceries`
- *Keywords like "taxi", "Careem", "fuel", "gas"* $\rightarrow$ `🚗 Transportation`
- *Keywords like "coffee", "Starbucks", "cafe"* $\rightarrow$ `☕ Coffee & Quick Food`
- *Online orders, subscriptions, card payments* $\rightarrow$ `Bank` wallet
- *Street purchases, market cash* $\rightarrow$ `Cash` wallet

### Execution Flow
1. User reviews proposed parameters on the card.
2. User clicks **Approve**.
3. Client sends `POST /api/chat/actions` with `{ actions: [...] }`.
4. `AiActionGateway` runs `sanitizeAiActions`, strips unpermitted keys, validates data types, and calls the respective database service (`TransactionService`, `DebtService`, etc.).
5. On success, `useDashboardData.fetchData()` re-fetches all state, updating the dashboard, charts, and balances immediately.

---

## 7. Multimodal Receipt Scanning & Voice Input

### 1. Client-Side OCR (`Tesseract.js`)
- Users can click the **Camera / Image** icon in the chat interface to upload or take a photo of a receipt or invoice.
- In-browser optical character recognition (`Tesseract.recognize(file, 'eng+fra')`) extracts text locally without sending heavy image binaries to external servers.
- The extracted text is automatically converted into a structured prompt:
  > *"I am uploading a receipt/ticket. Please parse it and propose a transaction. Here is the extracted text: [OCR text]"*

### 2. Heuristic Receipt Parsing (`server/services/ReceiptExtractionService.ts`)
The server provides a secondary deterministic extraction endpoint (`POST /api/receipts/parse`) utilizing regex and pattern matchers:
- **Amount detection**: Extracts totals matching currencies (`MAD`, `DH`, `EUR`, `USD`) with Moroccan/European comma decimals.
- **Date detection**: Normalizes formats (`YYYY-MM-DD`, `DD/MM/YYYY`).
- **Merchant extraction**: Identifies merchant header names while ignoring generic labels (`TOTAL`, `TAX`, `INVOICE`).
- **Confidence scoring**: Computes confidence based on field completeness.

### 3. Voice Input (`SpeechRecognition`)
- Supports hands-free input using the browser's native Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`).
- Dictation appears live in the chat text area for user review before sending.

---

## 8. What-If Scenario Simulator

When a user asks hypothetical questions such as:
- *"What if I spend 1,200 MAD on new headphones today?"*
- *"Can I afford a 3,000 MAD weekend trip?"*

Spex is instructed **not to emit a `create_transaction` action**. Instead, it uses the live financial context to calculate the mathematical consequence:
1. Deducts the proposed amount from `totalLiquidity` and `dailyRemaining`.
2. Computes the resulting daily allowance for the remaining days until payday.
3. Warns if the purchase would breach the Emergency Buffer or cause negative cash flow.
4. Delivers an objective recommendation.

---

## 9. Security & Privacy

1. **Authentication Required**: All AI endpoints (`/api/chat`, `/api/chat/actions`, `/api/receipts/parse`) are protected by the `requireAuth` middleware verifying user JWT tokens.
2. **User Data Isolation**: Actions executed via the `AiActionGateway` are strictly scoped to the authenticated `req.dbUser.id`. Users cannot mutate or query another user's financial records.
3. **No Direct Model Database Access**: The LLM has zero direct database connection credentials; it only receives serialized read-only summaries and emits structured JSON intent.
