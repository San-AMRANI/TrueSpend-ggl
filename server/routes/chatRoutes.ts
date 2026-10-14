import { Router } from 'express';
import {
  chatWithAi,
  speakAiText,
  getChatModels,
  resetModelCooldowns,
} from '../controllers/ChatController.js';
import { approveAiActions } from '../controllers/AiActionController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.post('/', requireAuth, chatWithAi as any);
router.get('/models', requireAuth, getChatModels as any);
router.post('/reset-cooldown', requireAuth, resetModelCooldowns as any);
router.post('/actions', requireAuth, approveAiActions as any);
router.post('/tts', requireAuth, speakAiText as any);

export default router;
