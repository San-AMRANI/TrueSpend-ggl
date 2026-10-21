import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { investmentService } from '../services/InvestmentService.js';

export class InvestmentController {
  async getData(req: AuthRequest, res: Response) {
    try {
      const data = await investmentService.getInvestmentsData(req.dbUser.id);
      res.json(data);
    } catch (e: any) {
      console.error('InvestmentController.getData error:', e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async searchStocks(req: AuthRequest, res: Response) {
    try {
      const q = (req.query.q as string) || '';
      const results = await investmentService.searchStocks(q);
      res.json(results);
    } catch (e: any) {
      console.error('InvestmentController.searchStocks error:', e);
      res.status(500).json({ error: e.message || 'Failed to search stocks' });
    }
  }

  async upsertPosition(req: AuthRequest, res: Response) {
    try {
      const position = await investmentService.upsertStockPosition(req.dbUser.id, req.body);
      res.status(201).json(position);
    } catch (e: any) {
      console.error('InvestmentController.upsertPosition error:', e);
      res.status(400).json({ error: e.message || 'Failed to save stock position' });
    }
  }

  async updatePosition(req: AuthRequest, res: Response) {
    try {
      const position = await investmentService.updateStockPosition(req.dbUser.id, req.params.id, req.body);
      res.json(position);
    } catch (e: any) {
      console.error('InvestmentController.updatePosition error:', e);
      res.status(400).json({ error: e.message || 'Failed to update stock position' });
    }
  }

  async deletePosition(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.deleteStockPosition(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deletePosition error:', e);
      res.status(400).json({ error: e.message || 'Failed to delete stock position' });
    }
  }

  async executeOrder(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.executeOrder(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.executeOrder error:', e);
      res.status(400).json({ error: e.message || 'Failed to execute stock order' });
    }
  }

  async deleteOrder(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.deleteOrder(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deleteOrder error:', e);
      res.status(400).json({ error: e.message || 'Failed to delete stock order' });
    }
  }

  async executePaydayBatchBuy(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.executePaydayBatchBuy(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.executePaydayBatchBuy error:', e);
      res.status(400).json({ error: e.message || 'Failed to execute payday allocation' });
    }
  }
}

export const investmentController = new InvestmentController();
