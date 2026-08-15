import { and, asc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { categoryBudgets } from '../../src/db/schema.js';

export interface UpsertCategoryBudgetParams {
  userId: string;
  category: string;
  year: number;
  month: number;
  amount: string;
}

export class CategoryBudgetRepository {
  async findAllByUserId(userId: string) {
    return db
      .select()
      .from(categoryBudgets)
      .where(eq(categoryBudgets.userId, userId))
      .orderBy(asc(categoryBudgets.year), asc(categoryBudgets.month), asc(categoryBudgets.category));
  }

  async upsert(data: UpsertCategoryBudgetParams) {
    const result = await db
      .insert(categoryBudgets)
      .values(data)
      .onConflictDoUpdate({
        target: [categoryBudgets.userId, categoryBudgets.category, categoryBudgets.year, categoryBudgets.month],
        set: { amount: data.amount, updatedAt: new Date() },
      })
      .returning();
    return result[0];
  }

  async findByMonth(userId: string, year: number, month: number) {
    return db
      .select()
      .from(categoryBudgets)
      .where(and(eq(categoryBudgets.userId, userId), eq(categoryBudgets.year, year), eq(categoryBudgets.month, month)));
  }
}

export const categoryBudgetRepository = new CategoryBudgetRepository();
