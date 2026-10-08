import { db } from '../../src/db/index.js';
import { commitments } from '../../src/db/schema.js';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export class CommitmentRepository {
  async getByUserId(userId: string) {
    return await db.select().from(commitments).where(eq(commitments.userId, userId));
  }

  async create(userId: string, payload: any) {
    const id = uuidv4();
    const result = await db.insert(commitments).values({
      id,
      userId,
      ...payload,
    }).returning();
    return result[0];
  }

  async update(id: string, userId: string, payload: any) {
    const result = await db.update(commitments)
      .set({ ...payload, updatedAt: new Date() })
      .where(and(eq(commitments.id, id), eq(commitments.userId, userId)))
      .returning();
    return result[0];
  }

  async delete(id: string, userId: string) {
    await db.delete(commitments).where(and(eq(commitments.id, id), eq(commitments.userId, userId)));
    return true;
  }
}
