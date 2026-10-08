import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { monthlyCloseService } from '../services/MonthlyCloseService.js';

export class MonthlyCloseController {
  async closeMonth(req: AuthRequest, res: Response) {
    try {
      const { periodId } = req.body;
      const result = await monthlyCloseService.closeMonth(req.dbUser.id, periodId, req.dbUser);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const monthlyCloseController = new MonthlyCloseController();
