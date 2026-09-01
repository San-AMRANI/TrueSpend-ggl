import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { insightsController } from '../controllers/InsightsController.js';

const router = Router();

router.get('/insights', requireAuth, (req, res) => insightsController.getInsights(req as any, res));

export default router;
