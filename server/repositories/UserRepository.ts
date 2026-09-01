import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

export class UserRepository {
  async findById(id: string) {
    const result = await db.select().from(users).where(eq(users.id, id));
    return result[0] || null;
  }

  async updateSettings(userId: string, data: { payday?: number; emergencyBuffer?: string }) {
    await db.update(users).set(data).where(eq(users.id, userId));
  }
}

export const userRepository = new UserRepository();
