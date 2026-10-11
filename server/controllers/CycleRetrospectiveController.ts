import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { cycleRetrospectiveService } from '../services/CycleRetrospectiveService.js';

export class CycleRetrospectiveController {
  async getCycles(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser.id;
      const cycles = await cycleRetrospectiveService.getAvailableCycles(userId, req.dbUser);
      res.json(cycles);
    } catch (e: any) {
      console.error('Error fetching available cycles:', e);
      res.status(500).json({ error: 'Failed to fetch financial cycles', details: e?.message });
    }
  }

  async getRetrospective(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser.id;
      const cycleId = req.query.cycleId as string | undefined;
      const preferredModel = (req.query.model as string) || 'auto';
      const forceRefresh = req.query.forceRefresh === 'true';

      const data = await cycleRetrospectiveService.getCycleRetrospective(userId, req.dbUser, {
        cycleId,
        preferredModel,
        allowFallback: true,
        forceRefresh,
      });

      res.json(data);
    } catch (e: any) {
      console.error('Error computing cycle retrospective:', e);
      res.status(500).json({ error: 'Failed to generate cycle retrospective', details: e?.message });
    }
  }

  async generateRetrospective(req: AuthRequest, res: Response) {
    try {
      const userId = req.dbUser.id;
      const { cycleId, preferredModel, allowFallback, forceRefresh } = req.body;

      const data = await cycleRetrospectiveService.getCycleRetrospective(userId, req.dbUser, {
        cycleId,
        preferredModel: preferredModel || 'auto',
        allowFallback: allowFallback !== false,
        forceRefresh: forceRefresh === true,
      });

      res.json(data);
    } catch (e: any) {
      console.error('Error generating cycle retrospective:', e);
      res.status(500).json({ error: 'Failed to generate cycle retrospective', details: e?.message });
    }
  }
}

export const cycleRetrospectiveController = new CycleRetrospectiveController();
