import { Transaction } from '../types/index.js';

export interface MerchantRule {
  merchantNamePattern: string;
  assignedCategory: string;
  confidenceCount: number;
}

export function learnMerchantRules(transactions: Transaction[]): MerchantRule[] {
  const rulesMap = new Map<string, { category: string, count: number }>();

  for (const tx of transactions) {
    if (tx.notes && tx.category && tx.category !== 'Uncategorized') {
      const key = `${tx.notes.toLowerCase()}|${tx.category}`;
      const existing = rulesMap.get(key) || { category: tx.category, count: 0 };
      existing.count += 1;
      rulesMap.set(key, existing);
    }
  }

  const rules: MerchantRule[] = [];
  for (const [key, data] of rulesMap.entries()) {
    if (data.count > 2) {
      rules.push({
        merchantNamePattern: key.split('|')[0],
        assignedCategory: data.category,
        confidenceCount: data.count
      });
    }
  }

  return rules;
}
