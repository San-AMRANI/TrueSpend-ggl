import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { cycleCloseoutService } from '../services/CycleCloseoutService.js';

export class CycleCloseoutController {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await cycleCloseoutService.getSettings(req.dbUser.id);
      res.json(settings);
    } catch (error: any) {
      console.error('[CycleCloseoutController] getSettings error:', error);
      res.status(500).json({ error: 'Unable to load cycle automation settings' });
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const updated = await cycleCloseoutService.updateSettings(req.dbUser.id, req.body || {});
      res.json(updated);
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Unable to update cycle automation settings' });
    }
  }

  async getRuns(req: AuthRequest, res: Response) {
    try {
      const rawType = typeof req.query.runType === 'string' ? req.query.runType : undefined;
      const runType = rawType === 'monthly' || rawType === 'yearly' ? rawType : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      const runs = await cycleCloseoutService.getRuns(req.dbUser.id, { runType, limit });
      res.json({ runs });
    } catch (error: any) {
      console.error('[CycleCloseoutController] getRuns error:', error);
      res.status(500).json({ error: 'Unable to load cycle closeout history' });
    }
  }

  async runYearlyCloseout(req: AuthRequest, res: Response) {
    try {
      const year = Number(req.body?.year ?? new Date().getUTCFullYear());
      const forceRefresh = req.body?.forceRefresh !== false;
      const run = await cycleCloseoutService.runYearlyCloseout(req.dbUser.id, year, {
        triggerSource: 'manual_run',
        forceRefresh,
      });
      res.json({ run });
    } catch (error: any) {
      res.status(400).json({ error: error?.message || 'Unable to generate yearly closeout audit' });
    }
  }
}

export const cycleCloseoutController = new CycleCloseoutController();
