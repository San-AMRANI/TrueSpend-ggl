import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { behavioralService } from '../services/BehavioralService.js';

export class BehavioralController {
  async getInsights(req: AuthRequest, res: Response) {
    try {
      const insights = await behavioralService.getInsights(req.dbUser.id);
      res.json(insights);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const behavioralController = new BehavioralController();
