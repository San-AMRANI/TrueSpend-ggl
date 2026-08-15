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

  let systemInstruction = `You are TrueSpend's financial assistant. Return one JSON object only, with no Markdown fence: {"reply":"text","actions":[]}.
Keep the reply concise (normally under 140 words), use MAD, and never claim an action was completed. Every write is only a proposal that requires the user's explicit approval.`;

  if (contextData) {
    // The client sends a deliberately compact snapshot. Keep a hard cap for older or
    // third-party clients so a large request can never turn into a huge model prompt.
    const serializedContext = JSON.stringify(contextData);
    const contextStr = serializedContext.length > 14000
      ? `${serializedContext.slice(0, 14000)}…[truncated]`
      : serializedContext;

    systemInstruction = `You are TrueSpend's financial assistant. The compact financial snapshot below is current user data. Return one JSON object only, with no Markdown fence: {"reply":"text","actions":[]}.
Use MAD, keep the reply concise (normally under 140 words), and never invent values, transactions, or IDs. The snapshot includes aggregate spending across all history and the most recent transactions for reference.

For a write request, include an action only when all necessary details are known. Otherwise ask a short follow-up question and return an empty actions array. Actions are proposals, never completed until the user explicitly approves them. Use target IDs only when they appear in the snapshot. Include at most five actions.

Every action has: {"type":"...","summary":"clear description","parameters":{...}}. Its summary must state every money amount, affected record, and setting value so the user can make an informed approval.
Allowed action types and parameters:
- create_transaction: {amount, type:"Income"|"Expense"|"Transfer"|"Debt Repayment", source_wallet:"Bank"|"Cash", category, notes?, transaction_date?:"YYYY-MM-DD", reimbursable_amount?, linked_contact_name?}
- update_transaction: {transaction_id, amount?, source_wallet?, category?, notes?, transaction_date?:"YYYY-MM-DD"}; type cannot change.
- delete_transaction: {transaction_id}
- create_debt: {amount, contact, type:"Receivable"|"Payable", due_date?:"YYYY-MM-DD"}
- update_debt: {debt_id, amount?, contact?, type?:"Receivable"|"Payable", due_date?:"YYYY-MM-DD"}
- settle_debt: {debt_id, amount}
- delete_debt: {debt_id}
- set_category_budget: {category, amount, year?, month?}; omitted year/month means the current calendar month.
- update_settings: {payday?:1..31, emergencyBuffer?:number}

Use the canonical expense categories when applicable: Debt Repayment, Medical, Wardrobe, Social, Groceries, Food & Dining, Transportation, Utilities, Family, Entertainment, Coffee, Grooming, Telecom.

Financial snapshot: ${contextStr}`;
  }

  // Find if there is an existing system message in the input and combine it
  const inputSystemMsg = messages.find((m: any) => m.role === 'system');
  if (inputSystemMsg) {
    systemInstruction = `${systemInstruction}\n\nAdditional Instructions:\n${inputSystemMsg.content}`;
  }

  // Filter out system messages for Gemini contents
  const geminiMessages = messages
    .filter((m: any) => m.role !== 'system')
    .slice(-8)
    .map((m: any) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: String(m.content || ' ').slice(0, 1200) }]
    }));

  try {
    const requestStartedAt = Date.now();
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: geminiMessages,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        maxOutputTokens: 500,
        temperature: 0.2,
      }
    });

    return {
      choices: [
        {
          message: { content: response.text || '' }
        }
      ],
      modelUsed: 'gemini-3.6-flash',
      responseTimeMs: Date.now() - requestStartedAt,
    };
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw new Error('Failed to communicate with AI');
  }
}
