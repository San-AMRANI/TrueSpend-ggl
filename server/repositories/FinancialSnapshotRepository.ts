import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { financialSnapshots } from '../../src/db/schema.js';

export class FinancialSnapshotRepository {
  async upsert(userId: string, date: string, values: Omit<typeof financialSnapshots.$inferInsert, 'id' | 'userId' | 'snapshotDate' | 'createdAt'>) {
    return (await db.insert(financialSnapshots).values({ userId, snapshotDate: date, ...values })
      .onConflictDoUpdate({ target: [financialSnapshots.userId, financialSnapshots.snapshotDate], set: values }).returning())[0];
  }
  async between(userId: string, from?: string, to?: string) {
    const conditions = [eq(financialSnapshots.userId, userId)];
    if (from) conditions.push(gte(financialSnapshots.snapshotDate, from));
    if (to) conditions.push(lte(financialSnapshots.snapshotDate, to));
    return db.select().from(financialSnapshots).where(and(...conditions)).orderBy(asc(financialSnapshots.snapshotDate));
  }
}

export const financialSnapshotRepository = new FinancialSnapshotRepository();
