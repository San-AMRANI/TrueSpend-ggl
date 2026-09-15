import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { debtController } from '../controllers/DebtController.js';

const router = Router();

router.get('/debts', requireAuth, (req, res) => debtController.getDebts(req as any, res));
router.post('/debts', requireAuth, (req, res) => debtController.processDebt(req as any, res));
router.put('/debts/:id', requireAuth, (req, res) => debtController.updateDebt(req as any, res));
router.delete('/debts/:id', requireAuth, (req, res) => debtController.deleteDebt(req as any, res));

export default router;
