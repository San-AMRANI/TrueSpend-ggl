import { Transaction } from '../types/index.js';

export interface InboxItem {
  id: string;
  transactionId: string;
  reason: 'UNCATEGORIZED' | 'ANOMALY' | 'NEW_MERCHANT' | 'UNUSUALLY_HIGH';
  status: 'PENDING' | 'RESOLVED' | 'IGNORED';
  suggestedCategory?: string;
  confidenceScore?: number;
  createdAt: Date;
}

export function detectInboxItems(transactions: Transaction[]): InboxItem[] {
  const items: InboxItem[] = [];
  
  for (const tx of transactions) {
    if (!tx.category || tx.category === 'Uncategorized' || tx.category === 'Unknown') {
      items.push({
        id: `inbox-${tx.id}`,
        transactionId: tx.id,
        reason: 'UNCATEGORIZED',
        status: 'PENDING',
        createdAt: new Date()
      });
    }
    // High amount anomaly (simple heuristic)
    else if (parseFloat(tx.amount) > 5000 && tx.type === 'Expense') {
      items.push({
        id: `inbox-anomaly-${tx.id}`,
        transactionId: tx.id,
        reason: 'UNUSUALLY_HIGH',
        status: 'PENDING',
        createdAt: new Date()
      });
    }
  }

  return items;
}
