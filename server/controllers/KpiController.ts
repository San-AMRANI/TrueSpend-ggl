import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { kpiService } from '../services/KpiService.js';
import { dashboardBootstrapService } from '../services/DashboardBootstrapService.js';

export class KpiController {
  async getKpis(req: AuthRequest, res: Response) {
    try {
      const kpis = await kpiService.getKpisForUser(req.dbUser);
      res.json(kpis);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error', details: e?.message, stack: e?.stack });
    }
  }

  async getBootstrap(req: AuthRequest, res: Response) {
    try {
      const data = await dashboardBootstrapService.getBootstrapData(req.dbUser);
      res.json(data);
    } catch (e: any) {
      console.error('getBootstrap error:', e?.message || e);
      res.status(500).json({ error: 'Internal Server Error', details: e?.message });
    }
  }
}

export const kpiController = new KpiController();
