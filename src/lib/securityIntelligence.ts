import { Transaction } from '../types/index.js';

export interface SecurityAlert {
  transactionId: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  reason: string;
}

export function detectSecurityAnomalies(transactions: Transaction[]): SecurityAlert[] {
  const alerts: SecurityAlert[] = [];
  
  for (const tx of transactions) {
    if (tx.type === 'Expense') {
      const amount = parseFloat(tx.amount);
      // Arbitrary heuristic: extremely large transaction
      if (amount > 50000) {
        alerts.push({
          transactionId: tx.id,
          riskLevel: 'HIGH',
          reason: 'Unusually large outbound transfer'
        });
      }
      
      // Foreign transaction or weird merchant names (if we had location data)
      if (tx.notes && tx.notes.toUpperCase().includes('CRYPTO')) {
        alerts.push({
          transactionId: tx.id,
          riskLevel: 'MEDIUM',
          reason: 'Cryptocurrency related merchant'
        });
      }
    }
  }
  return alerts;
}
