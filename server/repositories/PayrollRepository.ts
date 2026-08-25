import { and, asc, eq, gte, lt } from 'drizzle-orm';
import { createPool, db } from '../../src/db/index.js';
import { payrolls } from '../../src/db/schema.js';

export class PayrollRepository {
  private schemaReady: Promise<void> | null = null;

  private ensureSchema() {
    if (!this.schemaReady) {
      this.schemaReady = (async () => {
        const pool = createPool();
        await pool.query(`CREATE TABLE IF NOT EXISTS payrolls (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id uuid NOT NULL REFERENCES users(id),
          scheduled_for timestamp NOT NULL,
          amount decimal NOT NULL CHECK (amount > 0),
          created_at timestamp DEFAULT now() NOT NULL
        )`);
        await pool.query('ALTER TABLE transactions ADD COLUMN IF NOT EXISTS payroll_id uuid REFERENCES payrolls(id)');
        await pool.query('CREATE UNIQUE INDEX IF NOT EXISTS transactions_payroll_id_unique ON transactions (payroll_id) WHERE payroll_id IS NOT NULL');
      })().catch((error) => {
        this.schemaReady = null;
        throw error;
      });
    }
    return this.schemaReady;
  }

  async findAllByUserId(userId: string) {
    await this.ensureSchema();
    return db.select().from(payrolls).where(eq(payrolls.userId, userId)).orderBy(asc(payrolls.scheduledFor));
  }

  async findForMonth(userId: string, start: Date, end: Date) {
    await this.ensureSchema();
    const result = await db.select().from(payrolls).where(and(
      eq(payrolls.userId, userId),
      gte(payrolls.scheduledFor, start),
      lt(payrolls.scheduledFor, end),
    ));
    return result[0] || null;
  }

  async create(data: { userId: string; scheduledFor: Date; amount: string }) {
    await this.ensureSchema();
    const result = await db.insert(payrolls).values(data).returning();
    return result[0];
  }

  async findByIdAndUserId(id: string, userId: string) {
    await this.ensureSchema();
    const result = await db.select().from(payrolls).where(and(eq(payrolls.id, id), eq(payrolls.userId, userId)));
    return result[0] || null;
  }

  async deleteByIdAndUserId(id: string, userId: string) {
    await this.ensureSchema();
    const result = await db.delete(payrolls).where(and(eq(payrolls.id, id), eq(payrolls.userId, userId))).returning();
    return result[0] || null;
  }
}

export const payrollRepository = new PayrollRepository();
