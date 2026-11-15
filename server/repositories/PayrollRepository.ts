import { and, asc, eq, gte, lt, ne } from 'drizzle-orm';
import { db, ensureDatabaseMigrated } from '../../src/db/index.js';
import { payrolls } from '../../src/db/schema.js';

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

export class PayrollRepository {
  private async ensureSchema() {
    await ensureDatabaseMigrated();
  }

  async findAllByUserId(userId: string, exec: DbExecutor = db) {
    await this.ensureSchema();
    return exec
      .select()
      .from(payrolls)
      .where(eq(payrolls.userId, userId))
      .orderBy(asc(payrolls.scheduledFor));
  }

  async findForMonth(
    userId: string,
    start: Date,
    end: Date,
    excludeId?: string,
    exec: DbExecutor = db
  ) {
    await this.ensureSchema();
    const conditions = [
      eq(payrolls.userId, userId),
      gte(payrolls.scheduledFor, start),
      lt(payrolls.scheduledFor, end),
    ];
    if (excludeId) conditions.push(ne(payrolls.id, excludeId));
    const result = await exec.select().from(payrolls).where(and(...conditions));
    return result[0] || null;
  }

  async create(
    data: { userId: string; scheduledFor: Date; amount: string; walletId?: string | null },
    exec: DbExecutor = db
  ) {
    await this.ensureSchema();
    const result = await exec.insert(payrolls).values(data).returning();
    return result[0];
  }

  async findByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    await this.ensureSchema();
    const result = await exec
      .select()
      .from(payrolls)
      .where(and(eq(payrolls.id, id), eq(payrolls.userId, userId)));
    return result[0] || null;
  }

  async update(
    id: string,
    userId: string,
    data: Partial<{ scheduledFor: Date; amount: string; walletId: string | null }>,
    exec: DbExecutor = db
  ) {
    await this.ensureSchema();
    const result = await exec
      .update(payrolls)
      .set(data)
      .where(and(eq(payrolls.id, id), eq(payrolls.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    await this.ensureSchema();
    const result = await exec
      .delete(payrolls)
      .where(and(eq(payrolls.id, id), eq(payrolls.userId, userId)))
      .returning();
    return result[0] || null;
  }
}

export const payrollRepository = new PayrollRepository();
