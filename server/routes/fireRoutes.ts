import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { fireController } from '../controllers/FireController.js';

const router = Router();

router.get('/fire-profile', requireAuth, (req, res) => fireController.getProfile(req as any, res));
router.put('/fire-profile', requireAuth, (req, res) => fireController.updateProfile(req as any, res));

export default router;
