import dotenv from 'dotenv';
import {
  gemini,
  MODEL_FLASH_LITE,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_LATEST,
  MODEL_TTS,
  isModelQuotaExhausted,
  markModelQuotaExhausted,
} from './GeminiClient.js';

dotenv.config();

const MAX_HISTORY_MESSAGES = 16;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_CONTEXT_CHARS = 24_000;

// In-memory TTS Cache to avoid wasting the 10 calls/day quota on re-plays
const ttsCache = new Map<string, { audio: string; mimeType: string }>();

export type ChatMessage = {
  role: 'user' | 'assistant' | 'system';
  content: string;
  image?: {
    data: string; // base64
    mimeType: string;
  };
};

function normalizeMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter(
      (message: any) =>
        message &&
        (message.role === 'user' || message.role === 'assistant' || message.role === 'system') &&
        (typeof message.content === 'string' || message.image),
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message: any) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: typeof message.content === 'string' ? message.content.trim().slice(0, MAX_MESSAGE_CHARS) : '',
      image: message.image && typeof message.image.data === 'string' && typeof message.image.mimeType === 'string'
        ? {
            data: message.image.data.replace(/^data:[^;]+;base64,/, ''),
            mimeType: message.image.mimeType,
          }
        : undefined,
    }));
}

function serializeContext(contextData: unknown): string {
  if (!contextData) return 'No financial data is available yet.';

  try {
    const context = JSON.stringify(contextData, null, 2);
    return context.length > MAX_CONTEXT_CHARS ? `${context.slice(0, MAX_CONTEXT_CHARS)}…[truncated]` : context;
  } catch {
    return 'No financial data is available yet.';
  }
}

function createSystemInstruction(contextData?: unknown): string {
  const context = serializeContext(contextData);

  return `You are Spex — TrueSpend's premier intelligent financial AI assistant powered by Google Gemini. TrueSpend is an advanced personal finance operating system centered around true liquidity (Bank + Cash - Emergency Buffer = Spendable Wealth).

## CRITICAL OUTPUT REQUIREMENT
You MUST return ONLY a valid JSON object matching this exact schema:
{
  "reply": "markdown-formatted response string",
  "actions": [],
  "suggestions": ["suggested query 1", "suggested query 2", "suggested query 3"]
}
- "reply": Rich markdown string (use bolding, bullet points, numbered lists, emojis, clean line breaks).
- "actions": Array of concrete proposed mutations (empty [] if none).
- "suggestions": Exactly 3 engaging, highly relevant follow-up questions or actions the user can click next.

## PERSONALITY & TONE
Warm, sharp, direct, empathetic, and financially astute — like a trusted executive CFO and personal wealth advisor. Use tasteful emojis (💰 📊 🎯 ⚠️ 💡 ✅ 📈). Celebrate savings milestones, warn about impending deficits early, and offer actionable optimizations.

## CURRENCY CONVENTION
All monetary figures are in Moroccan Dirham (MAD). Always format amounts clearly with "MAD" (e.g., "450.00 MAD").

## FINANCIAL MONTH CYCLE (CRITICAL PRINCIPLE)
TrueSpend tracks time in FINANCIAL MONTHS, NOT standard calendar months. A financial cycle begins on the user's payday (e.g. 25th) and runs until the day prior to the next payday (e.g. 24th).
- Refer strictly to the active cycle as indicated in the live snapshot (e.g. "Cycle Aug 25 - Sep 24").
- Never confuse calendar months with financial cycles.
- When evaluating expenses, budgets, or burn rate, always scope calculations to the current financial period.

## FINANCIAL METRICS & CONCEPTS
1. **Total Liquidity**: (Bank Balance + Cash on Hand - Emergency Buffer). This is actual unencumbered cash.
2. **Daily Allowance**: Total remaining safe liquidity divided by days remaining until next payday.
3. **Daily Spent & Remaining**: Today's spend compared to today's calculated daily allowance.
4. **Runway**: How many days the current liquidity lasts at the user's current average variable burn rate.
5. **Safe to Invest**: Surplus liquid wealth beyond emergency buffer and upcoming committed cycle obligations.

## TRANSACTION & SPENDING INTELLIGENCE
When a user logs a transaction or asks to record spending:
- "bought / spent / paid for / ordered / ticket" → Expense
- "received / got paid / salary / bonus / deposit / client payment" → Income
- "transferred / moved money from bank to cash / withdrew cash" → Transfer (source wallet to destination wallet)
- "repaid / settled debt / paid back" → Debt Repayment
- "lent money / [friend] owes me" → Receivable debt
- "borrowed from / I owe [friend]" → Payable debt

## SMART CATEGORY MAPPING
Automatically infer the exact category name and emoji. Do NOT ask unless completely impossible to deduce:
- 🍔 Dining & Takeaway (restaurants, dinner, lunch, fast food, snacks)
- ☕ Coffee & Quick Food (cafes, Starbucks, pastries, breakfast)
- 🛒 Groceries (Carrefour, Marjane, Bim, supermarket, butcher, market)
- 🚗 Transportation (taxi, Careem, Uber, gas, fuel, parking, tram, train)
- 📱 Telecom & Subscriptions (Maroc Telecom, Inwi, Orange, Netflix, Spotify, cloud)
- 🩺 Health & Medical (pharmacy, doctor, dental, medicines, clinic)
- 👕 Personal & Clothing (Zara, clothes, shoes, haircut, grooming)
- 🎬 Entertainment (movies, games, outings, hobbies, events)
- 👥 Social (gatherings, friend gifts, rounds)
- 👨‍👩‍👦 Family & Gifts (family support, kids expenses, celebrations)
- 📚 Education & Development (courses, books, certifications, tuition)
- 🏠 Housing & Utilities (rent, electricity, water, home repairs)
- 💳 Debt & Obligations (loan repayments, installments)
- 💰 Savings & Goals (deposits to savings goals, emergency fund)
- 🚨 Unexpected (emergency repairs, unforeseen costs)
- 📥 Income (salary, freelance, dividends)
- 🔄 Transfer (internal wallet moves)

## SMART WALLET RESOLUTION
Look at the 'wallets' array in the live financial data snapshot:
- Pick the exact UUID of the appropriate wallet:
  - Online cards, banking apps, direct debits, salary deposits → Bank wallet (type "Bank")
  - Cash payments, cash on hand, street purchases → Cash wallet (type "Cash")
  - Savings deposits, long-term reserves → Savings wallet (type "Savings")
- For transfers: set 'walletId' to the source wallet ID and 'destinationWalletId' to the target wallet ID.

## PROPOSABLE ACTIONS IN "actions" ARRAY
When the user states an intent to log a transaction, set a budget, update a goal, or pay a debt:
Emit the structured action object inside the "actions" array so TrueSpend renders an interactive approval card:

1. **create_transaction**:
   {"type":"create_transaction","summary":"Add 120 MAD lunch in 🍔 Dining & Takeaway via Bank","parameters":{"amount":120,"type":"Expense","walletId":"<wallet-uuid>","category":"🍔 Dining & Takeaway","notes":"Lunch","transaction_date":"YYYY-MM-DD"}}
   (For transfers, include destinationWalletId: "<destination-wallet-uuid>")

2. **create_debt**:
   {"type":"create_debt","summary":"Record 500 MAD owed by Karim","parameters":{"amount":500,"contact":"Karim","type":"Receivable","due_date":"YYYY-MM-DD","notes":"Trip split"}}

3. **update_settings**:
   {"type":"update_settings","summary":"Update payday to 28th and salary to 15,000 MAD","parameters":{"payday":28,"salary":15000}}

4. **upsert_budget**:
   {"type":"upsert_budget","summary":"Set Groceries budget to 2,500 MAD","parameters":{"category":"🛒 Groceries","amount":2500,"year":2026,"month":9}}

5. **create_goal**:
   {"type":"create_goal","summary":"Create emergency car repair goal for 5,000 MAD","parameters":{"name":"Car Repair Fund","targetAmount":5000,"currentAmount":0,"walletId":"<wallet-uuid>","category":"Savings"}}

6. **contribute_goal**:
   {"type":"contribute_goal","summary":"Contribute 1,000 MAD to Japan Trip goal","parameters":{"goalId":"<goal-uuid>","amount":1000,"walletId":"<source-wallet-uuid>","destinationWalletId":"<savings-wallet-uuid>"}}

7. **settle_debt**:
   {"type":"settle_debt","summary":"Settle 300 MAD of debt to Omar","parameters":{"debtId":"<debt-uuid>","amount":300,"walletId":"<wallet-uuid>"}}

## BATCH ACTIONS & MULTI-EXPENSE PARSING
If the user mentions multiple transactions, expenses, or transfers in a single prompt (e.g. "Today I spent 120 on groceries, 35 on cafe, and transferred 500 to cash"):
- Propose an individual action in the "actions" array for EACH movement!
- TrueSpend UI allows 1-tap bulk approval of all proposed actions.

## FINANCIAL HEALTH AUDIT & DIAGNOSTIC MODE
When asked to "audit my finances", "rate my financial health", "run health checkup", or "how am I doing?":
- Provide a structured diagnostic with:
  1. Overall Rating (0-100) & Grade (A/B/C/D)
  2. Four key pillars: 🛡️ Liquidity Buffer • ⏳ Runway to Payday • 💳 Debt Burden • 🎯 Budget Adherence
  3. Top 2 specific money-saving or optimization actions for this active cycle.

## WHAT-IF & SCENARIO SIMULATION
If the user asks "Can I afford to buy X for 1,500 MAD?", "What if I purchase an iPhone this weekend?", or "How does this affect my runway?":
- DO NOT emit a create_transaction action (since it is hypothetical).
- Compute the real impact on Total Liquidity, Daily Allowance, and Runway days.
- Present a clear before/after comparison table:
  | Metric | Current | After | Impact |
- Provide a clear, transparent verdict (e.g. "Safe to spend", "Tightens your daily allowance from 240 MAD/day to 160 MAD/day", or "⚠️ Danger: Puts you below emergency buffer").

## LIVE FINANCIAL DATA SNAPSHOT
${context}`;
}

export async function generateSpeechFromText(rawText: string): Promise<{ audio: string; mimeType: string }> {
  const cleanText = rawText
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`.*?`/g, '')
    .replace(/[#*_~>]/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 1200);

  // Check in-memory cache first (0 quota cost on replays!)
  if (ttsCache.has(cleanText)) {
    return ttsCache.get(cleanText)!;
  }

  // Check if TTS model daily quota (10 calls/day) was exhausted
  if (isModelQuotaExhausted(MODEL_TTS)) {
    throw new Error('TTS quota limit reached for today. Falling back to browser speech synthesis.');
  }

  try {
    const response = await gemini.models.generateContent({
      model: MODEL_TTS,
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: cleanText || 'Here is your TrueSpend financial update.',
              speechMetadata: {
                style: 'Clear, reassuring, and professional financial executive advisor',
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('No audio generated by Gemini TTS');
    }

    const result = {
      audio: base64Audio,
      mimeType: 'audio/wav',
    };

    // Cache up to 60 audio clips
    if (ttsCache.size > 60) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cleanText, result);

    return result;
  } catch (err: any) {
    const isQuotaErr =
      err?.status === 429 ||
      String(err?.message || '').toLowerCase().includes('quota') ||
      String(err?.message || '').toLowerCase().includes('resource_exhausted');

    if (isQuotaErr) {
      markModelQuotaExhausted(MODEL_TTS, 1000 * 60 * 60 * 2); // 2 hours cooldown
    }
    throw err;
  }
}

export async function getChatCompletion(
  messages: unknown,
  contextData?: unknown,
  sessionId?: unknown,
  imageInput?: { data: string; mimeType: string },
  preferredModel?: string,
  allowFallback: boolean = true,
): Promise<{
  choices: Array<{ message: { content: string } }>;
  modelUsed: string;
  requestedModel?: string;
  responseTimeMs: number;
  quotaFallback?: boolean;
  fallbackReason?: string;
}> {
  const chatMessages = normalizeMessages(messages);
  if (!chatMessages.length && !imageInput) {
    throw new Error('At least one chat message or image is required');
  }

  const systemInstruction = createSystemInstruction(contextData);

  // Build the conversation contents for Gemini
  const contents: any[] = [];

  for (let i = 0; i < chatMessages.length; i++) {
    const msg = chatMessages[i];
    const isModel = msg.role === 'assistant';
    const isLast = i === chatMessages.length - 1;

    const parts: any[] = [];

    if (msg.image) {
      parts.push({
        inlineData: {
          mimeType: msg.image.mimeType,
          data: msg.image.data,
        },
      });
    } else if (isLast && !isModel && imageInput) {
      parts.push({
        inlineData: {
          mimeType: imageInput.mimeType,
          data: imageInput.data.replace(/^data:[^;]+;base64,/, ''),
        },
      });
    }

    if (msg.content) {
      parts.push({ text: msg.content });
    }

    contents.push({
      role: isModel ? 'model' : 'user',
      parts,
    });
  }

  if (!contents.length && imageInput) {
    contents.push({
      role: 'user',
      parts: [
        {
          inlineData: {
            mimeType: imageInput.mimeType,
            data: imageInput.data.replace(/^data:[^;]+;base64,/, ''),
          },
        },
        { text: 'Please analyze this receipt/document, extract the financial details, and propose a transaction action.' },
      ],
    });
  }

  // ── Smart & Manual Model Sequencing ──────────────────────────────────────
  const allModels = [MODEL_FLASH_DEEP, MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
  let modelsToTry: string[] = [];

  const isExplicitManual = Boolean(preferredModel && preferredModel !== 'auto');

  if (isExplicitManual) {
    // User explicitly chose a model manually
    if (allowFallback) {
      // Prioritize the requested model first; append others as fallback failovers
      const fallbacks = allModels.filter((m) => m !== preferredModel && !isModelQuotaExhausted(m));
      const exhaustedFallbacks = allModels.filter((m) => m !== preferredModel && isModelQuotaExhausted(m));
      modelsToTry = [preferredModel!, ...fallbacks, ...exhaustedFallbacks];
    } else {
      // Strict manual mode without fallback
      modelsToTry = [preferredModel!];
    }
  } else {
    // Smart Auto mode:
    // If Gemini 3.8 Flash is on cooldown, bypass directly to high-capacity 3.1 Flash Lite (500/day)
    if (isModelQuotaExhausted(MODEL_FLASH_DEEP)) {
      modelsToTry = [MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
    } else {
      modelsToTry = [MODEL_FLASH_DEEP, MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
    }
  }

  const startTime = Date.now();
  let lastError: any = null;
  let quotaFallbackHappened = false;
  let fallbackReason = '';

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await gemini.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.6,
        },
      });

      const responseText = response.text || '';
      let parsed: any;

      try {
        parsed = JSON.parse(responseText.trim());
      } catch (parseErr) {
        const first = responseText.indexOf('{');
        const last = responseText.lastIndexOf('}');
        if (first !== -1 && last > first) {
          parsed = JSON.parse(responseText.substring(first, last + 1));
        } else {
          parsed = {
            reply: responseText,
            actions: [],
            suggestions: ['What is my current liquidity?', 'How is my daily allowance?', 'Show my category breakdown'],
          };
        }
      }

      if (!parsed.reply) {
        parsed.reply = "I've analyzed your financial request. Let me know if you would like me to take any specific actions.";
      }
      if (!Array.isArray(parsed.actions)) {
        parsed.actions = [];
      }
      if (!Array.isArray(parsed.suggestions) || !parsed.suggestions.length) {
        parsed.suggestions = [
          'What is my safe-to-spend runway?',
          'Check my budget progress',
          'What are my biggest expenses this cycle?',
        ];
      }

      const isFallback =
        quotaFallbackHappened ||
        (isExplicitManual && model !== preferredModel) ||
        (!isExplicitManual && isModelQuotaExhausted(MODEL_FLASH_DEEP) && model !== MODEL_FLASH_DEEP);

      return {
        choices: [
          {
            message: {
              content: JSON.stringify(parsed),
            },
          },
        ],
        modelUsed: model,
        requestedModel: preferredModel || 'auto',
        responseTimeMs: Date.now() - startTime,
        quotaFallback: isFallback,
        fallbackReason: isFallback
          ? (fallbackReason || `Auto-routed to ${model} to maintain uptime and quota limits`)
          : undefined,
      };
    } catch (err: any) {
      console.warn(`[ChatService] Model ${model} returned error:`, err?.status || err?.message || err);

      const isQuotaExhausted =
        err?.status === 429 ||
        String(err?.message || '').toLowerCase().includes('quota') ||
        String(err?.message || '').toLowerCase().includes('resource_exhausted') ||
        String(err?.message || '').includes('rate limit');

      if (isQuotaExhausted) {
        markModelQuotaExhausted(model, 1000 * 60 * 30); // 30-min smart cooldown
        quotaFallbackHappened = true;
        fallbackReason = `Model ${model} reached rate/quota limit. Auto-switched to next model.`;
      } else if (err?.status === 503) {
        fallbackReason = `Model ${model} had high demand/overload (503). Auto-switched to next model.`;
      }

      lastError = err;
      // Continue to next model in sequence
    }
  }

  throw new Error(lastError?.message || 'Failed to communicate with Google Gemini AI service');
}
