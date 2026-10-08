import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { CommitmentController } from '../controllers/CommitmentController.js';

const router = Router();
const controller = new CommitmentController();

router.get('/commitments', requireAuth, controller.getCommitments);
router.post('/commitments', requireAuth, controller.createCommitment);
router.put('/commitments/:id', requireAuth, controller.updateCommitment);
router.delete('/commitments/:id', requireAuth, controller.deleteCommitment);

export default router;
