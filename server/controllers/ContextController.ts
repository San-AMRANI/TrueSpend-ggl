import { Response } from 'express';
import { db } from '../../src/db/index.js';
import { financialContexts, transactions } from '../../src/db/schema.js';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { FinancialContext } from '../../src/types/index.js';
import { AuthRequest } from '../../src/middleware/auth.js';

export const contextController = {
  async getContexts(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const userContexts = await db
        .select()
        .from(financialContexts)
        .where(eq(financialContexts.userId, userId))
        .orderBy(desc(financialContexts.createdAt));

      res.json(userContexts);
    } catch (error) {
      console.error('Error fetching contexts:', error);
      res.status(500).json({ error: 'Failed to fetch contexts' });
    }
  },

  async createContext(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const newContext = req.body;

      const [insertedContext] = await db.insert(financialContexts).values({
        userId: userId,
        name: newContext.name,
        type: newContext.type,
        startDate: newContext.startDate ? new Date(newContext.startDate) : null,
        endDate: newContext.endDate ? new Date(newContext.endDate) : null,
        budget: newContext.budget ? newContext.budget.toString() : null,
        status: newContext.status || 'Planned',
        notes: newContext.notes || null,
      }).returning();

      res.json(insertedContext);
    } catch (error) {
      console.error('Error creating context:', error);
      res.status(500).json({ error: 'Failed to create context' });
    }
  },

  async updateContext(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;
      const updates = req.body;

      const [updatedContext] = await db.update(financialContexts)
        .set({
          name: updates.name,
          type: updates.type,
          startDate: updates.startDate ? new Date(updates.startDate) : null,
          endDate: updates.endDate ? new Date(updates.endDate) : null,
          budget: updates.budget ? updates.budget.toString() : null,
          status: updates.status,
          notes: updates.notes,
          updatedAt: new Date()
        })
        .where(and(eq(financialContexts.id, id), eq(financialContexts.userId, userId)))
        .returning();

      if (!updatedContext) {
        return res.status(404).json({ error: 'Context not found' });
      }

      res.json(updatedContext);
    } catch (error) {
      console.error('Error updating context:', error);
      res.status(500).json({ error: 'Failed to update context' });
    }
  },

  async deleteContext(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { id } = req.params;

      // Nullify contextId on related transactions
      await db.update(transactions)
        .set({ contextId: null })
        .where(and(eq(transactions.contextId, id), eq(transactions.userId, userId)));

      const [deleted] = await db.delete(financialContexts)
        .where(and(eq(financialContexts.id, id), eq(financialContexts.userId, userId)))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: 'Context not found' });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('Error deleting context:', error);
      res.status(500).json({ error: 'Failed to delete context' });
    }
  },

  async linkTransactions(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser?.id || req.user?.id;
      if (!userId) {
        return res.status(401).json({ error: 'Unauthorized' });
      }

      const { transactionIds, contextId } = req.body;
      if (!Array.isArray(transactionIds) || transactionIds.length === 0) {
        return res.status(400).json({ error: 'transactionIds array is required' });
      }

      if (contextId) {
        const [ctx] = await db
          .select()
          .from(financialContexts)
          .where(and(eq(financialContexts.id, contextId), eq(financialContexts.userId, userId)));
        if (!ctx) {
          return res.status(404).json({ error: 'Context not found' });
        }
      }

      await db
        .update(transactions)
        .set({ contextId: contextId || null })
        .where(and(inArray(transactions.id, transactionIds), eq(transactions.userId, userId)));

      res.json({ success: true, count: transactionIds.length });
    } catch (error) {
      console.error('Error linking transactions to context:', error);
      res.status(500).json({ error: 'Failed to link transactions' });
    }
  }
};
