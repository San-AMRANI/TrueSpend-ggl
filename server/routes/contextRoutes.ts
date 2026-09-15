import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { contextController } from '../controllers/ContextController.js';

const router = Router();

router.get('/contexts', requireAuth, (req, res) => contextController.getContexts(req as any, res));
router.post('/contexts', requireAuth, (req, res) => contextController.createContext(req as any, res));
router.post('/contexts/link-transactions', requireAuth, (req, res) => contextController.linkTransactions(req as any, res));
router.put('/contexts/:id', requireAuth, (req, res) => contextController.updateContext(req as any, res));
router.delete('/contexts/:id', requireAuth, (req, res) => contextController.deleteContext(req as any, res));

export default router;
