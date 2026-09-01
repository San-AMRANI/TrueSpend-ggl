import { db } from '../../src/db/index.js';
import { goals } from '../../src/db/schema.js';
import { eq, and } from 'drizzle-orm';

export class GoalRepository {
  async findAllByUserId(userId: string) {
    return db.select().from(goals).where(eq(goals.userId, userId));
  }

  async findById(id: string, userId: string) {
    const result = await db.select().from(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
    return result[0] ?? null;
  }

  async create(data: {
    userId: string;
    name: string;
    targetAmount: string;
    currentAmount?: string;
    deadline?: Date | null;
    category?: string;
    notes?: string;
  }) {
    const result = await db.insert(goals).values({
      userId: data.userId,
      name: data.name,
      targetAmount: data.targetAmount,
      currentAmount: data.currentAmount ?? '0',
      deadline: data.deadline ?? null,
      category: data.category ?? '',
      notes: data.notes ?? '',
    }).returning();
    return result[0];
  }

  async update(id: string, userId: string, data: {
    name?: string;
    targetAmount?: string;
    currentAmount?: string;
    deadline?: Date | null;
    category?: string;
    notes?: string;
  }) {
    const result = await db.update(goals).set({
      ...data,
      updatedAt: new Date(),
    }).where(and(eq(goals.id, id), eq(goals.userId, userId))).returning();
    return result[0] ?? null;
  }

  async delete(id: string, userId: string) {
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  }
}

export const goalRepository = new GoalRepository();
