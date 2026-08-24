import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { payrolls } from '../../src/db/schema.js';

export class PayrollRepository {
  findAllByUserId(userId: string) {
    return db.select().from(payrolls).where(eq(payrolls.userId, userId)).orderBy(asc(payrolls.scheduledFor));
  }

  async findForMonth(userId: string, start: Date, end: Date) {
    const result = await db.select().from(payrolls).where(and(
      eq(payrolls.userId, userId),
      gte(payrolls.scheduledFor, start),
      lt(payrolls.scheduledFor, end),
    ));
    return result[0] || null;
  }

  async create(data: { userId: string; scheduledFor: Date; amount: string }) {
    const result = await db.insert(payrolls).values(data).returning();
    return result[0];
  }

  async findByIdAndUserId(id: string, userId: string) {
    const result = await db.select().from(payrolls).where(and(eq(payrolls.id, id), eq(payrolls.userId, userId)));
    return result[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    const result = await db.delete(payrolls).where(and(eq(payrolls.id, id), eq(payrolls.userId, userId))).returning();
    return result[0] || null;
  }
}

export const payrollRepository = new PayrollRepository();
