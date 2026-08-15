import fs from 'fs';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';

export class SeedService {
  async seedForUser(userId: string) {
    // Truncate tables for this user / splits
    await transactionRepository.deleteAllSplits();
    await transactionRepository.deleteAllByUserId(userId);
    await debtRepository.deleteAllByUserId(userId);

    const rawData = fs.readFileSync('./src/db/seed_data.json', 'utf8');
    const seedData = JSON.parse(rawData);

    const newDebtsMap: Record<string, string> = {};
    if (seedData.debts && seedData.debts.length > 0) {
      for (const debt of seedData.debts) {
        const created = await debtRepository.create({
          userId,
          contactName: debt.contactName,
          type: debt.type,
          originalAmount: debt.originalAmount,
          remainingBalance: debt.remainingBalance,
          status: debt.status,
          createdAt: new Date(debt.createdAt),
        });
        newDebtsMap[debt.id] = created.id;
      }
    }

    const newTxMap: Record<string, string> = {};
    if (seedData.transactions && seedData.transactions.length > 0) {
      for (const tx of seedData.transactions) {
        const created = await transactionRepository.create({
          userId,
          amount: tx.amount,
          type: tx.type,
          sourceWallet: tx.sourceWallet,
          category: tx.category,
          notes: tx.notes,
        });
        newTxMap[tx.id] = created.id;
      }
    }

    if (seedData.splits && seedData.splits.length > 0) {
      for (const split of seedData.splits) {
        if (newTxMap[split.transactionId]) {
          await transactionRepository.createSplit({
            transactionId: newTxMap[split.transactionId],
            reimbursableAmount: split.reimbursableAmount,
            linkedContactId: split.linkedContactId ? newDebtsMap[split.linkedContactId] : null,
          });
        }
      }
    }

    return { success: true };
  }
}

export const seedService = new SeedService();
