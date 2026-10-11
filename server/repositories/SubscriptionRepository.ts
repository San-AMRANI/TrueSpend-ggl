import { db } from '../../src/db/index.js';
import { subscriptions } from '../../src/db/schema.js';
import { eq, desc, and } from 'drizzle-orm';

export interface CreateSubscriptionParams {
  userId: string;
  name: string;
  amount: string;
  currency?: string;
  billingCycle?: string;
  category?: string;
  walletId?: string | null;
  nextBillingDate?: Date | null;
  status?: string;
  notes?: string;
  icon?: string;
  websiteUrl?: string;
}

export class SubscriptionRepository {
  async findAllByUserId(userId: string) {
    return await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const result = await db
      .select()
      .from(subscriptions)
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
    return result[0] || null;
  }

  async create(data: CreateSubscriptionParams) {
    const newSubscription = await db.insert(subscriptions).values(data).returning();
    return newSubscription[0];
  }

  async update(id: string, userId: string, data: Partial<CreateSubscriptionParams>) {
    const updated = await db
      .update(subscriptions)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)))
      .returning();
    return updated[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await db.delete(subscriptions).where(and(eq(subscriptions.id, id), eq(subscriptions.userId, userId)));
  }
}

export const subscriptionRepository = new SubscriptionRepository();
