import { Router } from 'express';
import { chatWithAi } from '../controllers/ChatController.js';
import { approveAiActions, cancelAiActions } from '../controllers/AiActionController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.post('/', requireAuth, chatWithAi as any);
router.post('/actions', requireAuth, approveAiActions as any);
router.post('/actions/cancel', requireAuth, cancelAiActions as any);

export default router;
