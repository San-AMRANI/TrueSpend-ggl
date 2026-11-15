import { Router } from 'express';
import { requireAuth, requireFeature } from '../../src/middleware/auth.js';
import { contextController } from '../controllers/ContextController.js';

const router = Router();

router.use(requireAuth);
router.use(requireFeature('contexts.advanced'));

router.get('/contexts', (req, res) => contextController.getContexts(req as any, res));
router.post('/contexts', (req, res) => contextController.createContext(req as any, res));
router.post('/contexts/link-transactions', (req, res) => contextController.linkTransactions(req as any, res));
router.put('/contexts/:id', (req, res) => contextController.updateContext(req as any, res));
router.delete('/contexts/:id', (req, res) => contextController.deleteContext(req as any, res));

export default router;
