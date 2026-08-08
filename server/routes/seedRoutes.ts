import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { seedController } from '../controllers/SeedController.js';

const router = Router();

router.post('/seed', requireAuth, (req, res) => seedController.seed(req as any, res));

export default router;
