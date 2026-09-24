import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { impulseController } from '../controllers/ImpulseController.js';

const router = Router();

router.get('/impulse', requireAuth, (req, res) => impulseController.getItems(req as any, res));
router.get('/impulse/stats', requireAuth, (req, res) => impulseController.getStats(req as any, res));
router.post('/impulse', requireAuth, (req, res) => impulseController.createItem(req as any, res));
router.put('/impulse/:id', requireAuth, (req, res) => impulseController.updateItem(req as any, res));
router.delete('/impulse/:id', requireAuth, (req, res) => impulseController.deleteItem(req as any, res));
router.post('/impulse/:id/resolve', requireAuth, (req, res) => impulseController.resolveDecision(req as any, res));

export default router;
