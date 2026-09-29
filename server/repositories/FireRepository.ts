import { db } from '../../src/db/index.js';
import { fireProfiles } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export interface FireProfileData {
  currentAge?: number;
  targetAge?: number;
  expectedReturn?: string | number;
  safeWithdrawalRate?: string | number;
  monthlySavingsBoost?: string | number;
  expenseTrimPercent?: string | number;
  customMonthlyExpense?: string | number | null;
}

export class FireRepository {
  async findByUserId(userId: string) {
    const rows = await db
      .select()
      .from(fireProfiles)
      .where(eq(fireProfiles.userId, userId))
      .limit(1);

    return rows[0] || null;
  }

  async upsert(userId: string, data: FireProfileData) {
    const existing = await this.findByUserId(userId);

    const valuesToSave: any = {
      userId,
      currentAge: data.currentAge !== undefined ? Math.max(18, Math.min(100, Number(data.currentAge))) : 28,
      targetAge: data.targetAge !== undefined ? Math.max(25, Math.min(100, Number(data.targetAge))) : 55,
      expectedReturn: String(data.expectedReturn ?? '7.5'),
      safeWithdrawalRate: String(data.safeWithdrawalRate ?? '4.0'),
      monthlySavingsBoost: String(data.monthlySavingsBoost ?? '0'),
      expenseTrimPercent: String(data.expenseTrimPercent ?? '0'),
      customMonthlyExpense: data.customMonthlyExpense !== null && data.customMonthlyExpense !== undefined
        ? String(data.customMonthlyExpense)
        : null,
      updatedAt: new Date(),
    };

    if (existing) {
      const updated = await db
        .update(fireProfiles)
        .set(valuesToSave)
        .where(eq(fireProfiles.userId, userId))
        .returning();
      return updated[0];
    } else {
      valuesToSave.createdAt = new Date();
      const inserted = await db
        .insert(fireProfiles)
        .values(valuesToSave)
        .returning();
      return inserted[0];
    }
  }
}

export const fireRepository = new FireRepository();
