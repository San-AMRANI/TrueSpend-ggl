import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { budgetCategoryPreferences } from '../../src/db/schema.js';

export type BudgetCategoryPreferenceRecord = typeof budgetCategoryPreferences.$inferSelect;

export class BudgetCategoryPreferenceRepository {
  async findAllByUserId(userId: string) {
    return db.select().from(budgetCategoryPreferences)
      .where(eq(budgetCategoryPreferences.userId, userId))
      .orderBy(asc(budgetCategoryPreferences.category));
  }

  async find(userId: string, category: string) {
    const rows = await db.select().from(budgetCategoryPreferences).where(and(
      eq(budgetCategoryPreferences.userId, userId),
      eq(budgetCategoryPreferences.category, category),
    )).limit(1);
    return rows[0] ?? null;
  }

  async upsert(userId: string, input: {
    category: string;
    classification: 'essential' | 'flexible' | 'growth' | 'excluded';
    isLocked: boolean;
    neverAutoChange: boolean;
  }) {
    const rows = await db.insert(budgetCategoryPreferences).values({ userId, ...input })
      .onConflictDoUpdate({
        target: [budgetCategoryPreferences.userId, budgetCategoryPreferences.category],
        set: {
          classification: input.classification,
          isLocked: input.isLocked,
          neverAutoChange: input.neverAutoChange,
          updatedAt: new Date(),
        },
      }).returning();
    return rows[0];
  }
}

export const budgetCategoryPreferenceRepository = new BudgetCategoryPreferenceRepository();
