import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { cycleRetrospectiveController } from '../controllers/CycleRetrospectiveController.js';

const router = Router();

router.get('/reports/cycles', requireAuth, (req, res) => cycleRetrospectiveController.getCycles(req, res));
router.get('/reports/cycle-retrospective', requireAuth, (req, res) => cycleRetrospectiveController.getRetrospective(req, res));
router.post('/reports/cycle-retrospective/generate', requireAuth, (req, res) => cycleRetrospectiveController.generateRetrospective(req, res));

export default router;
