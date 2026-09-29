import { db } from '../../src/db/index.js';
import { debts, splits } from '../../src/db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export interface CreateDebtParams {
  userId: string;
  contactName: string;
  type: 'Receivable' | 'Payable';
  originalAmount: string;
  remainingBalance: string;
  status: 'Pending' | 'Cleared';
  dueDate?: Date;
  createdAt?: Date;
}

export class DebtRepository {
  async findAllByUserId(userId: string) {
    return await db
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(desc(debts.createdAt));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const result = await db
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
    return result[0] || null;
  }

  async create(data: CreateDebtParams) {
    const newDebt = await db.insert(debts).values(data).returning();
    return newDebt[0];
  }

  async update(id: string, userId: string, data: Partial<CreateDebtParams>) {
    await db
      .update(debts)
      .set(data)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await db.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async deleteAllByUserId(userId: string) {
    await db.delete(debts).where(eq(debts.userId, userId));
  }

  async findAllLinkedSplits() {
    return await db.select().from(splits).where(sql`${splits.linkedContactId} IS NOT NULL`);
  }
}

export const debtRepository = new DebtRepository();
