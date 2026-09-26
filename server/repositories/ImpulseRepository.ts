import { db } from '../../src/db/index.js';
import { impulseItems, goals, wallets } from '../../src/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateImpulseParams {
  userId: string;
  name: string;
  amount: string;
  currency?: string;
  category?: string;
  notes?: string | null;
  url?: string | null;
  triggers?: string;
  urgencyScore?: number;
  utilityScore?: number;
  coolingHours?: number;
  coolsAt: Date;
  status?: string;
  decisionDate?: Date | null;
  decisionNotes?: string | null;
  savedToGoalId?: string | null;
  walletId?: string | null;
}

export class ImpulseRepository {
  async findAllByUserId(userId: string) {
    const rows = await db
      .select({
        item: impulseItems,
        goalName: goals.name,
        walletName: wallets.name,
      })
      .from(impulseItems)
      .leftJoin(goals, eq(impulseItems.savedToGoalId, goals.id))
      .leftJoin(wallets, eq(impulseItems.walletId, wallets.id))
      .where(eq(impulseItems.userId, userId))
      .orderBy(desc(impulseItems.createdAt));

    return rows.map((r) => ({
      ...r.item,
      savedToGoalName: r.goalName || null,
      walletName: r.walletName || null,
    }));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const rows = await db
      .select({
        item: impulseItems,
        goalName: goals.name,
        walletName: wallets.name,
      })
      .from(impulseItems)
      .leftJoin(goals, eq(impulseItems.savedToGoalId, goals.id))
      .leftJoin(wallets, eq(impulseItems.walletId, wallets.id))
      .where(and(eq(impulseItems.id, id), eq(impulseItems.userId, userId)));

    if (!rows[0]) return null;
    return {
      ...rows[0].item,
      savedToGoalName: rows[0].goalName || null,
      walletName: rows[0].walletName || null,
    };
  }

  async create(data: CreateImpulseParams) {
    const newItems = await db.insert(impulseItems).values(data).returning();
    return newItems[0];
  }

  async update(id: string, userId: string, data: Partial<CreateImpulseParams>) {
    const updated = await db
      .update(impulseItems)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(impulseItems.id, id), eq(impulseItems.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await db.delete(impulseItems).where(and(eq(impulseItems.id, id), eq(impulseItems.userId, userId)));
  }
}

export const impulseRepository = new ImpulseRepository();
