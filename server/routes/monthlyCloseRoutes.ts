import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { monthlyCloseController } from '../controllers/MonthlyCloseController.js';

const router = Router();

router.use(requireAuth as any);
router.post('/monthly-close', monthlyCloseController.closeMonth.bind(monthlyCloseController) as any);

export default router;
