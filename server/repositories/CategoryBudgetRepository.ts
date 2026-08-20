import { and, asc, eq, sql } from 'drizzle-orm';
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

  async deleteById(id: string, userId: string) {
    const result = await db
      .delete(categoryBudgets)
      .where(and(eq(categoryBudgets.id, id), eq(categoryBudgets.userId, userId)))
      .returning();
    return result[0] ?? null;
  }

  async batchUpsert(userId: string, budgets: { category: string; year: number; month: number; amount: string }[]) {
    const values = budgets.map((b) => ({
      userId,
      category: b.category,
      year: b.year,
      month: b.month,
      amount: b.amount,
      updatedAt: new Date(),
    }));

    const result = await db
      .insert(categoryBudgets)
      .values(values)
      .onConflictDoUpdate({
        target: [categoryBudgets.userId, categoryBudgets.category, categoryBudgets.year, categoryBudgets.month],
        set: {
          amount: sql`EXCLUDED.amount`,
          updatedAt: new Date(),
        },
      })
      .returning();

    return result;
  }
}

export const categoryBudgetRepository = new CategoryBudgetRepository();
