import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { insightsService } from '../services/InsightsService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';

export class InsightsController {
  async getInsights(req: AuthRequest, res: Response) {
    try {
      const payrolls = await payrollRepository.findAllByUserId(req.dbUser.id);
      const insights = await insightsService.getInsights(req.dbUser.id, payrolls);
      res.json(insights);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const insightsController = new InsightsController();
