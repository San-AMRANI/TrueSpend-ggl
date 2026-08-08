import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { transactionController } from '../controllers/TransactionController.js';

const router = Router();

router.get('/transactions', requireAuth, (req, res) => transactionController.getTransactions(req as any, res));
router.post('/transactions', requireAuth, (req, res) => transactionController.createTransaction(req as any, res));
router.delete('/transactions/:id', requireAuth, (req, res) => transactionController.deleteTransaction(req as any, res));

export default router;
