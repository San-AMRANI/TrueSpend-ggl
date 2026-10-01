import { and, desc, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { recommendations } from '../../src/db/schema.js';

export type RecommendationRecord = typeof recommendations.$inferSelect;
export type RecommendationInsert = typeof recommendations.$inferInsert;

export class RecommendationRepository {
  async findActiveByUserId(userId: string) {
    const now = new Date();
    return db.select().from(recommendations).where(and(
      eq(recommendations.userId, userId), eq(recommendations.status, 'Active'),
      or(isNull(recommendations.expiresAt), gt(recommendations.expiresAt, now)),
    )).orderBy(desc(recommendations.priorityScore));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const rows = await db.select().from(recommendations).where(and(eq(recommendations.id, id), eq(recommendations.userId, userId))).limit(1);
    return rows[0] ?? null;
  }

  async findByDedupeKey(userId: string, dedupeKey: string) {
    const rows = await db.select().from(recommendations)
      .where(and(eq(recommendations.userId, userId), eq(recommendations.dedupeKey, dedupeKey))).limit(1);
    return rows[0] ?? null;
  }

  async upsertByDedupe(userId: string, input: RecommendationInsert) {
    const rows = await db.insert(recommendations).values({ ...input, userId })
      .onConflictDoUpdate({
        target: [recommendations.userId, recommendations.dedupeKey],
        set: { priorityScore: input.priorityScore, title: input.title, summary: input.summary, rationale: input.rationale,
          confidence: input.confidence, actionPayload: input.actionPayload, evidenceJson: input.evidenceJson,
          status: 'Active', availableFrom: new Date(), snoozedUntil: null, actedAt: null, updatedAt: new Date() },
      }).returning();
    return rows[0];
  }

  async updateStatus(id: string, userId: string, status: 'Viewed' | 'Approved' | 'Dismissed' | 'Snoozed', snoozedUntil?: Date | null) {
    const rows = await db.update(recommendations).set({ status, snoozedUntil: snoozedUntil ?? null, actedAt: status === 'Viewed' ? undefined : new Date(), updatedAt: new Date() })
      .where(and(eq(recommendations.id, id), eq(recommendations.userId, userId))).returning();
    return rows[0] ?? null;
  }
}

export const recommendationRepository = new RecommendationRepository();
