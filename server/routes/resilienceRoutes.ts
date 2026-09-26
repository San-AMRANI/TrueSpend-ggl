import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { resilienceController } from '../controllers/ResilienceController.js';

const router = Router();

router.get('/resilience/audit', requireAuth, (req, res) => resilienceController.getAudit(req as any, res));
router.put('/resilience/profile', requireAuth, (req, res) => resilienceController.updateProfile(req as any, res));
router.post('/resilience/simulate', requireAuth, (req, res) => resilienceController.simulateCustom(req as any, res));

export default router;
