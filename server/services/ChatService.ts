import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const WORKING_MODEL_CACHE_FILE = path.join(process.cwd(), '.last_working_model');

function getLastWorkingModel(): string | null {
  try {
    if (fs.existsSync(WORKING_MODEL_CACHE_FILE)) {
      const model = fs.readFileSync(WORKING_MODEL_CACHE_FILE, 'utf-8').trim();
      if (model) return model;
    }
  } catch (error) {
    console.error('Failed to read working model cache:', error);
  }
  return null;
}

function setLastWorkingModel(modelId: string) {
  try {
    fs.writeFileSync(WORKING_MODEL_CACHE_FILE, modelId, 'utf-8');
  } catch (error) {
    console.error('Failed to write working model cache:', error);
  }
}

let cachedFreeModels: string[] = [];
let currentModelIndex = 0;
let lastModelFetch = 0;
const CACHE_TTL = 1000 * 60 * 60 * 12; // 12 hours

export async function getFreeModels(): Promise<string[]> {
  const now = Date.now();
  if (cachedFreeModels.length > 0 && (now - lastModelFetch < CACHE_TTL)) {
    return cachedFreeModels;
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/models');
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter for free models. Pricing prompt and completion are "0" or 0.
    const freeModels = data.data
      .filter((model: any) => {
        const pricing = model.pricing;
        const isFree = pricing && (pricing.prompt === '0' || pricing.prompt === 0) && (pricing.completion === '0' || pricing.completion === 0);
        return isFree && model.id !== 'openrouter/free' && model.id !== 'openrouter/auto';
      })
      .map((model: any) => model.id);
      
    if (freeModels.length > 0) {
      cachedFreeModels = freeModels;
      lastModelFetch = now;
      currentModelIndex = 0;
    }
    
    return cachedFreeModels;
  } catch (error) {
    console.error('Error fetching OpenRouter models:', error);
    // Return a default known free model if fetch fails
    return cachedFreeModels.length > 0 ? cachedFreeModels : ['liquid/lfm-2.5-2.6b:free'];
  }
}

export async function getChatCompletion(messages: any[], contextData?: any): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  // Prepend context if provided
  let apiMessages = [...messages];
  if (contextData) {
    const { kpis, transactions = [], debts = [], budgets = [], emergencyBuffer, payday } = contextData;
    let contextStr = 'No financial data available yet.';
    if (kpis) {
      contextStr = `TrueSpend Financial Summary:
- Total Liquidity (Total Balance): $${kpis.totalLiquidity}
- Bank Balance: $${kpis.bankBalance}
- Cash on Hand: $${kpis.cashOnHand}
- Monthly Income: $${kpis.monthlyIncome}
- Monthly Expenses: $${kpis.monthlyExpenses}
- Adjusted TrueSpend (Available Liquidity): $${kpis.adjustedTrueSpend}
- Next Payday: In ${kpis.daysUntilPayday} days (Day ${payday} of month)
- Daily Allowance: $${kpis.dailyAllowance}
- Daily Spent: $${kpis.dailySpent}
- Daily Remaining: $${kpis.dailyRemaining}
- Daily Status: ${kpis.dailyStatus}
- Emergency Buffer Target: $${emergencyBuffer}

All Transactions:
${transactions.map((t: any) => `- ${new Date(t.createdAt).toLocaleDateString()}: ${t.category}${t.notes ? ' (' + t.notes + ')' : ''} ($${t.amount}) [${t.type}]`).join('\n')}

Active Debts:
${debts.map((d: any) => `- ${d.contactName}: $${d.remainingBalance} remaining (${d.type})`).join('\n')}

Budgets:
${budgets.map((b: any) => `- ${b.category}: $${b.amount}`).join('\n')}`;
    }

    const systemInstruction = `You are an AI assistant for TrueSpend. Context:\n${contextStr}\n\nReturn ONLY JSON: {"reply":"helpful text","actions":[]}.
For write requests, propose actions with exact schemas. EACH action in the "actions" array MUST match this structure:
{
  "type": "create_transaction" | "create_debt" | "update_settings" | "upsert_budget",
  "summary": "Short user-friendly description of the action",
  "parameters": { /* action specific parameters */ }
}

Allowed action types and their REQUIRED parameters object:
1) "create_transaction": { amount: number, type: "Income" | "Expense" | "Transfer" | "Debt Repayment", source_wallet: "Bank" | "Cash", category: string, notes?: string, transaction_date?: string (YYYY-MM-DD) }
2) "create_debt": { amount: number, contact: string, type: "Receivable" | "Payable", due_date?: string (YYYY-MM-DD) }
3) "update_settings": { payday?: number (1-31), emergencyBuffer?: number, salary?: number }
4) "upsert_budget": { category: string, amount: number, year: number, month: number }

Required data must be complete; otherwise ask a question. Proposed actions never execute without explicit user approval. Currency is MAD.`;

    // Add system context at the beginning if not already there
    if (apiMessages.length > 0 && apiMessages[0]?.role === 'system') {
      apiMessages[0].content = `${systemInstruction}\n\nAdditional Instructions:\n${apiMessages[0].content}`;
    } else {
      apiMessages.unshift({ role: 'system', content: systemInstruction });
    }
  } else {
    const fallbackInstruction = `You are an AI assistant for TrueSpend. Return ONLY JSON: {"reply":"text","actions":[]}. Actions are proposals only and need explicit approval. Currency is MAD.`;
    if (apiMessages.length > 0 && apiMessages[0]?.role === 'system') {
       apiMessages[0].content = `${fallbackInstruction}\n\nAdditional Instructions:\n${apiMessages[0].content}`;
    } else if (apiMessages.length > 0 && apiMessages[0]?.role !== 'system') {
       apiMessages.unshift({ role: 'system', content: fallbackInstruction });
    }
  }

  let attempts = 0;
  const MAX_RETRIES = 5;
  let cachedModel = getLastWorkingModel();
  if (cachedModel === 'openrouter/free' || cachedModel === 'openrouter/auto') {
    cachedModel = null;
  }
  let currentModelId = cachedModel || 'liquid/lfm-2.5-2.6b:free'; // fallback default if no cache
  let usingFastPath = true;
  let freeModelsList: string[] = [];
  let localModelIndex = 0;
  
  while (attempts < MAX_RETRIES) {
    console.log(`Attempting chat with model: ${currentModelId}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout per model

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://truespend.app', // Required by OpenRouter
          'X-Title': 'TrueSpend AI Chat',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: currentModelId,
          messages: apiMessages,
          response_format: { type: 'json_object' } // Help enforce JSON output on supported models
        }),
        signal: controller.signal as any
      });
      
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        
        // Let's validate the model actually returned valid JSON
        try {
          const content = data.choices?.[0]?.message?.content;
          if (content) {
            // Very lenient parsing to avoid rejecting good models that just format weirdly
            const cleanContent = content.replace(/```[a-zA-Z]*\s*/g, '').replace(/```\s*/g, '').trim();
            JSON.parse(cleanContent); // Test if parsable
          }
          
          // Save successful model for next time
          setLastWorkingModel(currentModelId);
          
          return {
            ...data,
            modelUsed: currentModelId
          };
        } catch (parseError) {
           console.error(`Model ${currentModelId} failed to return valid JSON.`);
        }
      } else {
        const errorText = await response.text();
        console.error(`Model ${currentModelId} failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error(`Error with model ${currentModelId}:`, error);
    }

    // If fast path failed, load the free models list
    if (usingFastPath) {
      console.log(`Fast path model ${currentModelId} failed. Fetching full free models list...`);
      usingFastPath = false;
      try {
        freeModelsList = await getFreeModels();
        // Exclude the one we just tried
        freeModelsList = freeModelsList.filter(m => m !== currentModelId);
        localModelIndex = 0;
      } catch (e) {
        console.error('Failed to get free models fallback list');
      }
    } else {
      localModelIndex++;
    }

    if (freeModelsList.length === 0 || localModelIndex >= freeModelsList.length) {
      break; // No more models to try
    }

    currentModelId = freeModelsList[localModelIndex];
    attempts++;
  }

  throw new Error('All free model attempts failed. Please try again later.');
}
