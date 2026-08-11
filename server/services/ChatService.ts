import dotenv from 'dotenv';
dotenv.config();

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
        return pricing && (pricing.prompt === '0' || pricing.prompt === 0) && (pricing.completion === '0' || pricing.completion === 0);
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
    return cachedFreeModels.length > 0 ? cachedFreeModels : ['meta-llama/llama-3-8b-instruct:free'];
  }
}

export async function getChatCompletion(messages: any[], contextData?: any): Promise<any> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  const freeModels = await getFreeModels();
  if (freeModels.length === 0) {
    throw new Error('No free models available');
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

    // Add system context at the beginning if not already there
    if (apiMessages[0]?.role === 'system') {
      apiMessages[0].content = `Context:\n${contextStr}\n\n${apiMessages[0].content}`;
    } else {
      apiMessages.unshift({ role: 'system', content: `You are an AI assistant for TrueSpend. Context:\n${contextStr}\n\nReturn ONLY JSON: {"reply":"helpful text","actions":[]}. For write requests, propose only create_transaction, create_debt, or update_settings actions, each with summary and parameters. Required data must be complete; otherwise ask a question. Proposed actions never execute without explicit user approval. Currency is MAD.` });
    }
  } else {
      if (apiMessages.length > 0 && apiMessages[0]?.role !== 'system') {
         apiMessages.unshift({ role: 'system', content: `You are an AI assistant for TrueSpend. Return ONLY JSON: {"reply":"text","actions":[]}. Actions are proposals only and need explicit approval.` });
      }
  }

  const maxRetries = Math.min(freeModels.length, 5); // Try up to 5 models
  let attempts = 0;

  while (attempts < maxRetries) {
    const currentModelId = freeModels[currentModelIndex];
    console.log(`Attempting chat with model: ${currentModelId}`);

    try {
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
          messages: apiMessages
        })
      });

      if (response.ok) {
        const data = await response.json();
        return {
          ...data,
          modelUsed: currentModelId
        };
      } else {
        const errorText = await response.text();
        console.error(`Model ${currentModelId} failed: ${response.status} ${errorText}`);
      }
    } catch (error) {
      console.error(`Error with model ${currentModelId}:`, error);
    }

    // Move to next model
    currentModelIndex = (currentModelIndex + 1) % freeModels.length;
    attempts++;
  }

  throw new Error('All free model attempts failed. Please try again later.');
}
