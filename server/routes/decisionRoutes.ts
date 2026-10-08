import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { decisionController } from '../controllers/DecisionController.js';

const router = Router();

router.use(requireAuth as any);

router.post('/evaluate-purchase', decisionController.evaluatePurchase.bind(decisionController) as any);
router.post('/scenarios', decisionController.compareScenarios.bind(decisionController) as any);
router.post('/forecast-accuracy', decisionController.analyzeAccuracy.bind(decisionController) as any);
router.post('/rules', decisionController.evaluateRules.bind(decisionController) as any);

export default router;
