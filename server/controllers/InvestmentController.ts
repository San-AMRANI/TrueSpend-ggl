import type { Request, Response } from 'express';
import { investmentService } from '../services/InvestmentService.js';
import { marketPriceFeedService } from '../services/MarketPriceFeedService.js';

export class InvestmentController {
  // ─── Portfolio ─────────────────────────────────────────────────────────────

  getPortfolio = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const portfolio = await investmentService.getPortfolio(userId);
      res.json(portfolio);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  // ─── Holdings ─────────────────────────────────────────────────────────────

  createHolding = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, symbol, name, assetType, quantity, avgCostBasis, currency, notes } = req.body;
      if (!walletId || !symbol || !name || !assetType) {
        return res.status(400).json({ error: 'walletId, symbol, name, assetType are required' });
      }
      const holding = await investmentService.createHolding(userId, {
        walletId, symbol, name, assetType, quantity, avgCostBasis, currency, notes,
      });
      res.status(201).json(holding);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  updateHolding = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const updated = await investmentService.updateHolding(userId, id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
    }
  };

  deleteHolding = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      await investmentService.deleteHolding(userId, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
    }
  };

  // ─── Trade Execution ───────────────────────────────────────────────────────

  executeBuyOrder = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { walletId, symbol, name, assetType, holdingId, quantity, pricePerUnit, currency, date, notes } = req.body;
      if (!walletId || !symbol || !quantity || !pricePerUnit) {
        return res.status(400).json({ error: 'walletId, symbol, quantity, pricePerUnit are required' });
      }
      const result = await investmentService.executeBuyOrder(userId, {
        walletId, symbol, name, assetType: assetType || 'manual',
        holdingId, quantity: parseFloat(quantity), pricePerUnit: parseFloat(pricePerUnit),
        currency, date, notes,
      });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  };

  executeSellOrder = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { holdingId, walletId, quantity, pricePerUnit, date, notes } = req.body;
      if (!holdingId || !walletId || !quantity || !pricePerUnit) {
        return res.status(400).json({ error: 'holdingId, walletId, quantity, pricePerUnit are required' });
      }
      const result = await investmentService.executeSellOrder(userId, {
        holdingId, walletId, quantity: parseFloat(quantity), pricePerUnit: parseFloat(pricePerUnit), date, notes,
      });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  };

  recordDividend = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { holdingId, walletId, amount, date, notes } = req.body;
      if (!holdingId || !walletId || !amount) {
        return res.status(400).json({ error: 'holdingId, walletId, amount are required' });
      }
      const result = await investmentService.recordDividend(userId, {
        holdingId, walletId, amount: parseFloat(amount), date, notes,
      });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  };

  recordStakingYield = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { holdingId, walletId, quantity, amount, pricePerUnit, date, notes } = req.body;
      if (!holdingId || !walletId) {
        return res.status(400).json({ error: 'holdingId, walletId are required' });
      }
      const result = await investmentService.recordStakingYield(userId, {
        holdingId, walletId, quantity: quantity ? parseFloat(quantity) : undefined,
        amount: amount ? parseFloat(amount) : undefined,
        pricePerUnit: pricePerUnit ? parseFloat(pricePerUnit) : undefined, date, notes,
      });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  };

  // ─── Prices ────────────────────────────────────────────────────────────────

  setManualPrice = async (req: Request, res: Response) => {
    try {
      const { symbol, assetType, priceUsd } = req.body;
      if (!symbol || !assetType || priceUsd === undefined) {
        return res.status(400).json({ error: 'symbol, assetType, priceUsd are required' });
      }
      await investmentService.updateManualPrice(symbol, assetType, parseFloat(priceUsd));
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  refreshPrices = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const results = await investmentService.refreshPrices(userId);
      res.json({ success: true, prices: results });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  // ─── DCA Plans ─────────────────────────────────────────────────────────────

  getDcaPlans = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const plans = await investmentService.getDcaPlans(userId);
      res.json(plans);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  createDcaPlan = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { symbol, assetName, assetType, walletId, amount, currency, frequency, nextDate, notes } = req.body;
      if (!symbol || !assetName || !amount || !nextDate) {
        return res.status(400).json({ error: 'symbol, assetName, amount, nextDate are required' });
      }
      const plan = await investmentService.createDcaPlan(userId, {
        symbol, assetName, assetType: assetType || 'manual', walletId, amount,
        currency: currency || 'MAD', frequency: frequency || 'monthly', nextDate, notes,
      });
      res.status(201).json(plan);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  updateDcaPlan = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      const updated = await investmentService.updateDcaPlan(userId, id, req.body);
      res.json(updated);
    } catch (e: any) {
      res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
    }
  };

  deleteDcaPlan = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const { id } = req.params;
      await investmentService.deleteDcaPlan(userId, id);
      res.json({ success: true });
    } catch (e: any) {
      res.status(e.message.includes('not found') ? 404 : 500).json({ error: e.message });
    }
  };

  // ─── Net Worth ─────────────────────────────────────────────────────────────

  getNetWorthHistory = async (req: Request, res: Response) => {
    try {
      const userId = (req as any).user?.id;
      const period = (req.query.period as '6m' | '1y' | 'all') || '6m';
      const history = await investmentService.getNetWorthHistory(userId, period);
      res.json(history);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };

  // ─── Safe-to-Invest ────────────────────────────────────────────────────────

  getSafeToInvest = async (req: Request, res: Response) => {
    try {
      // This is computed from KPI data; the client can call /api/kpis which already includes it
      res.json({ message: 'Use /api/kpis for safeToInvestBreakdown' });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  };
}

export const investmentController = new InvestmentController();
