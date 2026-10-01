import { db } from '../../src/db/index.js';
import { transactions, splits, wallets } from '../../src/db/schema.js';
import { eq, desc, and, inArray } from 'drizzle-orm';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateTransactionParams {
  userId: string;
  amount: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: string;
  destinationWalletId?: string | null;
  sourceWallet?: string | null;
  category?: string;
  notes?: string;
  createdAt?: Date;
  payrollId?: string;
  contextId?: string | null;
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
    const sanitizedData = { ...data };
    if (sanitizedData.walletId && !UUID_REGEX.test(sanitizedData.walletId)) {
      try {
        const userWallets = await db.select().from(wallets).where(eq(wallets.userId, sanitizedData.userId));
        if (userWallets.length > 0) {
          const match = sanitizedData.walletId === 'Cash'
            ? userWallets.find((w) => w.type === 'Cash') || userWallets[0]
            : userWallets.find((w) => w.type === 'Bank' && w.isMain) || userWallets.find((w) => w.type === 'Bank') || userWallets[0];
          sanitizedData.walletId = match.id;
        } else {
          sanitizedData.walletId = null as any;
        }
      } catch {
        sanitizedData.walletId = null as any;
      }
    }
    if (sanitizedData.destinationWalletId && !UUID_REGEX.test(sanitizedData.destinationWalletId)) {
      sanitizedData.destinationWalletId = null;
    }
    const newTx = await db.insert(transactions).values(sanitizedData).returning();
    return newTx[0];
  }

  async findByIdAndUserId(id: string, userId: string) {
    const result = await db
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return result[0] || null;
  }

  async findByPayrollId(payrollId: string) {
    const result = await db.select().from(transactions).where(eq(transactions.payrollId, payrollId));
    return result[0] || null;
  }

  async update(id: string, userId: string, data: Partial<CreateTransactionParams>) {
    const sanitizedData = { ...data };
    if (sanitizedData.walletId && !UUID_REGEX.test(sanitizedData.walletId)) {
      try {
        const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
        if (userWallets.length > 0) {
          const match = sanitizedData.walletId === 'Cash'
            ? userWallets.find((w) => w.type === 'Cash') || userWallets[0]
            : userWallets.find((w) => w.type === 'Bank' && w.isMain) || userWallets.find((w) => w.type === 'Bank') || userWallets[0];
          sanitizedData.walletId = match.id;
        } else {
          delete sanitizedData.walletId;
        }
      } catch {
        delete sanitizedData.walletId;
      }
    }
    if (sanitizedData.destinationWalletId && !UUID_REGEX.test(sanitizedData.destinationWalletId)) {
      sanitizedData.destinationWalletId = null;
    }
    const result = await db
      .update(transactions)
      .set(sanitizedData)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async findSplitsByTransactionId(transactionId: string) {
    return await db.select().from(splits).where(eq(splits.transactionId, transactionId));
  }

  async findSplitsByTransactionIds(transactionIds: string[]) {
    if (transactionIds.length === 0) return [];
    return await db.select().from(splits).where(inArray(splits.transactionId, transactionIds));
  }

  async createSplit(data: CreateSplitParams) {
    const newSplit = await db.insert(splits).values(data).returning();
    return newSplit[0];
  }

  async deleteSplitsByTransactionId(transactionId: string) {
    await db.delete(splits).where(eq(splits.transactionId, transactionId));
  }

  async updateSplit(id: string, data: Partial<CreateSplitParams>) {
    const result = await db.update(splits).set(data).where(eq(splits.id, id)).returning();
    return result[0] || null;
  }

  async deleteSplitById(id: string) {
    await db.delete(splits).where(eq(splits.id, id));
  }

  async findSplitsByDebtId(debtId: string) {
    return db.select().from(splits).where(eq(splits.linkedContactId, debtId));
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
