import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { payrollController } from '../controllers/PayrollController.js';

const router = Router();
router.get('/payrolls', requireAuth, (req, res) => payrollController.getPayrolls(req as any, res));
router.post('/payrolls', requireAuth, (req, res) => payrollController.createPayroll(req as any, res));
router.delete('/payrolls/:id', requireAuth, (req, res) => payrollController.deletePayroll(req as any, res));
export default router;
