import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function getChatCompletion(messages: any[], contextData?: any): Promise<any> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY environment variable is not set');
  }

  let systemInstruction = `You are an AI assistant for TrueSpend. Return ONLY JSON: {"reply":"text","actions":[]}. Actions are proposals only and need explicit approval.`;

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

    systemInstruction = `You are an AI assistant for TrueSpend. Context:\n${contextStr}\n\nReturn ONLY JSON: {"reply":"helpful text","actions":[]}.
For write requests, propose actions with exact schemas. EACH action in the "actions" array MUST match this structure:
{
  "type": "create_transaction" | "create_debt" | "update_settings",
  "summary": "Short user-friendly description of the action",
  "parameters": { /* action specific parameters */ }
}

Allowed action types and their REQUIRED parameters object:
1) "create_transaction": { amount: number, type: "Income" | "Expense" | "Transfer" | "Debt Repayment", source_wallet: "Bank" | "Cash", category: string, notes?: string, transaction_date?: string (YYYY-MM-DD) }
2) "create_debt": { amount: number, contact: string, type: "Receivable" | "Payable", due_date?: string (YYYY-MM-DD) }
3) "update_settings": { payday?: number (1-31), emergencyBuffer?: number }

Required data must be complete; otherwise ask a question. Proposed actions never execute without explicit user approval. Currency is MAD.`;
  }

  // Find if there is an existing system message in the input and combine it
  const inputSystemMsg = messages.find((m: any) => m.role === 'system');
  if (inputSystemMsg) {
    systemInstruction = `${systemInstruction}\n\nAdditional Instructions:\n${inputSystemMsg.content}`;
  }

  // Filter out system messages for Gemini contents
  const geminiMessages = messages
    .filter((m: any) => m.role !== 'system')
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content || ' ' }]
    }));

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: geminiMessages,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
      }
    });

    return {
      choices: [
        {
          message: {
            content: response.text
          }
        }
      ],
      modelUsed: 'gemini-3.6-flash'
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('Failed to communicate with AI');
  }
}
