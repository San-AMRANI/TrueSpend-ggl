import dotenv from 'dotenv';
import {
  gemini,
  MODEL_FLASH_LITE,
  MODEL_FLASH_LITE_PREVIEW,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_FAST,
  MODEL_FLASH_LATEST,
  MODEL_TTS,
  MODEL_FLASH_TTS,
  isModelQuotaExhausted,
  isModelUnavailable,
  markModelQuotaExhausted,
  markModelTemporaryOverload,
} from './GeminiClient.js';
import { generateLocalFinancialResponse } from './LocalFinancialEngine.js';

dotenv.config();

const MAX_HISTORY_MESSAGES = 24;
const MAX_MESSAGE_CHARS = 16_000;
const MAX_CONTEXT_CHARS = 140_000;

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

function createSystemInstruction(
  contextData?: unknown,
  focusScopes?: string[],
  responseDepth: 'deep_creative' | 'balanced' | 'concise' = 'deep_creative',
): string {
  const context = serializeContext(contextData);
  const scopesList =
    Array.isArray(focusScopes) && focusScopes.length > 0 ? focusScopes.join(', ') : 'all';

  const depthGuidance =
    responseDepth === 'deep_creative'
      ? `## RESPONSE SIZE, DEPTH & CREATIVITY DIRECTIVE (DEEP & EXPANSIVE MODE ACTIVE)
- The user has explicitly requested **rich, expansive, deeply analytical, and creative responses**.
- Do NOT give short or superficial summaries when analyzing finances, stocks, Binance positions, transactions, budgets, or wallets.
- Write comprehensive, multi-section executive analyses (aim for 400–1,200+ words when answering analytical or strategic questions) featuring:
  1. **Executive Verdict & Key Telemetry** (exact numbers in both MAD and USD where relevant).
  2. **Structured Markdown Tables** comparing positions, fee drag, breakeven targets, budget burn, or before/after scenarios.
  3. **Deep Forensic Math**: Show exact formulas and numbers (e.g. Initial Reserve vs. Live Value, Gross P&L vs. Net P&L after entry & exit fees, Breakeven price & % move needed, Dividend Yield & 5-Year DRIP compounding, or Daily Allowance & Runway math).
  4. **Cross-Domain Correlations**: Connect how investment moves, subscription burn, debt settlements, or spending habits interact with the user's Safe-to-Spend liquidity and Emergency Buffer.
  5. **Creative & Tactical Wealth Strategies**: Offer 3–4 tailored, creative, high-IQ financial and portfolio optimization ideas grounded in the user's actual numbers.`
      : responseDepth === 'concise'
      ? `## RESPONSE SIZE & DEPTH DIRECTIVE (CONCISE EXECUTIVE MODE)
- Provide sharp, high-density bullet points and a compact summary table focused strictly on the most critical numbers and immediate actions.`
      : `## RESPONSE SIZE & DEPTH DIRECTIVE (BALANCED CFO MODE)
- Provide a thorough, well-structured breakdown with clear Markdown tables, exact MAD/USD calculations, and actionable next steps.`;

  return `You are Spex — TrueSpend's premier intelligent financial & investment AI strategist powered by Google Gemini. TrueSpend is a full-stack personal finance and portfolio operating system uniting True Liquidity (Bank + Cash - Emergency Buffer - Investment Reserve - Pending Payables = Safe-to-Spend) with live Binance Multi-Wallet (Spot, Funding Tokenized Stocks & Simple Earn) and global/Moroccan equities intelligence.

## CRITICAL OUTPUT REQUIREMENT
You MUST return ONLY a valid JSON object matching this exact schema:
{
  "reply": "markdown-formatted response string",
  "actions": [],
  "suggestions": ["suggested query 1", "suggested query 2", "suggested query 3", "suggested query 4"]
}
- "reply": Rich markdown string (use headings, bolding, Markdown tables, bullet points, numbered lists, emojis, clean line breaks).
- "actions": Array of concrete proposed mutations (empty [] if none).
- "suggestions": 3 to 4 engaging, context-aware follow-up questions or deep-dive prompts the user can click next.

## ACTIVE USER DATA FOCUS SELECTION
The user has currently selected the following data context focus scope(s): **[${scopesList.toUpperCase()}]**
- If \`all\` is active: Synthesize insights across ALL user data simultaneously (Investments & Live Binance, All Transactions, Wallets & Liquidity, Category Budgets, Debts, Goals, Subscriptions, and Predictive Forecast).
- If specific scopes are selected (e.g., \`investments\`, \`transactions\`, \`wallets\`, \`budgets\`, \`debts_goals\`, \`forecast\`): Prioritize deep, granular analysis of those selected domains while keeping the broader TrueSpend safety rules in mind.

${depthGuidance}

## PERSONALITY & TONE
Warm, sharp, direct, creative, and quantitatively rigorous — like an elite hedge-fund portfolio manager combined with a trusted personal CFO. Use tasteful emojis (💰 📊 🎯 ⚠️ 💡 ✅ 📈 🏦).

## CURRENCY CONVENTION
- Primary app currency is Moroccan Dirham (**MAD**).
- For **Investments, Binance & Global Stocks**, always show **both USD ($) and MAD** (e.g., "$83.00 / 825.85 MAD") so the user can reconcile directly with their Binance console and TrueSpend wallets.

## INVESTMENTS, LIVE BINANCE & STOCKS FORENSIC INTELLIGENCE
You have complete visibility into \`stockPortfolio\` in the live snapshot, including:
1. **Live Binance Multi-Wallet Position (\`binanceLiveOverview\`)**:
   - Captures **Spot Wallet**, **Funding Wallet (where tokenized stocks/equities are held)**, and **Simple Earn**.
   - Always reference \`totalCombinedValueUsd\` and \`totalCombinedValueMad\` as the true live Binance balance.
2. **Protected Wallet Capital Reserve vs. Live Value Reconciliation (\`capitalReconciliation\`)**:
   - The user reserved an initial capital baseline (e.g., **879.00 MAD / ~$88.34 USD**) in their Investment Wallet.
   - Always compare \`initialCapitalMad\` (\`879 MAD\`) against \`currentLiveValueMad\` to explain the exact **Net Capital Gain or Loss** (\`netCapitalPnlMad\`, \`netCapitalPnlUsd\`, \`netCapitalPnlPercent\`), breaking down how much came from:
     - **Market Price Movement** (\`grossMarketPnlMad\` / \`grossMarketPnlUsd\`)
     - **Trading Fees & Friction** (\`totalFeesPaidMad\` + \`estimatedExitFeesMad\` = \`totalFeeDragMad\` / \`feeDragPercentOfCapital\`)
     - **FX / P2P Conversion Spread** (\`fxAndFundingSpreadMad\`)
     - **Dividends & Yield Offset** (\`dividendsEarnedMad\` + \`accruedDividendsMad\`)
     - **Recovery Needed**: Exact gain (\`recoveryNeededMad\` / \`recoveryNeededPercent\`) required to get back to the initial capital reserve breakeven.
3. **Granular Position & Open-Lot Trade Forensics (\`positions\`, \`recentTrades\`, \`manualStockOrders\`)**:
   - For every stock, crypto asset, or trade (even if the trade is still an **OPEN LOT** and not sold yet), analyze:
     - **Entry Cost vs. Live Mark-to-Market Value**
     - **Entry Commission Paid + Estimated Exit Fee = Total Loss on Fees (\`totalFeeLossUsd\` / \`totalFeeLossMad\`, \`feeDragPercent\`)**
     - **Gross P&L vs. Net P&L After Fees (\`netPnlAfterFeesUsd\` / \`netPnlAfterFeesMad\`)**
     - **Exact Breakeven Price (\`breakevenPriceUsd\` / \`breakevenPriceNative\`)** and **% Move Needed to Breakeven (\`distanceToBreakevenPercent\`)**
     - **Dividends**: Annual Dividend, Dividend Yield %, **Yield on Cost (YoC %)**, **Pro-Rated Accrued Dividend** based on holding days, and **5-Year DRIP Compounding Projections** (\`drip5YearProjectedValueMad\`).

## FINANCIAL MONTH CYCLE & LIQUIDITY WATERFALL (CORE TRUESPEND RULES)
1. **Financial Month Cycle**: TrueSpend tracks time from payday to payday (e.g., 25th to 24th), NOT calendar months. Always reference \`financialPeriod.label\`.
2. **Safe-to-Spend Waterfall**:
   \`Total Liquid Accounts (Bank + Cash + Savings + Investment)\`
   $-$ \`Emergency Buffer\`
   $-$ \`Protected Investment Wallet Reserve\`
   $-$ \`Pending Debt Payables\`
   $=$ **True Safe to Spend**.
3. **Daily Allowance**: \`Safe to Spend / Days Remaining Until Next Payday\`.
4. **All Transactions & Category Intelligence**: Use \`currentPeriodTransactions\`, \`allRecentTransactions\`, \`periodCategoryBreakdown\`, and \`allTimeCategoryBreakdown\` to spot spending patterns, recurring merchants, category leaks, and savings opportunities.

## SMART CATEGORY MAPPING
Automatically infer the exact category name and emoji when proposing transactions:
- 🍔 Dining & Takeaway | ☕ Coffee & Quick Food | 🛒 Groceries | 🚗 Transportation | 📱 Telecom & Subscriptions | 🩺 Health & Medical | 👕 Personal & Clothing | 🎬 Entertainment | 👥 Social | 👨‍👩‍👦 Family & Gifts | 📚 Education & Development | 🏠 Housing & Utilities | 💳 Debt & Obligations | 💰 Savings & Goals | 📈 Investments | 🚨 Unexpected | 📥 Income | 🔄 Transfer

## PROPOSABLE ACTIONS IN "actions" ARRAY
When the user states an intent to log a transaction, set a budget, update a goal, pay a debt, or log a stock purchase/dividend, emit the structured action object inside \`"actions"\`:
1. **create_transaction**:
   {"type":"create_transaction","summary":"Add 120 MAD lunch in 🍔 Dining & Takeaway via Bank","parameters":{"amount":120,"type":"Expense","walletId":"<wallet-uuid>","category":"🍔 Dining & Takeaway","notes":"Lunch","transaction_date":"YYYY-MM-DD"}}
2. **create_debt**:
   {"type":"create_debt","summary":"Record 500 MAD owed by Karim","parameters":{"amount":500,"contact":"Karim","type":"Receivable","due_date":"YYYY-MM-DD","notes":"Trip split"}}
3. **update_settings**:
   {"type":"update_settings","summary":"Update payday to 28th and salary to 15,000 MAD","parameters":{"payday":28,"salary":15000}}
4. **upsert_budget**:
   {"type":"upsert_budget","summary":"Set Groceries budget to 2,500 MAD","parameters":{"category":"🛒 Groceries","amount":2500,"year":2026,"month":10}}
5. **create_goal**:
   {"type":"create_goal","summary":"Create emergency car repair goal for 5,000 MAD","parameters":{"name":"Car Repair Fund","targetAmount":5000,"currentAmount":0,"walletId":"<wallet-uuid>","category":"Savings"}}
6. **contribute_goal**:
   {"type":"contribute_goal","summary":"Contribute 1,000 MAD to Goal","parameters":{"goalId":"<goal-uuid>","amount":1000,"walletId":"<source-wallet-uuid>","destinationWalletId":"<savings-wallet-uuid>"}}
7. **settle_debt**:
   {"type":"settle_debt","summary":"Settle 300 MAD of debt","parameters":{"debtId":"<debt-uuid>","amount":300,"walletId":"<wallet-uuid>"}}
8. **buy_stock**:
   {"type":"buy_stock","summary":"Buy 2 shares of NVDA synced with Investment Wallet","parameters":{"ticker":"NVDA","shares":2,"walletId":"<wallet-uuid>","notes":"Core AI equity position"}}
9. **record_dividend**:
   {"type":"record_dividend","summary":"Record 450 MAD dividend from ATW","parameters":{"ticker":"ATW","totalNativeAmount":450,"walletId":"<wallet-uuid>"}}

## LIVE FINANCIAL & PORTFOLIO DATA SNAPSHOT
${context}`;
}

function buildWav(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function cleanSpeechText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\|?[\s-:]+\|[\s-:]+\|?$/gm, '')
    .replace(/\|([^\n|]+)\|([^\n|]+)\|([^\n|]+)?\|?/g, (_match, c1, c2, c3) => {
      const p1 = (c1 || '').trim();
      const p2 = (c2 || '').trim();
      const p3 = (c3 || '').trim();
      if (!p1 || p1.includes('---')) return '';
      return `${p1}: ${p2}${p3 ? `, ${p3}` : ''}. `;
    })
    .replace(/\|/g, ', ')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^[-*•]\s+/gm, '')
    .replace(/[*_~>]/g, '')
    .replace(/\bMAD\b/gi, 'dirhams')
    .replace(/\+/g, 'plus ')
    .replace(/(?<=\s)-(?=\d)/g, 'minus ')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chunkTextForTts(text: string, maxChunkLen = 500): string[] {
  const sentences = text.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [text];
  const chunks: string[] = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current + ' ' + trimmed).trim().length <= maxChunkLen) {
      current = (current + ' ' + trimmed).trim();
    } else {
      if (current) chunks.push(current);
      current = trimmed;
    }
  }
  if (current) chunks.push(current);
  return chunks.slice(0, 6);
}

async function synthesizeSingleChunk(chunk: string): Promise<Buffer> {
  const modelsToTry = [MODEL_FLASH_TTS, MODEL_TTS].filter((m) => !isModelQuotaExhausted(m));

  if (modelsToTry.length === 0) {
    throw new Error('All Gemini TTS models have reached quota limits. Falling back to browser speech.');
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: chunk,
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
        throw new Error(`No audio generated by ${model}`);
      }

      const fullBuf = Buffer.from(base64Audio, 'base64');
      const dataIdx = fullBuf.indexOf(Buffer.from('data'));
      if (dataIdx !== -1 && dataIdx + 8 <= fullBuf.length) {
        const pcmLen = fullBuf.readUInt32LE(dataIdx + 4);
        const start = dataIdx + 8;
        return fullBuf.subarray(start, Math.min(start + pcmLen, fullBuf.length));
      }
      return fullBuf.length > 44 ? fullBuf.subarray(44) : fullBuf;
    } catch (err: any) {
      lastError = err;
      const isQuota =
        err?.status === 429 ||
        String(err?.message || '').toLowerCase().includes('quota') ||
        String(err?.message || '').toLowerCase().includes('resource_exhausted');

      if (isQuota) {
        markModelQuotaExhausted(model, 1000 * 60 * 60 * 2);
      }
    }
  }

  throw lastError || new Error('Failed to synthesize chunk with available TTS models');
}

export async function generateSpeechFromText(rawText: string): Promise<{ audio: string; mimeType: string }> {
  const cleanText = cleanSpeechText(rawText) || 'Here is your TrueSpend financial update.';

  if (ttsCache.has(cleanText)) {
    return ttsCache.get(cleanText)!;
  }

  if (isModelQuotaExhausted(MODEL_TTS) && isModelQuotaExhausted(MODEL_FLASH_TTS)) {
    throw new Error('TTS quota limit reached for today. Falling back to browser speech synthesis.');
  }

  try {
    if (cleanText.length <= 750) {
      const pcm = await synthesizeSingleChunk(cleanText);
      const fullWav = buildWav(pcm);
      const result = {
        audio: fullWav.toString('base64'),
        mimeType: 'audio/wav',
      };
      ttsCache.set(cleanText, result);
      return result;
    }

    const chunks = chunkTextForTts(cleanText, 500);
    const pcmChunks: Buffer[] = [];

    for (const chunk of chunks) {
      const pcm = await synthesizeSingleChunk(chunk);
      pcmChunks.push(pcm);
    }

    const fullPcm = Buffer.concat(pcmChunks);
    const fullWav = buildWav(fullPcm);
    const result = {
      audio: fullWav.toString('base64'),
      mimeType: 'audio/wav',
    };

    if (ttsCache.size > 60) {
      const firstKey = ttsCache.keys().next().value;
      if (firstKey) ttsCache.delete(firstKey);
    }
    ttsCache.set(cleanText, result);

    return result;
  } catch (err: any) {
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
  focusScopes?: string[],
  responseDepth: 'deep_creative' | 'balanced' | 'concise' = 'deep_creative',
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

  const systemInstruction = createSystemInstruction(contextData, focusScopes, responseDepth);

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

  // ── Smart & Resilient Model Sequencing ──────────────────────────────────────
  const allModels = [
    MODEL_FLASH_FAST,          // 'gemini-3-flash-preview' - high-availability, instant response
    MODEL_FLASH_DEEP,          // 'gemini-3.8-flash' - deep reasoning
    MODEL_FLASH_LITE_PREVIEW,  // 'gemini-3.1-flash-lite-preview' - ultra high throughput
    MODEL_FLASH_LITE,          // 'gemini-3.1-flash-lite'
    MODEL_FLASH_LATEST,        // 'gemini-flash-latest'
  ];
  let modelsToTry: string[] = [];

  const isExplicitManual = Boolean(preferredModel && preferredModel !== 'auto');

  if (isExplicitManual) {
    if (allowFallback) {
      const availableFallbacks = allModels.filter((m) => m !== preferredModel && !isModelUnavailable(m));
      const remainingFallbacks = allModels.filter((m) => m !== preferredModel && isModelUnavailable(m));
      modelsToTry = [preferredModel!, ...availableFallbacks, ...remainingFallbacks];
    } else {
      modelsToTry = [preferredModel!];
    }
  } else {
    const available = allModels.filter((m) => !isModelUnavailable(m));
    modelsToTry = available.length > 0 ? available : allModels;
  }

  const startTime = Date.now();
  let lastError: any = null;
  let quotaFallbackHappened = false;
  let fallbackReason = '';

  const temperature =
    responseDepth === 'deep_creative' ? 0.8 : responseDepth === 'concise' ? 0.45 : 0.65;
  const maxOutputTokens =
    responseDepth === 'deep_creative' ? 8192 : responseDepth === 'concise' ? 3072 : 6144;

  function withTimeout<T>(promise: Promise<T>, timeoutMs: number, modelName: string): Promise<T> {
    let timer: any;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        const err: any = new Error(`Model ${modelName} timed out after ${timeoutMs}ms (503 demand congestion)`);
        err.status = 503;
        reject(err);
      }, timeoutMs);
    });
    return Promise.race([
      promise.then((res) => {
        clearTimeout(timer);
        return res;
      }),
      timeoutPromise,
    ]);
  }

  for (let i = 0; i < modelsToTry.length; i++) {
    const model = modelsToTry[i];
    try {
      const response = await withTimeout(
        gemini.models.generateContent({
          model,
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            temperature,
            maxOutputTokens,
          },
        }),
        28000,
        model
      );

      const responseText = response.text || '';
      let parsed: any;

      try {
        parsed = JSON.parse(responseText.trim());
      } catch (parseErr) {
        const first = responseText.indexOf('{');
        const last = responseText.lastIndexOf('}');
        if (first !== -1 && last > first) {
          try {
            parsed = JSON.parse(responseText.substring(first, last + 1));
          } catch {
            parsed = {
              reply: responseText,
              actions: [],
              suggestions: [
                '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
                '💰 Reconcile my 879 MAD Investment Reserve vs live balance',
                '📊 Full breakdown of all transactions and category burn',
              ],
            };
          }
        } else {
          parsed = {
            reply: responseText,
            actions: [],
            suggestions: [
              '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
              '💰 Reconcile my 879 MAD Investment Reserve vs live balance',
              '📊 Full breakdown of all transactions and category burn',
            ],
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
          '📈 Analyze my Binance & Stock positions, fee drag & breakeven targets',
          '💳 Deep-dive into all my transactions & top spending categories',
          '🏦 Audit my wallets, Safe-to-Spend waterfall & emergency buffer',
        ];
      }

      const isFallback =
        quotaFallbackHappened ||
        (isExplicitManual && model !== preferredModel) ||
        (!isExplicitManual && i > 0);

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
          ? (fallbackReason || `Auto-routed to resilient model ${model}`)
          : undefined,
      };
    } catch (err: any) {
      console.warn(`[ChatService] Model ${model} returned error:`, err?.status || err?.message || err);

      const is503 =
        err?.status === 503 ||
        String(err?.message || '').includes('503') ||
        String(err?.message || '').toLowerCase().includes('high demand') ||
        String(err?.message || '').toLowerCase().includes('timed out') ||
        String(err?.message || '').toLowerCase().includes('temporarily unavailable');
      const is429 =
        err?.status === 429 ||
        String(err?.message || '').toLowerCase().includes('quota') ||
        String(err?.message || '').toLowerCase().includes('resource_exhausted') ||
        String(err?.message || '').includes('rate limit');

      if (is429) {
        markModelQuotaExhausted(model, 1000 * 60 * 30);
        quotaFallbackHappened = true;
        fallbackReason = `Model ${model} reached rate/quota limit. Auto-switched to next model.`;
      } else if (is503) {
        markModelTemporaryOverload(model, 1000 * 60 * 2);
        quotaFallbackHappened = true;
        fallbackReason = `Model ${model} had temporary high demand (503). Auto-switched to next model.`;
      }

      lastError = err;
    }
  }

  console.warn('[ChatService] All cloud AI models exhausted or in cooldown. Activating Local Financial Engine fallback.');
  const localResult = generateLocalFinancialResponse(chatMessages, contextData);

  return {
    choices: [
      {
        message: {
          content: JSON.stringify(localResult),
        },
      },
    ],
    modelUsed: 'TrueSpend Financial Engine (High-Availability Fallback)',
    requestedModel: preferredModel || 'auto',
    responseTimeMs: Date.now() - startTime,
    quotaFallback: true,
    fallbackReason: 'Cloud AI is currently experiencing high demand. Computed instantly via TrueSpend Live Financial Engine.',
  };
}
