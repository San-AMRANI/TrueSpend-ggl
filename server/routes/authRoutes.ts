import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.post('/login', (req, res) => authController.login(req, res));
router.get('/auth/me', requireAuth, (req, res) => authController.me(req, res));

export default router;
