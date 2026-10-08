import { Transaction } from '../types/index.js';

export interface RecurringCandidate {
  merchant: string;
  amount: number;
  frequency: 'MONTHLY' | 'WEEKLY' | 'UNKNOWN';
  lastDate: Date;
  confidence: number;
}

export function detectRecurringTransactions(transactions: Transaction[]): RecurringCandidate[] {
  const candidates: RecurringCandidate[] = [];
  const merchantGroups = new Map<string, Transaction[]>();
  
  for (const tx of transactions) {
    if (tx.notes && tx.type === 'Expense') {
      const group = merchantGroups.get(tx.notes) || [];
      group.push(tx);
      merchantGroups.set(tx.notes, group);
    }
  }

  for (const [merchant, group] of merchantGroups.entries()) {
    if (group.length >= 2) {
      // Sort by date descending
      group.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      const amounts = group.map(t => parseFloat(t.amount));
      const isConsistentAmount = amounts.every(a => Math.abs(a - amounts[0]) < amounts[0] * 0.1);
      
      if (isConsistentAmount) {
        const d1 = new Date(group[0].createdAt).getTime();
        const d2 = new Date(group[1].createdAt).getTime();
        const diffDays = Math.abs(d1 - d2) / (1000 * 60 * 60 * 24);
        
        let freq: 'MONTHLY' | 'WEEKLY' | 'UNKNOWN' = 'UNKNOWN';
        if (diffDays >= 25 && diffDays <= 35) freq = 'MONTHLY';
        else if (diffDays >= 6 && diffDays <= 8) freq = 'WEEKLY';
        
        if (freq !== 'UNKNOWN') {
          candidates.push({
            merchant,
            amount: amounts[0],
            frequency: freq,
            lastDate: new Date(group[0].createdAt),
            confidence: Math.min(100, group.length * 20)
          });
        }
      }
    }
  }

  return candidates;
}
