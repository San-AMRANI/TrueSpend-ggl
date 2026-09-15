import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { kpiController } from '../controllers/KpiController.js';

const router = Router();

router.get('/kpis', requireAuth, (req, res) => kpiController.getKpis(req as any, res));

export default router;
