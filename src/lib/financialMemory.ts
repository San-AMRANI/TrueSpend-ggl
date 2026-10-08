import { Transaction } from '../types/index.js';

export interface BehavioralPattern {
  type: 'SPEND_DAY' | 'CATEGORY_SPIKE' | 'SAVINGS_RATE';
  description: string;
  metric: number;
}

export function extractFinancialMemory(transactions: Transaction[]): BehavioralPattern[] {
  const patterns: BehavioralPattern[] = [];
  
  // Example: finding most expensive day of week
  const daySpend = [0,0,0,0,0,0,0]; // Sun-Sat
  for (const tx of transactions) {
    if (tx.type === 'Expense') {
      const date = new Date(tx.createdAt || tx.createdAt);
      if (!isNaN(date.getTime())) {
        daySpend[date.getDay()] += parseFloat(tx.amount);
      }
    }
  }
  
  const maxSpend = Math.max(...daySpend);
  if (maxSpend > 0) {
    const maxDay = daySpend.indexOf(maxSpend);
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    patterns.push({
      type: 'SPEND_DAY',
      description: `Highest spending occurs on ${days[maxDay]}s.`,
      metric: maxSpend
    });
  }

  return patterns;
}
