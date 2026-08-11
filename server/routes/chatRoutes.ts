import { Router } from 'express';
import { chatWithAi } from '../controllers/ChatController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.post('/', requireAuth, chatWithAi as any);

export default router;
