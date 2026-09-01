import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { goalService } from '../services/GoalService.js';

export class GoalController {
  async getGoals(req: AuthRequest, res: Response) {
    try {
      res.json(await goalService.getGoals(req.dbUser.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async createGoal(req: AuthRequest, res: Response) {
    try {
      const goal = await goalService.createGoal(req.dbUser.id, req.body);
      res.status(201).json(goal);
    } catch (e: any) {
      console.error(e);
      res.status(e.message?.includes('required') ? 400 : 500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async updateGoal(req: AuthRequest, res: Response) {
    try {
      const goal = await goalService.updateGoal(req.dbUser.id, req.params.id, req.body);
      res.json(goal);
    } catch (e: any) {
      console.error(e);
      res.status(e.message === 'Goal not found' ? 404 : 500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async deleteGoal(req: AuthRequest, res: Response) {
    try {
      res.json(await goalService.deleteGoal(req.dbUser.id, req.params.id));
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async contributeToGoal(req: AuthRequest, res: Response) {
    try {
      const amount = parseFloat(req.body.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return res.status(400).json({ error: 'amount must be a positive number' });
      }
      const goal = await goalService.contributeToGoal(req.dbUser.id, req.params.id, amount);
      res.json(goal);
    } catch (e: any) {
      console.error(e);
      res.status(e.message === 'Goal not found' ? 404 : 500).json({ error: e.message || 'Internal Server Error' });
    }
  }
}

export const goalController = new GoalController();
