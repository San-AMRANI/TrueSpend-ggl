import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { categoryBudgetService } from '../services/CategoryBudgetService.js';

export class CategoryBudgetController {
  async getBudgets(req: AuthRequest, res: Response) {
    try {
      res.json(await categoryBudgetService.getBudgetsForUser(req.dbUser.id));
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async upsertBudget(req: AuthRequest, res: Response) {
    try {
      const budget = await categoryBudgetService.upsertBudget(req.dbUser.id, req.body);
      res.status(200).json(budget);
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || 'Unable to save budget' });
    }
  }

  async copyPreviousMonth(req: AuthRequest, res: Response) {
    try {
      res.json(await categoryBudgetService.copyPreviousMonth(req.dbUser.id, req.body.year, req.body.month));
    } catch (error: any) {
      console.error(error);
      res.status(400).json({ error: error.message || 'Unable to copy budgets' });
    }
  }

  async deleteBudget(req: AuthRequest, res: Response) {
    try {
      const { id } = req.params;
      if (!id) { res.status(400).json({ error: 'Budget id is required' }); return; }
      const deleted = await categoryBudgetService.deleteBudget(req.dbUser.id, id);
      res.json(deleted);
    } catch (error: any) {
      console.error(error);
      res.status(404).json({ error: error.message || 'Unable to delete budget' });
    }
  }
}

export const categoryBudgetController = new CategoryBudgetController();
