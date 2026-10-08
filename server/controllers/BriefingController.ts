import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { briefingService } from '../services/BriefingService.js';

export class BriefingController {
  async getBriefing(req: AuthRequest, res: Response) {
    try {
      const result = await briefingService.getBriefing(req.dbUser.id, req.dbUser);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const briefingController = new BriefingController();
