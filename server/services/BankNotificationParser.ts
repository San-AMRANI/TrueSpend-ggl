import {
  gemini,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  isModelQuotaExhausted,
  markModelQuotaExhausted,
  MODEL_FLASH_LATEST,
} from './GeminiClient.js';
import { expenseCategories, normalizeCategory } from '../../src/lib/categories.js';

export interface BankNotificationProposal {
  amount: number | null;
  currency: string;
  type: 'Income' | 'Expense';
  transactionDate: string;
  merchant: string | null;
  category: string;
  confidence: number;
  notes: string;
}

function parseNumber(value: string): number | null {
  let clean = value.replace(/\s/g, '').replace(/[^\d.,-]/g, '');
  if (!clean) return null;
  if (clean.includes(',') && clean.includes('.')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }
  const amount = Number(clean);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function fallbackParse(text: string): BankNotificationProposal {
  const amountMatch =
    text.match(/(?:MAD|DH|Dhs)\s*([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)/i) ||
    text.match(/([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)\s*(?:MAD|DH|Dhs)/i) ||
    text.match(/(?:amount|montant|total|purchase|achat)\s*:?\s*([0-9][0-9\s]*(?:[.,][0-9]{1,2})?)/i);
  const amount = amountMatch ? parseNumber(amountMatch[1]) : null;
  const lower = text.toLowerCase();
  const isIncome = /\b(received|deposit|credited|credit|salary|recu|reçu|virement recu)\b/i.test(lower);
  const category = normalizeCategory(
    /restaurant|cafe|coffee|meal|food|glovo|delivery/i.test(lower)
      ? '🍔 Dining & Takeaway'
      : /carrefour|marjane|grocery|supermarket|bim/i.test(lower)
      ? '🛒 Groceries'
      : /taxi|uber|fuel|station|tram|train|parking/i.test(lower)
      ? '🚗 Transportation'
      : /netflix|spotify|internet|phone|telecom|inwi|orange|iam/i.test(lower)
      ? '📱 Telecom & Subscriptions'
      : /pharmacy|medical|doctor|hospital/i.test(lower)
      ? '🩺 Health & Medical'
      : '⚠️ Unexpected'
  );
  const merchantMatch = text.match(/(?:at|chez|chez le|merchant|commercant)\s+([^,\n.;]+)/i);
  return {
    amount,
    currency: /(?:€|EUR)/i.test(text) ? 'EUR' : /(?:\$|USD)/i.test(text) ? 'USD' : 'MAD',
    type: isIncome ? 'Income' : 'Expense',
    transactionDate: new Date().toISOString().slice(0, 10),
    merchant: merchantMatch?.[1]?.trim() || null,
    category: isIncome ? '📥 Income' : category,
    confidence: amount ? 70 : 20,
    notes: text.slice(0, 500),
  };
}

export async function parseBankNotification(text: string): Promise<BankNotificationProposal> {
  const raw = text.trim().slice(0, 5_000);
  const fallback = fallbackParse(raw);
  const prompt = `Analyze this bank or wallet notification and extract one transaction.
Text: ${JSON.stringify(raw)}
Respond ONLY with valid JSON:
{
 "amount": number or null,
 "currency": "MAD",
 "type": "Expense" or "Income",
 "transactionDate": "YYYY-MM-DD",
 "merchant": "merchant or counterparty or null",
 "category": "one of: ${expenseCategories.join(', ')}, 📥 Income",
 "confidence": 0 to 100,
 "notes": "short neutral summary"
}`;

  const models = isModelQuotaExhausted(PRIMARY_GEMINI_MODEL)
    ? [FALLBACK_GEMINI_MODEL, MODEL_FLASH_LATEST]
    : [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, MODEL_FLASH_LATEST];

  for (const model of models) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: { text: prompt },
        config: { responseMimeType: 'application/json', temperature: 0.1 },
      });
      const parsed = JSON.parse((response.text || '{}').trim());
      const amount = typeof parsed.amount === 'number' && parsed.amount > 0 ? parsed.amount : null;
      const type = parsed.type === 'Income' ? 'Income' : 'Expense';
      return {
        amount,
        currency: typeof parsed.currency === 'string' ? parsed.currency.toUpperCase().slice(0, 8) : fallback.currency,
        type,
        transactionDate:
          typeof parsed.transactionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.transactionDate)
            ? parsed.transactionDate
            : fallback.transactionDate,
        merchant: typeof parsed.merchant === 'string' && parsed.merchant.trim() ? parsed.merchant.trim() : fallback.merchant,
        category: normalizeCategory(type === 'Income' ? '📥 Income' : (parsed.category || fallback.category)),
        confidence: typeof parsed.confidence === 'number'
          ? Math.max(0, Math.min(100, parsed.confidence))
          : fallback.confidence,
        notes: typeof parsed.notes === 'string' && parsed.notes.trim()
          ? parsed.notes.trim().slice(0, 500)
          : fallback.notes,
      };
    } catch (error: any) {
      if (error?.status === 429 || String(error?.message || '').includes('429')) {
        markModelQuotaExhausted(model, 1000 * 60 * 30);
      }
    }
  }
  return fallback;
}
