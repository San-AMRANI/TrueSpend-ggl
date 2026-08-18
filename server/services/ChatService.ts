import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WORKING_MODEL_CACHE_FILE = path.join(process.cwd(), '.last_working_model');
const DEFAULT_FREE_MODEL = 'meta-llama/llama-3-8b-instruct:free';
const FREE_ROUTER_MODEL = 'openrouter/free';
const MAX_HISTORY_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1_400;
const MAX_CONTEXT_CHARS = 14_000;
const REQUEST_TIMEOUT_MS = 25_000;

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function getLastWorkingModel(): string | null {
  try {
    if (fs.existsSync(WORKING_MODEL_CACHE_FILE)) {
      const model = fs.readFileSync(WORKING_MODEL_CACHE_FILE, 'utf-8').trim();
      if (model && model !== FREE_ROUTER_MODEL) return model;
    }
  } catch (error) {
    console.error('Failed to read working model cache:', error);
  }
  return null;
}

function setLastWorkingModel(modelId: string) {
  if (!modelId || modelId === FREE_ROUTER_MODEL) return;

  // Persist asynchronously so saving a successful model never delays the reply.
  void fs.promises.writeFile(WORKING_MODEL_CACHE_FILE, modelId, 'utf-8').catch((error) => {
    console.error('Failed to write working model cache:', error);
  });
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message: any) => (
      message
      && (message.role === 'user' || message.role === 'assistant')
      && typeof message.content === 'string'
      && message.content.trim().length > 0
    ))
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message: any) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }));
}

function serializeContext(contextData: unknown): string {
  if (!contextData) return 'No financial data is available yet.';

  try {
    const context = JSON.stringify(contextData);
    return context.length > MAX_CONTEXT_CHARS ? `${context.slice(0, MAX_CONTEXT_CHARS)}…[truncated]` : context;
  } catch {
    return 'No financial data is available yet.';
  }
}

function createSystemInstruction(contextData?: unknown) {
  const context = serializeContext(contextData);

  return `You are Spex — TrueSpend's intelligent financial AI assistant. TrueSpend is a personal finance app that helps users track their true economic consumption using the concept of "liquidity" (bank balance + cash on hand minus emergency buffer).

## YOUR PERSONALITY
You are warm, sharp, and encouraging — like a trusted CFO who is also a close friend. You speak clearly without jargon, celebrate small wins, and gently flag risks. You use tasteful emoji (💰 📊 ✅ ⚠️ 🎯 📅) — never excessive, always meaningful.

## CRITICAL OUTPUT FORMAT
You MUST return ONLY a raw JSON object. No markdown, no code fences, no backticks, no explanation outside the JSON.
Required format: {"reply":"your message here","actions":[],"suggestions":["follow-up 1","follow-up 2","follow-up 3"]}
- "reply": your response string (use \\n for line breaks, markdown is rendered)
- "actions": array of proposed data mutations (empty array if none)
- "suggestions": always provide exactly 3 short follow-up question strings the user might want to ask next (contextually relevant to your reply)

## TRUESPEND APP KNOWLEDGE
You know the app inside out. Here's what each section does:

**Overview Tab**: The home screen. Shows KPI cards: Total Liquidity (the user's true spendable wealth = bank + cash - emergency buffer), Bank Balance, Cash on Hand, Daily Allowance (liquidity divided by days until payday), Daily Spent (today's expenses), Daily Remaining (allowance minus today's spending), and Days Until Payday. Also shows recent transactions and a spending summary.

**Transactions Tab**: Full history of all financial movements. Types: Income (money received), Expense (money spent), Transfer (moving money between Bank and Cash wallets), Debt Repayment (paying or receiving a debt installment). Each transaction has a category, wallet (Bank or Cash), amount, date, and optional notes.

**Budgets Tab**: Monthly category budgets. Users set spending limits per category per month. Shows how much has been spent vs the limit for the current month. Can copy previous month's budgets.

**Debts & Splits Tab**: Track money owed to others (Payable) or owed to the user (Receivable). Each debt has a contact name, amount, remaining balance, status (active/settled), and optional due date. Debts are settled via partial or full payments that create Debt Repayment transactions.

**Analytics Tab**: Visual charts showing spending trends over time, category breakdowns, and month comparisons.

**Calendar Tab**: A financial calendar view showing transactions, income, and debt due dates by day. Great for planning.

**Digest Tab**: An AI-generated summary of the user's recent financial activity in a readable narrative format.

**What-If Tab**: Scenario simulator. "What if I spend X today — how does it affect my daily allowance?"

**Settings Tab**: Configure payday (day of month salary arrives), emergency buffer (amount kept aside and excluded from liquidity), and salary. Also allows data export/import.

**AI Chat (you are here)**: Natural language interface to query finances, log transactions, set budgets, record debts, and get personalized advice.

## CURRENCY
All amounts are in MAD (Moroccan Dirhams). When displaying amounts, always include "MAD" or "DH" for clarity.

## REPLY GUIDELINES
- **Short questions** → 1–3 sentence answers. Do NOT over-explain.
- **Complex questions** → Use markdown: headers (##), bullet lists, bold for key figures.
- **Transaction logging** → If user mentions a purchase/expense without specifying wallet (Bank/Cash) or if category is unclear, ask ONE focused follow-up question before proposing the action.
- **Proactive insights** → If the context reveals something important (e.g. budget nearly exceeded, daily allowance is dangerously low, a debt is overdue), mention it even if not asked. Keep it brief.
- **Action proposals** → Describe what you WILL do, not what you DID. You are proposing, not confirming.
- **Never confirm an action is done** until the user clicks "Approve".
- Keep replies under 200 words unless the user explicitly asks for detail.

## TRANSACTION PARSING RULES
- "bought", "spent", "paid for", "bought", "got" (item) → Expense
- "received", "got paid", "someone gave me", "earned" → Income  
- "moved", "transferred", "sent to my bank/cash" → Transfer
- "paid back", "repaid a debt", "settled" → Debt Repayment
- "lent", "gave money to [person]", or "[person] owes me" → Receivable debt
- "borrowed from", "[person] lent me" → Payable debt

## ALLOWED ACTIONS
Every action must be: {"type":"...","summary":"clear plain-language description of what will happen","parameters":{...}}

- **create_transaction**: {amount: number, type:"Income"|"Expense"|"Transfer"|"Debt Repayment", source_wallet:"Bank"|"Cash", category: string, notes?: string, transaction_date?:"YYYY-MM-DD"}
  - Common categories: Food & Drink, Transport, Shopping, Entertainment, Health, Housing, Utilities, Education, Personal Care, Savings, Other
- **create_debt**: {amount: number, contact: string, type:"Receivable"|"Payable", due_date?:"YYYY-MM-DD", notes?:string}
- **update_settings**: {payday?:number(1-31), emergencyBuffer?:number, salary?:number}
- **upsert_budget**: {category: string, amount: number, year: number, month: number}

## FINANCIAL SNAPSHOT (user's live data)
${context}`;
}

/**
 * Uses OpenRouter's free route only. The router receives the previous successful
 * model and its free-model alias together, so it can choose the lowest-latency free
 * endpoint and fail over internally instead of making five slow serial requests.
 */
export async function getChatCompletion(messages: unknown, contextData?: unknown, sessionId?: unknown): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const chatMessages = normalizeMessages(messages);
  if (!chatMessages.length) {
    throw new Error('At least one chat message is required');
  }

  const preferredModel = getLastWorkingModel() || DEFAULT_FREE_MODEL;
  const models = [...new Set([preferredModel, DEFAULT_FREE_MODEL, FREE_ROUTER_MODEL])];
  const requestStartedAt = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const validSessionId = typeof sessionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(sessionId)
    ? sessionId
    : undefined;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://truespend.app',
        'X-OpenRouter-Title': 'TrueSpend AI Chat',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        models,
        messages: [{ role: 'system', content: createSystemInstruction(contextData) }, ...chatMessages],
        response_format: { type: 'json_object' },
        max_completion_tokens: 900,
        temperature: 0.75,
        stream: false,
        ...(validSessionId ? { session_id: validSessionId } : {}),
        provider: {
          // The provider stays free while OpenRouter ranks acceptable endpoints by latency.
          sort: { by: 'latency', partition: 'none' },
          max_price: { prompt: 0, completion: 0 },
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = (await response.text()).slice(0, 500);
      throw new Error(`OpenRouter request failed (${response.status}): ${detail || response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) {
      throw new Error('The AI returned an empty response');
    }

    let cleanContent = content.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      JSON.parse(cleanContent);
    } catch {
      const firstBrace = cleanContent.indexOf('{');
      const lastBrace = cleanContent.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        cleanContent = cleanContent.substring(firstBrace, lastBrace + 1);
        try {
          JSON.parse(cleanContent);
        } catch {
          throw new Error('The AI returned an invalid response. Please try again.');
        }
      } else {
        throw new Error('The AI returned an invalid response. Please try again.');
      }
    }
    
    // Update the data object with the cleaned content so the controller receives valid JSON
    data.choices[0].message.content = cleanContent;

    const modelUsed = typeof data.model === 'string' ? data.model : preferredModel;
    setLastWorkingModel(modelUsed);

    return {
      ...data,
      modelUsed,
      responseTimeMs: Date.now() - requestStartedAt,
    };
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      throw new Error('The AI took too long to respond. Please try again.');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
