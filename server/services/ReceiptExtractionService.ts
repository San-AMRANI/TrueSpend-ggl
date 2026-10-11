import {
  gemini,
  PRIMARY_GEMINI_MODEL,
  FALLBACK_GEMINI_MODEL,
  MODEL_FLASH_LATEST,
  isModelQuotaExhausted,
  markModelQuotaExhausted,
} from './GeminiClient.js';

export interface ReceiptProposal {
  amount: number | null;
  transactionDate: string | null;
  merchant: string | null;
  category: string;
  walletId: string | null;
  confidence: number;
  missing: string[];
  items?: Array<{ name: string; price: number; quantity?: number }>;
  notes?: string;
}

const amountPattern = /(?:total|grand total|amount due|net total|a payer|montant)\D{0,20}(\d{1,6}(?:[.,]\d{1,2})?)/i;
const datePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
const merchantPattern = /^(?!total\b|tax\b|vat\b|date\b|invoice\b)([A-Za-z][A-Za-z0-9 &'._-]{2,50})$/i;

function normalizeAmount(value: string): number | null {
  const normalized = value.replace(',', '.');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function normalizeDate(value: string): string | null {
  const parts = value.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part))) return null;
  const [first, second, third] = parts;
  const year = first > 31 ? first : third < 100 ? 2000 + third : third;
  const month = first > 31 ? second : second;
  const day = first > 31 ? third : first;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : null;
}

function inferCategory(text: string): string {
  const value = text.toLowerCase();
  if (/restaurant|cafe|coffee|food|meal|pizza|snack/.test(value)) return 'Dining';
  if (/grocery|market|supermarket|carrefour|marjane/.test(value)) return 'Groceries';
  if (/pharmacy|doctor|hospital|medical/.test(value)) return 'Health';
  if (/fuel|gas station|taxi|uber|careem/.test(value)) return 'Transportation';
  if (/netflix|spotify|telecom|internet|phone/.test(value)) return 'Subscriptions';
  return 'Uncategorized';
}

export function parseReceiptText(rawText: string): ReceiptProposal {
  const text = rawText.trim().slice(0, 20_000);
  const amountMatch = text.match(amountPattern) || text.match(/(?:^|\s)(\d{1,6}[.,]\d{2})(?:\s*(?:MAD|DH|EUR|USD))?\s*$/im);
  const amount = amountMatch ? normalizeAmount(amountMatch[1]) : null;
  const dateMatch = text.match(datePattern);
  const transactionDate = dateMatch ? normalizeDate(dateMatch[1]) : null;
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const merchant = lines.find((line) => merchantPattern.test(line))?.replace(/\s+/g, ' ') || null;
  const category = inferCategory(text);
  const missing = [
    ...(amount === null ? ['amount'] : []),
    ...(merchant === null ? ['merchant'] : []),
  ];
  const confidence = Math.max(0, Math.min(100, 35 + (amount === null ? 0 : 35) + (merchant === null ? 0 : 20) + (transactionDate === null ? 0 : 10)));

  return {
    amount,
    transactionDate,
    merchant,
    category,
    walletId: 'Bank',
    confidence,
    missing,
  };
}

export function receiptProposalAction(proposal: ReceiptProposal) {
  return {
    type: 'create_transaction' as const,
    summary: `Record receipt from ${proposal.merchant || 'unknown merchant'}`,
    parameters: {
      amount: proposal.amount,
      type: 'Expense' as const,
      walletId: proposal.walletId,
      category: proposal.category,
      notes: proposal.notes || proposal.merchant || undefined,
      transaction_date: proposal.transactionDate || undefined,
    },
  };
}

export async function parseReceiptWithGemini(input: {
  text?: string;
  image?: { data: string; mimeType: string };
  walletId?: string;
}): Promise<ReceiptProposal> {
  const parts: any[] = [];

  if (input.image?.data && input.image?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: input.image.mimeType,
        data: input.image.data.replace(/^data:[^;]+;base64,/, ''),
      },
    });
  }

  const promptText = `Analyze this receipt / invoice / ticket carefully and extract the financial data.
If an image is provided, inspect the receipt image directly. If OCR text is provided, use the text.
Available text content: ${input.text || 'N/A'}

Respond with ONLY a JSON object matching this schema:
{
  "merchant": "Name of the merchant or store",
  "amount": 123.45,
  "transactionDate": "YYYY-MM-DD",
  "category": "One of: 🍔 Dining & Takeaway, ☕ Coffee & Quick Food, 🛒 Groceries, 🚗 Transportation, 📱 Telecom & Subscriptions, 🩺 Health & Medical, 👕 Personal & Clothing, 🎬 Entertainment, 👥 Social, 🏠 Housing & Utilities, 🚨 Unexpected",
  "confidence": 95,
  "notes": "Short summary or item summary",
  "items": [{"name": "item name", "price": 10.5, "quantity": 1}],
  "missing": []
}
Notes on rules:
- Amount should be the final Total (TTC / Net to pay) as a number.
- Date should be formatted as YYYY-MM-DD.
- Category must match the closest emoji category from the listed options.
- If amount or merchant cannot be detected, list them in the "missing" array and set confidence lower.`;

  parts.push({ text: promptText });

  const models = isModelQuotaExhausted(PRIMARY_GEMINI_MODEL)
    ? [FALLBACK_GEMINI_MODEL, MODEL_FLASH_LATEST]
    : [PRIMARY_GEMINI_MODEL, FALLBACK_GEMINI_MODEL, MODEL_FLASH_LATEST];

  for (const model of models) {
    try {
      const response = await gemini.models.generateContent({
        model,
        contents: { parts },
        config: {
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      const responseText = response.text || '';
      const parsed = JSON.parse(responseText.trim());

      const amount = typeof parsed.amount === 'number' && Number.isFinite(parsed.amount) ? parsed.amount : null;
      const merchant = typeof parsed.merchant === 'string' && parsed.merchant.trim() ? parsed.merchant.trim() : null;
      const transactionDate = typeof parsed.transactionDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.transactionDate) ? parsed.transactionDate : null;
      const category = typeof parsed.category === 'string' && parsed.category.trim() ? parsed.category.trim() : '🛒 Groceries';
      const confidence = typeof parsed.confidence === 'number' ? Math.max(0, Math.min(100, parsed.confidence)) : 80;
      const missing = Array.isArray(parsed.missing) ? parsed.missing : [
        ...(amount === null ? ['amount'] : []),
        ...(merchant === null ? ['merchant'] : []),
      ];

      return {
        amount,
        merchant,
        transactionDate,
        category,
        walletId: input.walletId || 'Bank',
        confidence,
        missing,
        notes: parsed.notes || merchant || undefined,
        items: Array.isArray(parsed.items) ? parsed.items : undefined,
      };
    } catch (err: any) {
      console.warn(`[ReceiptGemini] Error with model ${model}:`, err?.message || err);
      if (err?.status === 429 || String(err?.message || '').includes('429') || String(err?.message || '').toLowerCase().includes('quota')) {
        markModelQuotaExhausted(model, 1000 * 60 * 30);
      }
      // Try next model
    }
  }

  // Fallback to regex parser if Gemini unavailable or text provided
  if (input.text) {
    return parseReceiptText(input.text);
  }

  return {
    amount: null,
    merchant: null,
    transactionDate: null,
    category: '🛒 Groceries',
    walletId: input.walletId || 'Bank',
    confidence: 0,
    missing: ['amount', 'merchant', 'transactionDate'],
  };
}
