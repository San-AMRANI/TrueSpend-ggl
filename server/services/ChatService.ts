import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WORKING_MODEL_CACHE_FILE = path.join(process.cwd(), '.last_working_model');
const DEFAULT_FREE_MODEL = 'liquid/lfm-2.5-2.6b:free';
const FREE_ROUTER_MODEL = 'openrouter/free';
const MAX_HISTORY_MESSAGES = 8;
const MAX_MESSAGE_CHARS = 1_200;
const MAX_CONTEXT_CHARS = 12_000;
const REQUEST_TIMEOUT_MS = 18_000;

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

  return `You are TrueSpend's financial assistant. Return one valid JSON object only, with no Markdown fence: {"reply":"text","actions":[]}.
Use MAD. Keep replies concise (normally under 140 words), factual, and helpful. Never say a change is complete until the user approves it.

For a write request, create an action only when all required details are known; otherwise ask one short follow-up question. Every action is a proposal and must be {"type":"...","summary":"clear description","parameters":{...}}.
Allowed actions: create_transaction {amount, type:"Income"|"Expense"|"Transfer"|"Debt Repayment", source_wallet:"Bank"|"Cash", category, notes?, transaction_date?:"YYYY-MM-DD"}; create_debt {amount, contact, type:"Receivable"|"Payable", due_date?:"YYYY-MM-DD"}; update_settings {payday?:1..31, emergencyBuffer?:number, salary?:number}; upsert_budget {category, amount, year, month}.

Financial snapshot: ${context}`;
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
        max_completion_tokens: 700,
        temperature: 0.8,
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

    const cleanContent = content.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*/g, '').trim();
    try {
      JSON.parse(cleanContent);
    } catch {
      throw new Error('The AI returned an invalid response. Please try again.');
    }

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
