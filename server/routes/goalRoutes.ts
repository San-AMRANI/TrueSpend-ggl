import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { goalController } from '../controllers/GoalController.js';

const router = Router();

router.get('/goals', requireAuth, (req, res) => goalController.getGoals(req as any, res));
router.post('/goals', requireAuth, (req, res) => goalController.createGoal(req as any, res));
router.put('/goals/:id', requireAuth, (req, res) => goalController.updateGoal(req as any, res));
router.delete('/goals/:id', requireAuth, (req, res) => goalController.deleteGoal(req as any, res));
router.post('/goals/:id/contribute', requireAuth, (req, res) => goalController.contributeToGoal(req as any, res));

export default router;
