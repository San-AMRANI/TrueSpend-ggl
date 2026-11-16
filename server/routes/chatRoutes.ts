import { Router } from 'express';
import {
  chatWithAi,
  speakAiText,
  getChatModels,
  resetModelCooldowns,
} from '../controllers/ChatController.js';
import { approveAiActions, simulateAiActions } from '../controllers/AiActionController.js';
import { requireAuth, requireFeature } from '../../src/middleware/auth.js';

const router = Router();

router.post('/', requireAuth, requireFeature('ai.basic'), chatWithAi as any);
router.get('/models', requireAuth, getChatModels as any);
router.post('/reset-cooldown', requireAuth, resetModelCooldowns as any);
router.post('/actions', requireAuth, requireFeature('ai.basic'), approveAiActions as any);
router.post('/simulate-actions', requireAuth, requireFeature('ai.basic'), simulateAiActions as any);
router.post('/tts', requireAuth, requireFeature('ai.basic'), speakAiText as any);

export default router;
