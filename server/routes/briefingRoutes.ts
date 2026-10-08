import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { briefingController } from '../controllers/BriefingController.js';

const router = Router();

router.use(requireAuth as any);
router.get('/briefing', briefingController.getBriefing.bind(briefingController) as any);

export default router;
