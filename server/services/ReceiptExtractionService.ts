export interface ReceiptProposal {
  amount: number | null;
  transactionDate: string | null;
  merchant: string | null;
  category: string;
  sourceWallet: 'Bank' | 'Cash';
  confidence: number;
  missing: string[];
}

const datePattern = /(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})/;
const merchantPattern = /^(?!total\b|tax\b|vat\b|date\b|invoice\b)([A-Za-z][A-Za-z0-9 &'._-]{2,50})$/i;
const amountTokenPattern = /(?:\d{1,3}(?:[ .]\d{3})+|\d{1,6})(?:[.,]\d{1,2}|\s\d{2})?(?:\s*(?:MAD|DH|EUR|USD|€|\$))?/gi;

function simplifyText(value: string): string {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function normalizeAmount(value: string): number | null {
  const normalized = value
    .replace(/\s(?=\d{3}(?:[.,]|\s|$))/g, '')
    .replace(/\s+(?=\d{2}(?:\s*(?:mad|dh|eur|usd|€|\$))?$)/i, '.')
    .replace(',', '.')
    .replace(/[^\d.]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : null;
}

function extractAmount(text: string): number | null {
  const lines = text.split(/\r?\n/);
  const candidates: { amount: number; score: number }[] = [];
  const labelPattern = /\b(?:total|totale|tota1|grand total|amount due|net total|net a payer|a payer|montant|ttc)\b/i;

  lines.forEach((line) => {
    const simplifiedLine = simplifyText(line);
    const labeled = labelPattern.test(simplifiedLine);
    for (const match of line.matchAll(amountTokenPattern)) {
      const raw = match[0];
      const amount = normalizeAmount(raw);
      if (amount === null || (amount >= 1900 && amount <= 2100 && !/[.,]/.test(raw))) continue;
      candidates.push({
        amount,
        score: (labeled ? 100 : 0) + (/[.,]\d{2}|\s\d{2}/.test(raw) ? 20 : 0) + (/[A-Z€$]/i.test(raw) ? 10 : 0) + Math.min(amount / 100_000, 1),
      });
    }
  });

  return candidates.sort((left, right) => right.score - left.score || right.amount - left.amount)[0]?.amount || null;
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
  const amount = extractAmount(text);
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
    sourceWallet: 'Bank',
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
      source_wallet: proposal.sourceWallet,
      category: proposal.category,
      notes: proposal.merchant || undefined,
      transaction_date: proposal.transactionDate || undefined,
    },
  };
}
