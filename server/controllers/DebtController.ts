import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { debtService } from '../services/DebtService.js';

export class DebtController {
  async getDebts(req: AuthRequest, res: Response) {
    try {
      const debts = await debtService.getDebtsWithSettlements(req.dbUser.id);
      res.json(debts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async processDebt(req: AuthRequest, res: Response) {
    try {
      const result = await debtService.processDebt(req.dbUser.id, req.body);
      res.status(result.id ? 201 : 200).json(result);
    } catch (e: any) {
      console.error(e);
      if (e.message === 'Debt not found') {
        res.status(404).json({ error: 'Debt not found' });
      } else {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async updateDebt(req: AuthRequest, res: Response) {
    try {
      const debtId = req.params.id;
      const result = await debtService.updateDebt(req.dbUser.id, debtId, req.body);
      res.status(200).json(result);
    } catch (e: any) {
      console.error(e);
      if (e.message === 'Debt not found') {
        res.status(404).json({ error: 'Debt not found' });
      } else {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async deleteDebt(req: AuthRequest, res: Response) {
    try {
      const debtId = req.params.id;
      const result = await debtService.deleteDebt(req.dbUser.id, debtId);
      res.status(200).json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }
}

export const debtController = new DebtController();
