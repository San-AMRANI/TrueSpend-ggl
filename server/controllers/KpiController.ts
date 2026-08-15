import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { kpiService } from '../services/KpiService.js';

export class KpiController {
  async getKpis(req: AuthRequest, res: Response) {
    try {
      const kpis = await kpiService.getKpisForUser(req.dbUser);
      res.json(kpis);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const kpiController = new KpiController();
