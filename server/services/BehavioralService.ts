import { transactionService } from './TransactionService.js';
import { detectInboxItems } from '../../src/lib/transactionInbox.js';
import { learnMerchantRules } from '../../src/lib/merchantRules.js';
import { detectRecurringTransactions } from '../../src/lib/recurringDetection.js';
import { extractFinancialMemory } from '../../src/lib/financialMemory.js';
import { detectSecurityAnomalies } from '../../src/lib/securityIntelligence.js';

export class BehavioralService {
  async getInsights(userId: string) {
    const transactions = await transactionService.getTransactionsForUser(userId);
    
    // Convert to any to bypass strict type checking for `createdAt/date` in dummy data if needed
    const txData = transactions as any[];

    return {
      inboxItems: detectInboxItems(txData),
      merchantRules: learnMerchantRules(txData),
      recurringCandidates: detectRecurringTransactions(txData),
      financialMemory: extractFinancialMemory(txData),
      securityAlerts: detectSecurityAnomalies(txData)
    };
  }
}

export const behavioralService = new BehavioralService();
