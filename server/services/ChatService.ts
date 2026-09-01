import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WORKING_MODEL_CACHE_FILE = path.join(process.cwd(), '.last_working_model');

const MAX_HISTORY_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 2_000;
const MAX_CONTEXT_CHARS = 18_000;
const REQUEST_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;

// ── Dynamic Model Caching ──────────────────────────────────────────────────
let cachedFreeModels: string[] = [];
let lastModelFetchTime = 0;

async function getAvailableFreeModels(): Promise<string[]> {
  const now = Date.now();
  // Cache for 1 hour to avoid spamming the endpoint
  if (cachedFreeModels.length > 0 && now - lastModelFetchTime < 1000 * 60 * 60) {
    return cachedFreeModels;
  }

  try {
    const res = await fetch('https://openrouter.ai/api/v1/models');
    if (res.ok) {
      const data = await res.json();
      const free = data.data
        .filter((m: any) => m.pricing && m.pricing.prompt === "0" && m.pricing.completion === "0")
        .map((m: any) => m.id);
      
      if (free.length > 0) {
        cachedFreeModels = free;
        lastModelFetchTime = now;
        return free;
      }
    }
  } catch (error) {
    console.error('Failed to fetch dynamic free models from OpenRouter:', error);
  }

  // Absolute minimum fallbacks if fetch fails
  return ['google/gemini-2.0-flash-exp:free', 'openrouter/free'];
}

type ChatMessage = {
  role: 'user' | 'assistant';
  content: string;
};

function getLastWorkingModel(): string | null {
  try {
    if (fs.existsSync(WORKING_MODEL_CACHE_FILE)) {
      const model = fs.readFileSync(WORKING_MODEL_CACHE_FILE, 'utf-8').trim();
      if (model && model !== 'openrouter/free') return model;
    }
  } catch (error) {
    console.error('Failed to read working model cache:', error);
  }
  return null;
}

function setLastWorkingModel(modelId: string) {
  if (!modelId || modelId === 'openrouter/free') return;
  void fs.promises.writeFile(WORKING_MODEL_CACHE_FILE, modelId, 'utf-8').catch((error) => {
    console.error('Failed to write working model cache:', error);
  });
}

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message: any) =>
        message &&
        (message.role === 'user' || message.role === 'assistant') &&
        typeof message.content === 'string' &&
        message.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message: any) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }));
}

function serializeContext(contextData: unknown): string {
  if (!contextData) return 'No financial data is available yet.';

  try {
    const context = JSON.stringify(contextData, null, 0);
    return context.length > MAX_CONTEXT_CHARS ? `${context.slice(0, MAX_CONTEXT_CHARS)}…[truncated]` : context;
  } catch {
    return 'No financial data is available yet.';
  }
}

function createSystemInstruction(contextData?: unknown) {
  const context = serializeContext(contextData);

  return `You are Spex — TrueSpend's intelligent financial AI assistant. TrueSpend is a personal finance app using the "liquidity" concept (bank + cash - emergency buffer = true spendable wealth).

## CRITICAL OUTPUT FORMAT
Return ONLY a raw JSON object — no markdown fences, no backticks, no preamble.
Required schema:
{"reply":"your message","actions":[],"suggestions":["q1","q2","q3"]}
- "reply": markdown-formatted string (\\n for newlines, **bold**, bullet lists OK)
- "actions": array of proposed mutations (empty [] if none)  
- "suggestions": exactly 3 short follow-up questions relevant to your reply

## YOUR PERSONALITY
Warm, sharp, direct — like a trusted CFO friend. Use tasteful emoji (💰 📊 ✅ ⚠️ 🎯). Keep replies concise unless asked for detail. Celebrate wins, flag risks proactively.

## CURRENCY
All amounts in MAD (Moroccan Dirhams). Always write "MAD" after amounts.

## FINANCIAL MONTH CONCEPT (CRITICAL)
TrueSpend uses FINANCIAL months, NOT calendar months. A financial month starts on payday (e.g. the 25th) and ends the day before the next payday (e.g. the 24th). Example with payday=25: "August 2026" financial month = Jul 25 → Aug 24. The context snapshot already uses financial months — always reference data using this concept, not "August" or "September" as calendar months.

## APP KNOWLEDGE
- **Overview**: KPI cards — Total Liquidity (bank+cash-buffer), Bank Balance, Cash, Daily Allowance (liquidity÷days until payday), Daily Spent, Daily Remaining, Days Until Payday.
- **Transactions**: All financial movements. Types: Income, Expense, Transfer (Bank↔Cash), Debt Repayment. Each has category, wallet (Bank/Cash), amount, date, optional notes.
- **Budgets**: Monthly category spending limits. Tracks spent vs limit. Supports auto-budget plans (50/30/20 etc).
- **Debts & Splits**: Money owed to others (Payable) or owed to user (Receivable). Settled via partial/full payments that create Debt Repayment transactions.
- **Analytics**: Charts — spending trends, category breakdowns, month comparisons. Uses FINANCIAL months.
- **Calendar**: Transactions, income, debt due dates by day.
- **Digest**: AI narrative summary of the last financial month.
- **What-If**: "What if I spend X today?" scenario simulator.
- **Settings**: Payday day (1-31), emergency buffer amount, salary amount.
- **AI Chat (you)**: Natural language interface for queries, logging transactions, budgets, debts, advice.

## TRANSACTION PARSING
- "bought/spent/paid for/purchased" → Expense
- "received/got paid/earned/salary/income" → Income
- "moved/transferred to bank/cash" → Transfer  
- "paid back/repaid/settled a debt" → Debt Repayment
- "lent/gave money to [person]/[person] owes me" → Receivable debt
- "borrowed from/[person] lent me" → Payable debt

## SMART CATEGORY INFERENCE
Do NOT ask the user for a category if you can infer it:
- food/restaurant/café/coffee/snack → "🍔 Dining & Takeaway" or "☕ Coffee & Quick Food"
- grocery/supermarket/market/Carrefour/Marjane → "🛒 Groceries"
- taxi/Uber/Careem/transport/gas/fuel → "🚗 Transportation"
- phone/internet/wifi/Maroc Telecom/Inwi/Orange → "📱 Telecom & Subscriptions"
- doctor/pharmacy/medicine/hospital/health → "🩺 Health & Medical"
- clothes/shoes/fashion/clothing → "👕 Personal & Clothing"
- cinema/game/movie/sport/concert/Netflix → "🎬 Entertainment"
- friend/social/outing/party → "👥 Social"
- family/kids/gift/birthday → "👨‍👩‍👦 Family & Gifts"
- school/course/book/training → "📚 Education & Development"
- rent/electricity/water/internet bill/housing → "🏠 Housing & Utilities"
- salary/income/bonus → "📥 Income"
- transfer between Bank and Cash → "🔄 Transfer"
- debt payment → "💳 Debt & Obligations"
- savings/investment/goal → "💰 Savings & Goals"

## SMART WALLET INFERENCE
- Online purchases, transfers, card payments → "Bank"
- Cash purchases, street vendors, markets, petty cash → "Cash"
- Salary/income → "Bank" (default, but confirm if ambiguous)
- If user specifies cash explicitly → "Cash"

## REPLY GUIDELINES
- **Simple questions** → 1-3 sentence answers. No padding.
- **Complex analysis** → Use markdown headers (##), bullets, bold key numbers.
- **Transaction logging** → Infer category AND wallet from context. Only ask ONE focused question if BOTH are genuinely unclear. NEVER ask for information you can reasonably infer.
- **Budget/spending questions** → Reference FINANCIAL month data, not calendar months.
- **Action proposals** → Say what WILL happen. Never confirm it's done until user approves.
- Keep replies under 250 words unless the user asks for detail or a full breakdown.

## ALLOWED ACTIONS
CRITICAL: If the user provides enough detail for a transaction/setting/budget, include the action in "actions" array. The UI shows an approval card — without the action object there is nothing to approve.

Every action: {"type":"...","summary":"clear plain-English description","parameters":{...}}

### create_transaction
Parameters: {amount:number, type:"Income"|"Expense"|"Transfer"|"Debt Repayment", source_wallet:"Bank"|"Cash", category:string, notes?:string, transaction_date?:"YYYY-MM-DD"}
Expense categories: 🏠 Housing & Utilities, 🛒 Groceries, 🍔 Dining & Takeaway, ☕ Coffee & Quick Food, 🚗 Transportation, 📱 Telecom & Subscriptions, 🩺 Health & Medical, 👕 Personal & Clothing, 🎬 Entertainment, 👥 Social, 👨‍👩‍👦 Family & Gifts, 📚 Education & Development, 💳 Debt & Obligations, 💰 Savings & Goals, 🚨 Unexpected
System categories: 📥 Income (income/salary), 🔄 Transfer (wallet transfers)

### create_debt
Parameters: {amount:number, contact:string, type:"Receivable"|"Payable", due_date?:"YYYY-MM-DD", notes?:string}

### update_settings
Parameters: {payday?:number(1-31), emergencyBuffer?:number, salary?:number}

### upsert_budget
Parameters: {category:string, amount:number, year:number, month:number}

## LIVE FINANCIAL DATA (financial-month scoped)
${context}`;
}

function extractJson(raw: string): string {
  // Strip markdown code fences if present
  let clean = raw.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*/g, '').trim();

  // Try parsing as-is first
  try {
    JSON.parse(clean);
    return clean;
  } catch {
    // Extract first valid JSON object
    const first = clean.indexOf('{');
    const last = clean.lastIndexOf('}');
    if (first !== -1 && last !== -1 && last > first) {
      const candidate = clean.substring(first, last + 1);
      try {
        JSON.parse(candidate);
        return candidate;
      } catch {
        // fall through
      }
    }
    throw new Error('Could not extract valid JSON from AI response');
  }
}

async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(id);
  }
}

/**
 * Calls OpenRouter with automatic model fallback and retry logic.
 * Uses a priority list of capable free models, remembers the last working one,
 * and retries up to MAX_RETRIES times on transient failures.
 */
export async function getChatCompletion(
  messages: unknown,
  contextData?: unknown,
  sessionId?: unknown,
): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY environment variable is not set');

  const chatMessages = normalizeMessages(messages);
  if (!chatMessages.length) throw new Error('At least one chat message is required');

  // Inject a strict reminder on the final user message to prevent the model from copying the assistant's plain text history
  const lastMsg = chatMessages[chatMessages.length - 1];
  if (lastMsg && lastMsg.role === 'user') {
    lastMsg.content += '\n\n[CRITICAL REMINDER: Your response MUST be ONLY a raw JSON object matching the required schema. Do not output markdown fences, plain text, or any preamble. Just the raw JSON.]';
  }

  const systemMessage = createSystemInstruction(contextData);
  const validSessionId =
    typeof sessionId === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(sessionId)
      ? sessionId
      : undefined;

  // Dynamically fetch free models and pick the top 3
  const freeModels = await getAvailableFreeModels();
  
  // Prefer these top-tier families if they have free models available right now
  const preferredKeywords = ['gemini', 'llama', 'deepseek'];
  const candidates: string[] = [];
  
  for (const kw of preferredKeywords) {
    const found = freeModels.find(m => m.toLowerCase().includes(kw));
    if (found && !candidates.includes(found)) {
      candidates.push(found);
    }
  }
  
  // Fill the rest with any other available free models
  for (const m of freeModels) {
    if (candidates.length >= 3) break;
    if (!candidates.includes(m) && m !== 'openrouter/free') {
      candidates.push(m);
    }
  }
  
  // Ensure openrouter/free is in the list as the final fallback
  if (!candidates.includes('openrouter/free')) {
    candidates.push('openrouter/free');
  }

  const lastWorking = getLastWorkingModel();
  
  // Build final array: Last working (if still free) -> Top candidates
  let models = lastWorking && freeModels.includes(lastWorking)
    ? [lastWorking, ...candidates.filter(m => m !== lastWorking)]
    : candidates;
    
  // OpenRouter supports a maximum of 3 models in the fallback array
  const openRouterModels = models.slice(0, 3);

  const requestStartedAt = Date.now();
  let lastError: Error = new Error('Unknown error');

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'HTTP-Referer': 'https://truespend.app',
            'X-OpenRouter-Title': 'TrueSpend AI Chat',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            models: openRouterModels,
            messages: [{ role: 'system', content: systemMessage }, ...chatMessages],
            max_completion_tokens: 3000,
            temperature: 0.7,
            stream: false,
            ...(validSessionId ? { session_id: validSessionId } : {}),
            provider: {
              // Among free providers, prefer lowest latency
              sort: { by: 'latency', partition: 'none' },
              max_price: { prompt: 0, completion: 0 },
              // Allow fallback across all free providers
              allow_fallbacks: true,
            },
          }),
        },
        REQUEST_TIMEOUT_MS,
      );

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        throw new Error(
          `OpenRouter request failed (${response.status}): ${detail || response.statusText}`,
        );
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(`OpenRouter error: ${data.error.message || JSON.stringify(data.error)}`);
      }

      const rawContent = data.choices?.[0]?.message?.content;

      if (typeof rawContent !== 'string' || !rawContent.trim()) {
        console.error('Empty response from OpenRouter. Raw data:', JSON.stringify(data, null, 2));
        throw new Error('The AI returned an empty response. Please try again.');
      }

      const cleanContent = extractJson(rawContent);

      // Validate the JSON has the expected shape; repair if needed
      let parsed: any;
      try {
        parsed = JSON.parse(cleanContent);
      } catch {
        throw new Error('The AI returned an invalid response format. Please try again.');
      }

      // Ensure required fields exist with sensible defaults
      if (typeof parsed.reply !== 'string' || !parsed.reply.trim()) {
        throw new Error('The AI returned an empty reply. Please try again.');
      }
      if (!Array.isArray(parsed.actions)) parsed.actions = [];
      if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) {
        parsed.suggestions = [
          'What is my spending this financial month?',
          'How is my daily allowance looking?',
          'Show me my budget status.',
        ];
      }

      data.choices[0].message.content = JSON.stringify(parsed);

      const modelUsed = typeof data.model === 'string' ? data.model : openRouterModels[0];
      setLastWorkingModel(modelUsed);

      return {
        ...data,
        modelUsed,
        responseTimeMs: Date.now() - requestStartedAt,
      };
    } catch (error: any) {
      if (error?.name === 'AbortError') {
        lastError = new Error('The AI took too long to respond. Please try again.');
      } else {
        lastError = error instanceof Error ? error : new Error(String(error));
      }

      // Don't retry on the last attempt
      if (attempt < MAX_RETRIES) {
        console.warn(`[ChatService] Attempt ${attempt + 1} failed: ${lastError.message}. Retrying…`);
        await new Promise((res) => setTimeout(res, 800 * (attempt + 1))); // back-off
      }
    }
  }

  throw lastError;
}
