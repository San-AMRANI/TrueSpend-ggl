import { db } from '../../src/db/index.js';
import { resilienceProfiles } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export interface ResilienceProfileData {
  emergencyTargetMonths?: number;
  stressJobLossMonths?: number;
  stressEmergencyExpense?: string | number;
  stressInflationRate?: string | number;
  essentialExpensesRatio?: string | number;
  customEssentialMonthly?: string | number | null;
  microLeakThreshold?: string | number;
  notes?: string | null;
}

export class ResilienceRepository {
  async findByUserId(userId: string) {
    const rows = await db
      .select()
      .from(resilienceProfiles)
      .where(eq(resilienceProfiles.userId, userId))
      .limit(1);

    return rows[0] || null;
  }

  async upsert(userId: string, data: ResilienceProfileData) {
    const existing = await this.findByUserId(userId);

    const valuesToSave: any = {
      userId,
      emergencyTargetMonths: data.emergencyTargetMonths !== undefined ? Math.max(1, Math.min(36, Number(data.emergencyTargetMonths))) : 6,
      stressJobLossMonths: data.stressJobLossMonths !== undefined ? Math.max(1, Math.min(24, Number(data.stressJobLossMonths))) : 3,
      stressEmergencyExpense: String(data.stressEmergencyExpense ?? '2500'),
      stressInflationRate: String(data.stressInflationRate ?? '12.0'),
      essentialExpensesRatio: String(data.essentialExpensesRatio ?? '60.0'),
      customEssentialMonthly: data.customEssentialMonthly !== null && data.customEssentialMonthly !== undefined
        ? String(data.customEssentialMonthly)
        : null,
      microLeakThreshold: String(data.microLeakThreshold ?? '20.0'),
      notes: data.notes ?? null,
      lastAuditedAt: new Date(),
      updatedAt: new Date(),
    };

    if (existing) {
      const updated = await db
        .update(resilienceProfiles)
        .set(valuesToSave)
        .where(eq(resilienceProfiles.userId, userId))
        .returning();
      return updated[0];
    } else {
      valuesToSave.createdAt = new Date();
      const inserted = await db
        .insert(resilienceProfiles)
        .values(valuesToSave)
        .returning();
      return inserted[0];
    }
  }
}

export const resilienceRepository = new ResilienceRepository();
