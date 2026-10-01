import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { financialPlans, planAllocations } from '../../src/db/schema.js';

export type FinancialPlanRecord = typeof financialPlans.$inferSelect;
export type PlanAllocationRecord = typeof planAllocations.$inferSelect;
export type FinancialPlanInsert = typeof financialPlans.$inferInsert;
export type PlanAllocationInsert = typeof planAllocations.$inferInsert;

export class FinancialPlanRepository {
  async findAllByUserId(userId: string) {
    return db.select().from(financialPlans).where(eq(financialPlans.userId, userId)).orderBy(desc(financialPlans.createdAt));
  }

  async findByIdAndUserId(id: string, userId: string) {
    const rows = await db.select().from(financialPlans).where(and(eq(financialPlans.id, id), eq(financialPlans.userId, userId))).limit(1);
    return rows[0] ?? null;
  }

  /** One received income transaction can seed one auditable plan lineage. */
  async findBySourceTransactionId(userId: string, sourceTransactionId: string) {
    const rows = await db.select().from(financialPlans).where(and(
      eq(financialPlans.userId, userId),
      eq(financialPlans.sourceTransactionId, sourceTransactionId),
    )).orderBy(desc(financialPlans.createdAt)).limit(1);
    return rows[0] ?? null;
  }

  async findActiveByUserId(userId: string) {
    const rows = await db.select().from(financialPlans)
      .where(and(eq(financialPlans.userId, userId), eq(financialPlans.status, 'Active')))
      .orderBy(desc(financialPlans.updatedAt)).limit(1);
    return rows[0] ?? null;
  }

  async create(plan: FinancialPlanInsert, allocations: Array<Omit<PlanAllocationInsert, 'planId'>>) {
    return db.transaction(async (tx) => {
      const created = (await tx.insert(financialPlans).values(plan).returning())[0];
      const createdAllocations = allocations.length
        ? await tx.insert(planAllocations).values(allocations.map((allocation) => ({ ...allocation, planId: created.id }))).returning()
        : [];
      return { plan: created, allocations: createdAllocations };
    });
  }

  async findAllocations(planId: string, userId: string) {
    return db.select().from(planAllocations)
      .where(and(eq(planAllocations.planId, planId), eq(planAllocations.userId, userId)));
  }

  async updatePlan(id: string, userId: string, values: Partial<FinancialPlanInsert>) {
    const rows = await db.update(financialPlans).set({ ...values, updatedAt: new Date() })
      .where(and(eq(financialPlans.id, id), eq(financialPlans.userId, userId))).returning();
    return rows[0] ?? null;
  }

  async updateAllocation(id: string, planId: string, userId: string, values: Partial<PlanAllocationInsert>) {
    const rows = await db.update(planAllocations).set({ ...values, updatedAt: new Date() })
      .where(and(eq(planAllocations.id, id), eq(planAllocations.planId, planId), eq(planAllocations.userId, userId))).returning();
    return rows[0] ?? null;
  }
}

export const financialPlanRepository = new FinancialPlanRepository();
