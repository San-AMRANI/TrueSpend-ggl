import { db } from '../../src/db/index.js';
import { goals } from '../../src/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateGoalParams {
  userId: string;
  name: string;
  targetAmount: string;
  currentAmount?: string;
  walletId?: string | null;
  autoSyncBalance?: boolean;
  deadline?: Date | null;
  category?: string;
  notes?: string;
}

export class GoalRepository {
  async findAllByUserId(userId: string) {
    return await db
      .select()
      .from(goals)
      .where(eq(goals.userId, userId))
      .orderBy(desc(goals.createdAt));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const result = await db
      .select()
      .from(goals)
      .where(and(eq(goals.id, id), eq(goals.userId, userId)));
    return result[0] || null;
  }

  async create(data: CreateGoalParams) {
    const newGoal = await db.insert(goals).values(data).returning();
    return newGoal[0];
  }

  async update(id: string, userId: string, data: Partial<CreateGoalParams>) {
    const updated = await db
      .update(goals)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(goals.id, id), eq(goals.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await db.delete(goals).where(and(eq(goals.id, id), eq(goals.userId, userId)));
  }
}

export const goalRepository = new GoalRepository();
