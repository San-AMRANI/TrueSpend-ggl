import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { behavioralController } from '../controllers/BehavioralController.js';

const router = Router();

router.use(requireAuth as any);
router.get('/behavioral-insights', behavioralController.getInsights.bind(behavioralController) as any);

export default router;
