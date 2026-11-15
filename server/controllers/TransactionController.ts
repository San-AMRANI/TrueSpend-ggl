import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { transactionService } from '../services/TransactionService.js';

export class TransactionController {
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser.id;

      if (req.query.summaryOnly === 'true') {
        const startDate = req.query.startDate
          ? new Date(String(req.query.startDate))
          : new Date(Date.now() - 30 * 86_400_000);
        const endDate = req.query.endDate ? new Date(String(req.query.endDate)) : new Date();
        const summary = await transactionService.getPeriodSummaryForUser(userId, startDate, endDate);
        return res.json(summary);
      }

      if (req.query.paginated === 'true') {
        const limit = req.query.limit ? Number(req.query.limit) : 50;
        const page = await transactionService.getPaginatedTransactionsForUser(userId, {
          limit,
          cursorCreatedAt: req.query.cursorCreatedAt ? String(req.query.cursorCreatedAt) : undefined,
          cursorId: req.query.cursorId ? String(req.query.cursorId) : undefined,
          type: req.query.type ? (String(req.query.type) as any) : undefined,
          walletId: req.query.walletId ? String(req.query.walletId) : undefined,
          category: req.query.category ? String(req.query.category) : undefined,
          search: req.query.search ? String(req.query.search) : undefined,
        });
        return res.json(page);
      }

      const txs = await transactionService.getTransactionsForUser(userId);
      res.json(txs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createTransaction(req: AuthRequest, res: Response) {
    try {
      const created = await transactionService.createTransaction(req.dbUser.id, req.body);
      res.status(201).json({ message: 'Transaction created', id: created.id });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({
        error: e.message || 'Unable to create transaction',
      });
    }
  }

  async deleteTransaction(req: AuthRequest, res: Response) {
    try {
      const txId = req.params.id;
      await transactionService.deleteTransaction(req.dbUser.id, txId);
      res.status(200).json({ message: 'Transaction deleted' });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateTransaction(req: AuthRequest, res: Response) {
    try {
      const updated = await transactionService.updateTransaction(req.dbUser.id, req.params.id, req.body);
      res.json({ message: 'Transaction updated', transaction: updated });
    } catch (e: any) {
      console.error(e);
      res.status(e.message?.includes('not found') ? 404 : 400).json({ error: e.message || 'Unable to update transaction' });
    }
  }
}

export const transactionController = new TransactionController();
