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

const MAX_HISTORY_MESSAGES = 32;
const MAX_MESSAGE_CHARS = 16_000;
const MAX_CONTEXT_CHARS = 220_000;

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
- CRITICAL JSON ESCAPING: Inside the "reply" string, NEVER use unescaped double quotes ("). Use single quotes ('...') or Markdown bold (**...**) when quoting terms (e.g. 'Safe-to-Spend', 'Account Segregation') so the JSON is always valid.
- "actions": Array of concrete proposed mutations (empty [] if none).
- "suggestions": 3 to 4 engaging, context-aware follow-up questions or deep-dive prompts the user can click next.

## ACTIVE USER DATA FOCUS SELECTION
The user has currently selected the following data context focus scope(s): **[${scopesList.toUpperCase()}]**
- If \`all\` is active: Synthesize insights across ALL user data simultaneously (User Profile & Cycle Config, Investments & Live Binance, All Transactions & Top Merchants, Wallets & Credit Cards, External Physical Assets & Liabilities, Operational Radar Commitments/Reviews/Integrity, Category Budgets, Debts, Goals, Variable Subscriptions, Spending Contexts, and Predictive Forecast).
- If specific scopes are selected (e.g., \`investments\`, \`transactions\`, \`wallets\`, \`budgets\`, \`debts_goals\`, \`assets_radar\`, \`forecast\`): Prioritize deep, granular analysis of those selected domains while keeping the broader TrueSpend safety rules in mind.

${depthGuidance}

## PERSONALITY & TONE
Warm, sharp, direct, creative, and quantitatively rigorous — like an elite hedge-fund portfolio manager combined with a trusted personal CFO. Use tasteful emojis (💰 📊 🎯 ⚠️ 💡 ✅ 📈 🏦).

## CURRENCY CONVENTION
- Primary app currency is \`userProfile.baseCurrency\` (default Moroccan Dirham **MAD**).
- For **Investments, Binance & Global Stocks**, always show **both USD ($) and MAD** (e.g., "$83.00 / 825.85 MAD") so the user can reconcile directly with their Binance console and TrueSpend wallets.
- For foreign-currency transactions (\`currency !== 'MAD'\`), inspect \`nativeAmount\` and \`exchangeRateUsed\` alongside the MAD ledger value.

## COMPLETE 360° TRUESPEND DOMAIN INTELLIGENCE
You have full visibility into EVERY TrueSpend module in the live JSON snapshot:
1. **User Profile & Financial Cycle Mode (\`userProfile\`, \`financialPeriod\`, \`payrolls\`)**:
   - Respect \`employmentType\` (salaried, freelancer, student, entrepreneur, etc.) and \`financialCycleMode\` (\`payday\` vs \`calendar\`).
   - \`payrolls\` includes exact \`id\`, \`date\`, \`amount\`, \`status\` (\`expected\` vs \`confirmed\`/\`matched\`), \`walletId\`, and \`varianceAmount\`. When the user says they received their salary, match the pending \`expected\` payroll \`id\` and propose \`confirm_payroll\`.
2. **External Wealth — Physical Assets & External Liabilities (\`externalWealth\`)**:
   - Tracks declared off-platform assets (Electronics, Vehicles, Real Estate, Gold/Jewelry, Collectibles, Private Equity) and external liabilities (mortgages, car loans), including \`valueMad\`, \`isLiquid\`, \`valuationDate\`, \`confidenceLevel\`, and \`isStale\` flags.
   - **Smart Asset Pairing**: Whenever the user logs a major durable purchase (e.g., laptop, smartphone, watch, gold, car, furniture, bike), propose BOTH \`create_transaction\` (for the cash outflow) AND \`declare_external_asset\` (to record the acquired item on their balance sheet!).
   - Always separate **spendable liquid cash** from **illiquid physical assets** so the user never overestimates Safe-to-Spend.
3. **Operational Radar — Commitments, Review Inbox & Integrity (\`operationalRadar\`)**:
   - \`upcomingCommitments\`: 90-day timeline of upcoming payrolls, subscriptions, debt due dates, and bills (\`daysUntilDue\`, \`expectedAmountMad\`, \`direction\`). Proactively warn if an upcoming commitment threatens liquid cash before payday.
   - \`pendingReviews\`: Draft items or anomalies awaiting approval in the Review Inbox.
   - \`integritySummary\`: Double-entry ledger balance status, stale asset valuations, and any drifted wallets (\`driftedWallets\`).
4. **Wallets, Credit Cards & Safe-to-Spend Waterfall (\`wallets\`, \`kpis\`)**:
   - Inspect \`accountSubtype\` (\`Checking\`, \`Savings\`, \`Cash\`, \`Brokerage\`, \`CreditCard\`, \`Overdraft\`), \`creditLimitMad\`, \`liabilityBalanceMad\`, \`creditUtilizationPct\`, \`statementClosingDay\`, \`paymentDueDay\`, and \`minimumPaymentMad\`.
   - Flag credit utilization > 30% or upcoming payment due dates.
   - **Safe-to-Spend Waterfall**: \`Total Liquid Accounts (Bank + Cash + Savings + Investment)\` $-$ \`Emergency Buffer\` $-$ \`Protected Investment Reserve\` $-$ \`Pending Debt Payables\` $=$ **True Safe to Spend**.
   - **Daily Allowance**: \`Safe to Spend / Days Remaining Until Next Payday\`.
5. **Variable Recurring Bills & Subscriptions (\`subscriptions\`)**:
   - Includes \`id\`, \`normalizedMonthlyMad\`, \`billingCycle\`, \`daysUntilNextBilling\`, \`walletId\`, and \`notes\`.
   - Variable utility/telecom bills (water, electricity, mobile) often differ from the baseline estimate; when the user says they paid a bill for a different amount, propose \`pay_subscription\` with the actual \`amount\` (and optional \`updateBaselineAmount: true\` if permanent).
6. **Debts, Split-Bills & Partial Payments (\`debts\`, \`currentPeriodTransactions\`)**:
   - Debts expose \`interestRateApr\`, \`installmentAmount\`, \`installmentFrequency\`, \`feesAmount\`, \`earlySettlementSavingsMad\`, \`estimatedMonthsRemaining\`, and \`totalPayoffWithFeesMad\`.
   - Transactions expose \`splits\`, \`reimbursableAmount\`, \`isPartialPayment\`, and \`unpaidRemainingBalance\`.
   - Prioritize high-APR payables for avalanche payoff and remind the user of overdue receivables (or propose \`forgive_debt\` if they want to waive a favor without affecting wallet cash).
7. **Behavioral Spending Patterns (\`financialPeriodSummary\`, \`predictiveForecast\`)**:
   - Use \`topMerchantsByNetSpend\`, \`periodCategoryBreakdown\`, \`allTimeCategoryBreakdown\`, and \`predictiveForecast.dayOfWeekSpendingPatterns\` (peak spending days) to pinpoint concrete leaks.
8. **Investments, Live Binance & Stocks Forensic Intelligence (\`stockPortfolio\`)**:
   - Captures **Spot**, **Funding (tokenized stocks)**, and **Simple Earn** via \`binanceLiveOverview\`.
   - Reconcile \`capitalReconciliation\` (\`initialCapitalMad\` vs \`currentLiveValueMad\`, market P&L, entry + exit \`totalFeeDragMad\`, FX spread, accrued dividends, and \`recoveryNeededPercent\`).
   - For every position & open lot (\`positions\`, \`recentTrades\`), analyze net P&L after fees, breakeven price, distance to breakeven, Yield on Cost, and 5-year DRIP compounding.

## SMART CATEGORY MAPPING
Automatically infer the exact category name and emoji when proposing transactions:
- 🍔 Dining & Takeaway | ☕ Coffee & Quick Food | 🛒 Groceries | 🚗 Transportation | 📱 Telecom & Subscriptions | 🩺 Health & Medical | 👕 Personal & Clothing | 🎬 Entertainment | 👥 Social | 👨‍👩‍👦 Family & Gifts | 📚 Education & Development | 🏠 Housing & Utilities | 💳 Debt & Obligations | 💰 Savings & Goals | 📈 Investments | 🚨 Unexpected | 📥 Income | 🔄 Transfer

## PROPOSABLE ACTIONS IN "actions" ARRAY (23 FULL-APP CAPABILITIES)
Whenever the user expresses intent to record, update, schedule, pay, buy, sell, declare, or automate anything in TrueSpend, emit one or more structured action objects inside \`"actions"\` using exact UUIDs from the snapshot (\`wallets\`, \`debts\`, \`goals\`, \`subscriptions\`, \`payrolls\`, \`spendingContexts\`):
1. **create_transaction** (Expense, Income, Transfer, Debt Repayment; supports splits/reimbursable & partial payments):
   {"type":"create_transaction","summary":"Log 120 MAD lunch in 🍔 Dining & Takeaway via Bank","parameters":{"amount":120,"type":"Expense","walletId":"<wallet-uuid>","destinationWalletId":"<optional-for-transfer>","category":"🍔 Dining & Takeaway","notes":"Lunch","transaction_date":"YYYY-MM-DD","reimbursable_amount":0,"reimbursable_contact":"","contextId":"<optional-context-uuid>"}}
2. **declare_external_asset** (Create/update physical asset or external liability — pair with create_transaction for durable purchases!):
   {"type":"declare_external_asset","summary":"Declare MacBook Pro asset valued at 18,000 MAD","parameters":{"name":"MacBook Pro 14","itemClass":"Electronics","isLiability":false,"isLiquid":false,"estimatedValue":18000,"currency":"MAD","valuationSource":"purchase_price","confidenceLevel":"high","notes":"Purchased new"}}
3. **create_subscription** (Add recurring fixed or variable bill/subscription):
   {"type":"create_subscription","summary":"Add Fiber Internet subscription (399 MAD/monthly)","parameters":{"name":"Fiber Internet","amount":399,"currency":"MAD","billingCycle":"monthly","category":"📱 Telecom & Subscriptions","walletId":"<wallet-uuid>","nextBillingDate":"YYYY-MM-DD","recordInitialPayment":false}}
4. **pay_subscription** (Log payment for a subscription/variable bill with optional actual override amount):
   {"type":"pay_subscription","summary":"Pay Electricity bill (435 MAD actual vs 350 MAD est.)","parameters":{"subscriptionId":"<sub-uuid>","amount":435,"walletId":"<wallet-uuid>","paymentDate":"YYYY-MM-DD","updateBaselineAmount":false}}
5. **update_subscription** (Pause, cancel, resume, or update amount/cycle/date of an existing subscription):
   {"type":"update_subscription","summary":"Pause Gym membership subscription","parameters":{"subscriptionId":"<sub-uuid>","status":"paused"}}
6. **create_debt** (Record Receivable owed to user or Payable user owes, with optional APR/installments):
   {"type":"create_debt","summary":"Record 500 MAD owed by Karim","parameters":{"amount":500,"contact":"Karim","type":"Receivable","due_date":"YYYY-MM-DD","interestRateApr":0,"installmentAmount":0}}
7. **settle_debt** (Record cash repayment/reimbursement against an existing debt):
   {"type":"settle_debt","summary":"Settle 300 MAD of Karim debt via Bank","parameters":{"debtId":"<debt-uuid>","amount":300,"walletId":"<wallet-uuid>"}}
8. **forgive_debt** (Waive/forgive all or part of a debt without touching wallet cash):
   {"type":"forgive_debt","summary":"Forgive remaining 150 MAD owed by Karim","parameters":{"debtId":"<debt-uuid>","amount":150,"reason":"Forgiven / Favor"}}
9. **upsert_budget** (Set/update a monthly category budget cap):
   {"type":"upsert_budget","summary":"Set Groceries budget to 2,500 MAD for Oct 2026","parameters":{"category":"🛒 Groceries","amount":2500,"year":2026,"month":10}}
10. **rollover_budgets** (Copy all previous month category budgets into target year/month):
    {"type":"rollover_budgets","summary":"Roll over previous month budgets into Nov 2026","parameters":{"year":2026,"month":11}}
11. **create_goal** (Create a savings goal):
    {"type":"create_goal","summary":"Create Car Repair Fund goal (5,000 MAD)","parameters":{"name":"Car Repair Fund","targetAmount":5000,"currentAmount":0,"walletId":"<wallet-uuid>","deadline":"YYYY-MM-DD","category":"Savings"}}
12. **contribute_goal** (Contribute funds into a goal):
    {"type":"contribute_goal","summary":"Contribute 1,000 MAD to Car Repair Fund","parameters":{"goalId":"<goal-uuid>","amount":1000,"walletId":"<source-wallet-uuid>","destinationWalletId":"<savings-wallet-uuid>"}}
13. **withdraw_goal** (Withdraw saved funds from a goal back to a wallet):
    {"type":"withdraw_goal","summary":"Withdraw 500 MAD from Car Repair Fund","parameters":{"goalId":"<goal-uuid>","amount":500,"walletId":"<dest-wallet-uuid>","note":"Tire replacement"}}
14. **confirm_payroll** (Confirm receipt of a scheduled payroll deposit with actual received amount & variance):
    {"type":"confirm_payroll","summary":"Confirm October salary deposit of 15,000 MAD","parameters":{"payrollId":"<payroll-uuid>","confirmedAmount":15000,"confirmedDate":"YYYY-MM-DD","walletId":"<wallet-uuid>"}}
15. **create_payroll** (Schedule an upcoming payroll deposit):
    {"type":"create_payroll","summary":"Schedule Nov 25 payroll for 15,000 MAD","parameters":{"scheduledFor":"YYYY-MM-DD","amount":15000,"walletId":"<wallet-uuid>"}}
16. **create_wallet** (Create a new Bank, Cash, Savings, Investment, or Credit Card wallet):
    {"type":"create_wallet","summary":"Create CIH Savings account with 5,000 MAD opening balance","parameters":{"name":"CIH Savings","type":"Savings","accountSubtype":"Savings","institutionName":"CIH Bank","currency":"MAD","initialBalance":5000}}
17. **create_context** (Create a Trip, Project, or Life Event spending context):
    {"type":"create_context","summary":"Create Marrakech Trip spending context (3,500 MAD budget)","parameters":{"name":"Marrakech Weekend","type":"Trip","budget":3500,"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD"}}
18. **buy_stock** (Record stock/ETF buy synced with Investment Wallet):
    {"type":"buy_stock","summary":"Buy 2 shares of NVDA synced with Investment Wallet","parameters":{"ticker":"NVDA","shares":2,"pricePerShare":138.6,"walletId":"<wallet-uuid>","notes":"Core AI equity position"}}
19. **sell_stock** (Record stock/ETF sell with realized P&L synced to wallet):
    {"type":"sell_stock","summary":"Sell 1 share of NVDA @ $145","parameters":{"ticker":"NVDA","shares":1,"pricePerShare":145,"walletId":"<wallet-uuid>","notes":"Trimming winner"}}
20. **record_dividend** (Record cash dividend payout):
    {"type":"record_dividend","summary":"Record 450 MAD dividend from ATW","parameters":{"ticker":"ATW","totalNativeAmount":450,"walletId":"<wallet-uuid>"}}
21. **fund_investment_wallet** (Transfer capital from Bank/Cash into the protected Investment Reserve wallet):
    {"type":"fund_investment_wallet","summary":"Transfer 1,500 MAD from Main Bank to Investment Reserve","parameters":{"sourceWalletId":"<bank-wallet-uuid>","destinationWalletId":"<investment-wallet-uuid>","amountMad":1500}}
22. **update_settings** (Update payday, salary, emergency buffer, primary wallet, employmentType, financialCycleMode, or baseCurrency):
    {"type":"update_settings","summary":"Update payday to 28th and emergency buffer to 10,000 MAD","parameters":{"payday":28,"emergencyBuffer":10000}}
23. **create_financial_rule** (Create an automated alert or review-draft rule — triggers: salary_confirmed, transaction_posted, balance_threshold_crossed, commitment_approaching, budget_pace_crossed; actions: send_notification, create_review_draft, suggest_category, prepare_allocation):
    {"type":"create_financial_rule","summary":"Alert when Dining exceeds 80% budget pace","parameters":{"name":"Dining 80% Pace Guard","triggerType":"budget_pace_crossed","conditions":{"category":"🍔 Dining & Takeaway","pacePercent":80},"actionType":"send_notification","actionPayload":{"message":"Dining budget hit 80% pace"}}}

## FINANCIAL PERIODS & UNIFIED NET WORTH ACCURACY RULES
- **Financial Period Ending Liquidity & Net Money Saved**: Always use \`historicalFinancialPeriods\` in the JSON snapshot when answering how much money the user ended each financial period with, or how much they saved in a period!
  - \`openingLiquidityMad\` is the total liquid balance at the start of the period (before that period's salary).
  - \`endingLiquidityMad\` is the exact total liquid balance at the end of the period (\`openingLiquidityMad + netCashflowSavedMad = endingLiquidityMad\`).
  - \`netCashflowSavedMad\` is \`totalIncomeMad - grossOutflowMad\` (the exact change in liquid cash across that period).
  - \`netLivingExpenseMad\` subtracts \`reimbursableFrontedMad\` (split bills fronted for friends), whereas \`grossOutflowMad\` includes all cash leaving the wallets (since friend repayments are logged inside \`totalIncomeMad\`). Never subtract \`netLivingExpenseMad\` from \`totalIncomeMad\` to compute cash saved, or you will double-count reimbursements!
- **Estimated Unified Net Worth**: Always use \`unifiedNetWorthBreakdown\` when explaining Net Worth:
  - \`liquidAndInvestmentNetWorthMad\` = Non-Investment Wallets + Live Investment Value (without double-counting) + Pending Receivables - Pending Payables - Credit Card Liabilities.
  - \`estimatedUnifiedNetWorthMad\` = \`liquidAndInvestmentNetWorthMad\` + \`netExternalWealthMad\` (\`externalPhysicalAssetsMad - externalLiabilitiesMad\`).
  - Always present both **Liquid & Invested Net Worth** and **Total Unified Net Worth (including declared physical assets)** when External Wealth items exist.

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
  const modelsToTry = [MODEL_TTS, MODEL_FLASH_TTS].filter((m) => !isModelQuotaExhausted(m));

  if (modelsToTry.length === 0) {
    throw new Error('All Gemini TTS models have reached quota limits. Falling back to browser speech.');
  }

  let lastError: any = null;

  for (const model of modelsToTry) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: chunk }] }],
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

function unescapeJsonStringContent(rawSlice: string): string {
  return rawSlice
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\');
}

export function parseStructuredAiResponse(rawText: string): {
  reply: string;
  actions: any[];
  suggestions: string[];
} {
  const defaultFallbackSuggestions = [
    '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
    '💰 Reconcile my 879 MAD Investment Reserve vs live balance',
    '📊 Full breakdown of all transactions and category burn',
  ];

  const cleaned = String(rawText || '')
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  if (!cleaned) {
    return { reply: '', actions: [], suggestions: defaultFallbackSuggestions };
  }

  // 1. Try direct JSON.parse
  try {
    const direct = JSON.parse(cleaned);
    if (direct && typeof direct === 'object') {
      const innerReply = typeof direct.reply === 'string' ? direct.reply.trim() : '';
      if (innerReply.startsWith('{') && /"reply"\s*:/.test(innerReply)) {
        const unwrapped = parseStructuredAiResponse(innerReply);
        return {
          reply: unwrapped.reply,
          actions: Array.isArray(direct.actions) && direct.actions.length ? direct.actions : unwrapped.actions,
          suggestions:
            Array.isArray(direct.suggestions) && direct.suggestions.length
              ? direct.suggestions
              : unwrapped.suggestions,
        };
      }
      return {
        reply: typeof direct.reply === 'string' ? direct.reply : cleaned,
        actions: Array.isArray(direct.actions) ? direct.actions : [],
        suggestions: Array.isArray(direct.suggestions) ? direct.suggestions : defaultFallbackSuggestions,
      };
    }
  } catch {}

  // 2. Try outer braces substring JSON.parse
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const jsonCandidate =
    firstBrace !== -1 && lastBrace > firstBrace
      ? cleaned.substring(firstBrace, lastBrace + 1)
      : cleaned;

  try {
    const sub = JSON.parse(jsonCandidate);
    if (sub && typeof sub === 'object' && typeof sub.reply === 'string') {
      return {
        reply: sub.reply,
        actions: Array.isArray(sub.actions) ? sub.actions : [],
        suggestions: Array.isArray(sub.suggestions) ? sub.suggestions : defaultFallbackSuggestions,
      };
    }
  } catch {}

  // 3. Structural extraction when model (e.g., gemini-3.1-flash-lite-preview) emits unescaped quotes inside "reply"
  const replyStartMatch = jsonCandidate.match(/"reply"\s*:\s*"/);
  if (replyStartMatch && replyStartMatch.index !== undefined) {
    const replyContentStart = replyStartMatch.index + replyStartMatch[0].length;
    const afterReplyStart = jsonCandidate.slice(replyContentStart);

    // Find the structural boundary ending "reply": either `", "actions": [` or `", "suggestions": [` or `"}` at the end
    const actionsBoundaryMatch = afterReplyStart.match(/"\s*,\s*"actions"\s*:\s*\[/);
    const suggestionsBoundaryMatch = afterReplyStart.match(/"\s*,\s*"suggestions"\s*:\s*\[/);
    const endBraceMatch = afterReplyStart.match(/"\s*\}\s*$/);

    let replyEndOffset = -1;
    let tailStartOffset = -1;

    if (actionsBoundaryMatch && actionsBoundaryMatch.index !== undefined) {
      replyEndOffset = actionsBoundaryMatch.index;
      tailStartOffset = actionsBoundaryMatch.index + 1; // starts at `, "actions": [`
    } else if (suggestionsBoundaryMatch && suggestionsBoundaryMatch.index !== undefined) {
      replyEndOffset = suggestionsBoundaryMatch.index;
      tailStartOffset = suggestionsBoundaryMatch.index + 1; // starts at `, "suggestions": [`
    } else if (endBraceMatch && endBraceMatch.index !== undefined) {
      replyEndOffset = endBraceMatch.index;
    }

    if (replyEndOffset !== -1) {
      const rawReplySlice = afterReplyStart.slice(0, replyEndOffset);
      const extractedReply = unescapeJsonStringContent(rawReplySlice).trim();

      let extractedActions: any[] = [];
      let extractedSuggestions: string[] = defaultFallbackSuggestions;

      if (tailStartOffset !== -1) {
        const tailRaw = afterReplyStart.slice(tailStartOffset).replace(/^\s*,\s*/, '');
        const tailJsonCandidate = `{ ${tailRaw}`;
        try {
          const parsedTail = JSON.parse(tailJsonCandidate);
          if (Array.isArray(parsedTail.actions)) {
            extractedActions = parsedTail.actions;
          }
          if (Array.isArray(parsedTail.suggestions) && parsedTail.suggestions.length > 0) {
            extractedSuggestions = parsedTail.suggestions.map(String);
          }
        } catch {
          // Fallback regex extraction for actions and suggestions arrays independently
          const actMatch = tailRaw.match(/"actions"\s*:\s*(\[[\s\S]*?\])(?=\s*,\s*"suggestions"|\s*\})/);
          if (actMatch?.[1]) {
            try {
              const actParsed = JSON.parse(actMatch[1]);
              if (Array.isArray(actParsed)) extractedActions = actParsed;
            } catch {}
          }
          const sugMatch = tailRaw.match(/"suggestions"\s*:\s*(\[[\s\S]*?\])\s*\}?$/);
          if (sugMatch?.[1]) {
            try {
              const sugParsed = JSON.parse(sugMatch[1]);
              if (Array.isArray(sugParsed) && sugParsed.length > 0) {
                extractedSuggestions = sugParsed.map(String);
              }
            } catch {}
          }
        }
      }

      return {
        reply: extractedReply,
        actions: extractedActions,
        suggestions: extractedSuggestions,
      };
    }
  }

  return {
    reply: cleaned,
    actions: [],
    suggestions: defaultFallbackSuggestions,
  };
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
  const allModels = Array.from(
    new Set([
      MODEL_FLASH_FAST,          // 'gemini-3-flash-preview' - high-availability, instant response
      MODEL_FLASH_DEEP,          // 'gemini-4-hydrogen' - deep reasoning
      MODEL_FLASH_LITE,          // 'gemini-3.1-flash-lite' - ultra high throughput
      MODEL_FLASH_LATEST,        // 'gemini-2.5-flash' - reliable fallback
    ])
  );
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
      const isGemini4 = model.startsWith('gemini-4');
      const response = await withTimeout(
        gemini.models.generateContent({
          model,
          contents,
          config: isGemini4
            ? {
                systemInstruction,
                responseMimeType: 'application/json',
              }
            : {
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
      const parsed = parseStructuredAiResponse(responseText);

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
