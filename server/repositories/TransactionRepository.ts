import { db } from '../../src/db/index.js';
import { transactions, splits } from '../../src/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateTransactionParams {
  userId: string;
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  sourceWallet: 'Bank' | 'Cash';
  category?: string;
  notes?: string;
}

export interface CreateSplitParams {
  transactionId: string;
  reimbursableAmount: string;
  linkedContactId?: string | null;
}

export class TransactionRepository {
  async findAllByUserId(userId: string) {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt));
  }

  async create(data: CreateTransactionParams) {
    const newTx = await db.insert(transactions).values(data).returning();
    return newTx[0];
  }

  async findSplitsByTransactionId(transactionId: string) {
    return await db.select().from(splits).where(eq(splits.transactionId, transactionId));
  }

  async createSplit(data: CreateSplitParams) {
    const newSplit = await db.insert(splits).values(data).returning();
    return newSplit[0];
  }

  async deleteSplitsByTransactionId(transactionId: string) {
    await db.delete(splits).where(eq(splits.transactionId, transactionId));
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  async deleteAllByUserId(userId: string) {
    await db.delete(transactions).where(eq(transactions.userId, userId));
  }

  async deleteAllSplits() {
    await db.delete(splits);
  }
}

export const transactionRepository = new TransactionRepository();
