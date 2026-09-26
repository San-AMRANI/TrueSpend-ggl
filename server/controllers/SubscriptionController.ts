import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { subscriptionService } from '../services/SubscriptionService.js';

export class SubscriptionController {
  async getSubscriptions(req: AuthRequest, res: Response) {
    try {
      const subs = await subscriptionService.getSubscriptionsForUser(req.dbUser.id);
      res.json(subs);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async createSubscription(req: AuthRequest, res: Response) {
    try {
      const result = await subscriptionService.createSubscription(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Unable to create subscription' });
    }
  }

  async updateSubscription(req: AuthRequest, res: Response) {
    try {
      const result = await subscriptionService.updateSubscription(req.dbUser.id, req.params.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Subscription not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to update subscription' });
    }
  }

  async deleteSubscription(req: AuthRequest, res: Response) {
    try {
      const result = await subscriptionService.deleteSubscription(req.dbUser.id, req.params.id);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Subscription not found' ? 404 : 500;
      res.status(status).json({ error: e.message || 'Unable to delete subscription' });
    }
  }

  async logPayment(req: AuthRequest, res: Response) {
    try {
      const { walletId, date } = req.body || {};
      const result = await subscriptionService.logSubscriptionPayment(req.dbUser.id, req.params.id, walletId, date);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Subscription not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to log subscription payment' });
    }
  }

  async detectSubscriptions(req: AuthRequest, res: Response) {
    try {
      const detected = await subscriptionService.detectSubscriptions(req.dbUser.id);
      res.json(detected);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Unable to detect recurring subscriptions' });
    }
  }
}

export const subscriptionController = new SubscriptionController();
