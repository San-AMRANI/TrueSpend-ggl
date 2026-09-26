import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { resilienceService } from '../services/ResilienceService.js';

export class ResilienceController {
  async getAudit(req: AuthRequest, res: Response) {
    try {
      const audit = await resilienceService.getAuditForUser(req.dbUser.id, req.dbUser);
      res.json(audit);
    } catch (e) {
      console.error('Error in ResilienceController.getAudit:', e);
      res.status(500).json({ error: 'Failed to generate resilience audit' });
    }
  }

  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const {
        emergencyTargetMonths,
        stressJobLossMonths,
        stressEmergencyExpense,
        stressInflationRate,
        essentialExpensesRatio,
        customEssentialMonthly,
        microLeakThreshold,
        notes,
      } = req.body;

      await resilienceService.updateProfile(req.dbUser.id, {
        emergencyTargetMonths,
        stressJobLossMonths,
        stressEmergencyExpense,
        stressInflationRate,
        essentialExpensesRatio,
        customEssentialMonthly,
        microLeakThreshold,
        notes,
      });

      const updatedAudit = await resilienceService.getAuditForUser(req.dbUser.id, req.dbUser);
      res.json(updatedAudit);
    } catch (e) {
      console.error('Error in ResilienceController.updateProfile:', e);
      res.status(500).json({ error: 'Failed to update resilience profile' });
    }
  }

  async simulateCustom(req: AuthRequest, res: Response) {
    try {
      const result = await resilienceService.simulateCustom(req.dbUser.id, req.body, req.dbUser);
      res.json(result);
    } catch (e) {
      console.error('Error in ResilienceController.simulateCustom:', e);
      res.status(500).json({ error: 'Failed to run custom stress simulation' });
    }
  }
}

export const resilienceController = new ResilienceController();
