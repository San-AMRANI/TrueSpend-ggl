import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { goalService } from '../services/GoalService.js';

export class GoalController {
  async getGoals(req: AuthRequest, res: Response) {
    try {
      const goals = await goalService.getGoalsForUser(req.dbUser.id);
      res.json(goals);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async createGoal(req: AuthRequest, res: Response) {
    try {
      const result = await goalService.createGoal(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error(e);
      res.status(400).json({ error: e.message || 'Unable to create goal' });
    }
  }

  async updateGoal(req: AuthRequest, res: Response) {
    try {
      const result = await goalService.updateGoal(req.params.id, req.dbUser.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Goal not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to update goal' });
    }
  }

  async contributeToGoal(req: AuthRequest, res: Response) {
    try {
      const result = await goalService.contributeToGoal(req.params.id, req.dbUser.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Goal not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to contribute to goal' });
    }
  }

  async withdrawFromGoal(req: AuthRequest, res: Response) {
    try {
      const result = await goalService.withdrawFromGoal(req.params.id, req.dbUser.id, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Goal not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to withdraw from goal' });
    }
  }

  async deleteGoal(req: AuthRequest, res: Response) {
    try {
      const result = await goalService.deleteGoal(req.params.id, req.dbUser.id);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      const status = e.message === 'Goal not found' ? 404 : 400;
      res.status(status).json({ error: e.message || 'Unable to delete goal' });
    }
  }
}

export const goalController = new GoalController();
