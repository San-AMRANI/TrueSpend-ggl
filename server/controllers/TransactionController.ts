import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { transactionService } from '../services/TransactionService.js';
import { payrollService } from '../services/PayrollService.js';

export class TransactionController {
  async getTransactions(req: AuthRequest, res: Response) {
    try {
      await payrollService.reconcileDuePayrolls(req.dbUser.id);
      const txs = await transactionService.getTransactionsForUser(req.dbUser.id);
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
      res.status(e.message === 'Invalid transaction date' ? 400 : 500).json({
        error: e.message === 'Invalid transaction date' ? e.message : 'Internal Server Error',
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
