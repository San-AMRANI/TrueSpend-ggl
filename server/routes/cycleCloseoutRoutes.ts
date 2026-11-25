import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { cycleCloseoutController } from '../controllers/CycleCloseoutController.js';

const router = Router();

router.get('/cycle-closeout/settings', requireAuth, (req, res) =>
  cycleCloseoutController.getSettings(req as any, res)
);
router.put('/cycle-closeout/settings', requireAuth, (req, res) =>
  cycleCloseoutController.updateSettings(req as any, res)
);
router.get('/cycle-closeout/runs', requireAuth, (req, res) =>
  cycleCloseoutController.getRuns(req as any, res)
);
router.post('/cycle-closeout/run-yearly', requireAuth, (req, res) =>
  cycleCloseoutController.runYearlyCloseout(req as any, res)
);

export default router;
