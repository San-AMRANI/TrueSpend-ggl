import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { financialProfiles } from '../../src/db/schema.js';

export type FinancialProfileRecord = typeof financialProfiles.$inferSelect;
export type FinancialProfileInsert = typeof financialProfiles.$inferInsert;

export class FinancialProfileRepository {
  async findByUserId(userId: string) {
    const rows = await db.select().from(financialProfiles).where(eq(financialProfiles.userId, userId)).limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, values: Omit<Partial<FinancialProfileInsert>, 'id' | 'userId' | 'createdAt'>) {
    const rows = await db.insert(financialProfiles).values({ userId, ...values })
      .onConflictDoUpdate({ target: financialProfiles.userId, set: { ...values, updatedAt: new Date() } })
      .returning();
    return rows[0];
  }
}

export const financialProfileRepository = new FinancialProfileRepository();
