import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { decisionService } from '../services/DecisionService.js';

export class DecisionController {
  async evaluatePurchase(req: AuthRequest, res: Response) {
    try {
      const decision = req.body; // should match DecisionContext
      const result = await decisionService.evaluatePurchase(req.dbUser.id, req.dbUser, decision);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async compareScenarios(req: AuthRequest, res: Response) {
    try {
      const scenarios = req.body.scenarios; // should match Scenario[]
      const result = await decisionService.compareScenarios(req.dbUser.id, req.dbUser, scenarios);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async analyzeAccuracy(req: AuthRequest, res: Response) {
    try {
      const record = req.body; // should match ForecastRecord
      const result = await decisionService.analyzeAccuracy(req.dbUser.id, record);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async evaluateRules(req: AuthRequest, res: Response) {
    try {
      const events = req.body.events; // should match FinancialRuleEvent[]
      const result = await decisionService.runRules(req.dbUser.id, req.dbUser, events);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const decisionController = new DecisionController();
