import { db } from '../../src/db/index.js';
import { debts, splits, userAuditLogs } from '../../src/db/schema.js';
import { eq, desc, and, sql } from 'drizzle-orm';

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export interface CreateDebtParams {
  userId: string;
  contactName: string;
  type: 'Receivable' | 'Payable';
  originalAmount: string;
  remainingBalance: string;
  status: 'Pending' | 'Cleared';
  dueDate?: Date;
  createdAt?: Date;
  counterpartyId?: string | null;
}

export class DebtRepository {
  async findAllByUserId(userId: string, exec: DbExecutor = db) {
    return await exec
      .select()
      .from(debts)
      .where(eq(debts.userId, userId))
      .orderBy(desc(debts.createdAt));
  }

  async findByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    const result = await exec
      .select()
      .from(debts)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
    return result[0] || null;
  }

  async create(data: CreateDebtParams, exec: DbExecutor = db) {
    const newDebt = await exec.insert(debts).values(data).returning();
    return newDebt[0];
  }

  async update(id: string, userId: string, data: Partial<CreateDebtParams>, exec: DbExecutor = db) {
    await exec
      .update(debts)
      .set(data)
      .where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async deleteByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    await exec.delete(debts).where(and(eq(debts.id, id), eq(debts.userId, userId)));
  }

  async deleteAllByUserId(userId: string) {
    await db.delete(debts).where(eq(debts.userId, userId));
  }

  async findAllLinkedSplits(exec: DbExecutor = db) {
    return await exec.select().from(splits).where(sql`${splits.linkedContactId} IS NOT NULL`);
  }

  async recordDebtForgiveness(params: {
    userId: string;
    debtId: string;
    contactName: string;
    amount: number;
    reason: string;
    note?: string;
  }) {
    try {
      const inserted = await db
        .insert(userAuditLogs)
        .values({
          actorId: params.userId,
          actorName: 'User',
          targetUserId: params.userId,
          targetUserName: params.debtId,
          action: 'DEBT_FORGIVEN',
          details: JSON.stringify({
            debtId: params.debtId,
            contactName: params.contactName,
            amount: params.amount,
            reason: params.reason,
            note: params.note || '',
          }),
        })
        .returning();
      return inserted[0] || null;
    } catch {
      return null;
    }
  }

  async findForgivenessLogsByUserId(userId: string) {
    try {
      return await db
        .select()
        .from(userAuditLogs)
        .where(
          and(
            eq(userAuditLogs.actorId, userId),
            eq(userAuditLogs.action, 'DEBT_FORGIVEN')
          )
        )
        .orderBy(desc(userAuditLogs.createdAt));
    } catch {
      return [];
    }
  }
}

export const debtRepository = new DebtRepository();
