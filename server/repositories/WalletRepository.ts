import { db } from '../../src/db/index.js';
import { wallets, transactions } from '../../src/db/schema.js';
import { eq, and, ne } from 'drizzle-orm';

export class WalletRepository {
  async findAllByUserId(userId: string) {
    return await db.select().from(wallets).where(eq(wallets.userId, userId));
  }

  async findById(id: string, userId: string) {
    const result = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .limit(1);
    return result[0] || null;
  }

  async findByName(userId: string, name: string) {
    const result = await db
      .select()
      .from(wallets)
      .where(and(eq(wallets.userId, userId), eq(wallets.name, name)))
      .limit(1);
    return result[0] || null;
  }

  async create(data: { userId: string; name: string; type: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: string }) {
    if (data.isMain) {
      await this.unsetOtherMain(data.userId);
    }
    const result = await db.insert(wallets).values(data).returning();
    return result[0];
  }

  async update(id: string, userId: string, data: Partial<{ name: string; type: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: string }>) {
    if (data.isMain) {
      await this.unsetOtherMain(userId, id);
    }
    const result = await db
      .update(wallets)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async unsetOtherMain(userId: string, exceptId?: string) {
    if (exceptId) {
      await db
        .update(wallets)
        .set({ isMain: false, updatedAt: new Date() })
        .where(and(eq(wallets.userId, userId), ne(wallets.id, exceptId)));
    } else {
      await db
        .update(wallets)
        .set({ isMain: false, updatedAt: new Date() })
        .where(eq(wallets.userId, userId));
    }
  }

  async reassignTransactions(userId: string, fromWalletId: string, toWalletId: string) {
    await db
      .update(transactions)
      .set({ walletId: toWalletId })
      .where(and(eq(transactions.userId, userId), eq(transactions.walletId, fromWalletId)));
  }

  async delete(id: string, userId: string) {
    const result = await db
      .delete(wallets)
      .where(and(eq(wallets.id, id), eq(wallets.userId, userId)))
      .returning();
    return result[0] || null;
  }
}

export const walletRepository = new WalletRepository();
