import { transactionRepository } from '../repositories/TransactionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { normalizeCategory } from '../../src/lib/categories.js';

export interface CreateTransactionDTO {
  amount: number;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  source_wallet: 'Bank' | 'Cash';
  category?: string;
  notes?: string;
  transaction_date?: string;
  reimbursable_amount?: number;
  linked_contact_name?: string;
}

export class TransactionService {
  async getTransactionsForUser(userId: string) {
    const transactions = await transactionRepository.findAllByUserId(userId);
    return transactions.map((transaction) => ({
      ...transaction,
      category: normalizeCategory(transaction.category),
    }));
  }

  async createTransaction(userId: string, dto: CreateTransactionDTO) {
    const createdAt = this.parseTransactionDate(dto.transaction_date);
    const newTx = await transactionRepository.create({
      userId,
      amount: String(dto.amount),
      type: dto.type,
      sourceWallet: dto.source_wallet,
      category: normalizeCategory(dto.category),
      notes: dto.notes,
      createdAt,
    });

    if (dto.reimbursable_amount && dto.reimbursable_amount > 0 && dto.linked_contact_name) {
      const newDebt = await debtRepository.create({
        userId,
        contactName: dto.linked_contact_name,
        type: 'Receivable',
        originalAmount: String(dto.reimbursable_amount),
        remainingBalance: String(dto.reimbursable_amount),
        status: 'Pending',
      });

      await transactionRepository.createSplit({
        transactionId: newTx.id,
        reimbursableAmount: String(dto.reimbursable_amount),
        linkedContactId: newDebt.id,
      });
    }

    return newTx;
  }

  private parseTransactionDate(date?: string) {
    if (!date) return undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid transaction date');
    }

    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid transaction date');
    }

    return parsedDate;
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const relatedSplits = await transactionRepository.findSplitsByTransactionId(transactionId);

    for (const split of relatedSplits) {
      if (split.linkedContactId) {
        const debt = await debtRepository.findByIdAndUserId(split.linkedContactId, userId);
        if (debt) {
          const currentOriginal = parseFloat(debt.originalAmount as unknown as string);
          const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
          const reimbursableAmount = parseFloat(split.reimbursableAmount as unknown as string);

          const newOriginal = currentOriginal - reimbursableAmount;
          const newRemaining = currentRemaining - reimbursableAmount;

          if (newOriginal <= 0) {
            await debtRepository.deleteByIdAndUserId(debt.id, userId);
          } else {
            await debtRepository.update(debt.id, userId, {
              originalAmount: String(newOriginal),
              remainingBalance: String(newRemaining),
              status: newRemaining <= 0 ? 'Cleared' : 'Pending',
            });
          }
        }
      }
    }

    await transactionRepository.deleteSplitsByTransactionId(transactionId);
    await transactionRepository.deleteByIdAndUserId(transactionId, userId);
  }
}

export const transactionService = new TransactionService();
