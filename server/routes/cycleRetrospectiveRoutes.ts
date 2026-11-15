import { Router } from 'express';
import { requireAuth, requireFeature } from '../../src/middleware/auth.js';
import { cycleRetrospectiveController } from '../controllers/CycleRetrospectiveController.js';

const router = Router();

router.get('/reports/cycles', requireAuth, (req, res) => cycleRetrospectiveController.getCycles(req, res));
router.get('/reports/cycle-retrospective', requireAuth, requireFeature('reports.advanced'), (req, res) =>
  cycleRetrospectiveController.getRetrospective(req, res)
);
router.post('/reports/cycle-retrospective/generate', requireAuth, requireFeature('reports.advanced'), (req, res) =>
  cycleRetrospectiveController.generateRetrospective(req, res)
);

export default router;
