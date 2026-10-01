import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { subscriptionController } from '../controllers/SubscriptionController.js';

const router = Router();

router.get('/subscriptions', requireAuth, (req, res) => subscriptionController.getSubscriptions(req as any, res));
router.get('/subscriptions/detect', requireAuth, (req, res) => subscriptionController.detectSubscriptions(req as any, res));
router.post('/subscriptions', requireAuth, (req, res) => subscriptionController.createSubscription(req as any, res));
router.put('/subscriptions/:id', requireAuth, (req, res) => subscriptionController.updateSubscription(req as any, res));
router.delete('/subscriptions/:id', requireAuth, (req, res) => subscriptionController.deleteSubscription(req as any, res));
router.post('/subscriptions/:id/pay', requireAuth, (req, res) => subscriptionController.logPayment(req as any, res));

export default router;
