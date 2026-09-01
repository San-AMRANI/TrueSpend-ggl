import { Request, Response } from 'express';
import { PushService } from '../services/PushService';
import dotenv from 'dotenv';

dotenv.config();

const pushService = new PushService();

export class NotificationController {
  
  async getPublicKey(req: Request, res: Response) {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
  }

  async subscribe(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const subscription = req.body;
      const userAgent = req.headers['user-agent'];

      if (!subscription || !subscription.endpoint || !subscription.keys) {
        return res.status(400).json({ error: 'Invalid subscription object' });
      }

      await pushService.saveSubscription(user.id, subscription, userAgent);
      res.status(201).json({ message: 'Subscription saved successfully' });
    } catch (error) {
      console.error('Error saving subscription:', error);
      res.status(500).json({ error: 'Failed to save subscription' });
    }
  }

  async unsubscribe(req: Request, res: Response) {
    try {
      const { endpoint } = req.body;
      if (!endpoint) {
        return res.status(400).json({ error: 'Missing endpoint' });
      }
      await pushService.deleteSubscription(endpoint);
      res.status(200).json({ message: 'Subscription removed' });
    } catch (error) {
      console.error('Error removing subscription:', error);
      res.status(500).json({ error: 'Failed to remove subscription' });
    }
  }

  async getPreferences(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const prefs = await pushService.getPreferences(user.id);
      res.json(prefs);
    } catch (error) {
      console.error('Error getting preferences:', error);
      res.status(500).json({ error: 'Failed to get preferences' });
    }
  }

  async updatePreferences(req: Request, res: Response) {
    try {
      const user = (req as any).user;
      const payload = req.body;
      const prefs = await pushService.updatePreferences(user.id, payload);
      res.json(prefs);
    } catch (error) {
      console.error('Error updating preferences:', error);
      res.status(500).json({ error: 'Failed to update preferences' });
    }
  }
}
