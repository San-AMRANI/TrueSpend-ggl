import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { transactionService } from '../services/TransactionService.js';
import { payrollService } from '../services/PayrollService.js';
import { parseBankNotification } from '../services/BankNotificationParser.js';

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

  async ingestBankNotification(req: AuthRequest, res: Response) {
    try {
      const title = typeof req.body?.title === 'string' ? req.body.title : '';
      const text = typeof req.body?.text === 'string' ? req.body.text : '';
      const packageName = typeof req.body?.packageName === 'string' ? req.body.packageName : '';
      const idempotencyKey =
        typeof req.body?.idempotencyKey === 'string' && req.body.idempotencyKey.trim()
          ? req.body.idempotencyKey.trim()
          : null;
      if (!title && !text) {
        res.status(400).json({ error: 'Notification text is required.' });
        return;
      }

      const proposal = await parseBankNotification([title, text].filter(Boolean).join('\n'));
      if (!proposal.amount) {
        res.status(422).json({
          error: 'No transaction amount could be detected.',
          proposal,
        });
        return;
      }

      const created = await transactionService.createTransaction(req.dbUser.id, {
        amount: proposal.amount,
        nativeAmount: proposal.amount,
        currency: proposal.currency,
        type: proposal.type,
        walletId: 'Bank',
        category: proposal.category,
        notes: `[Bank notification: ${packageName || 'unknown app'}] ${proposal.notes}${proposal.merchant ? ` | ${proposal.merchant}` : ''}`,
        transaction_date: proposal.transactionDate,
        idempotencyKey: idempotencyKey ? `bank-${idempotencyKey}` : undefined,
      });
      res.status(201).json({
        transactionId: created.id,
        proposal,
      });
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Unable to ingest bank notification' });
    }
  }
}

export const transactionController = new TransactionController();
