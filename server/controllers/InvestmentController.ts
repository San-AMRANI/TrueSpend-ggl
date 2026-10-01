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

  async createHolding(req: AuthRequest, res: Response) {
    try {
      const holding = await investmentService.createHolding(req.dbUser.id, req.body);
      res.status(201).json(holding);
    } catch (e: any) {
      console.error('InvestmentController.createHolding error:', e);
      res.status(400).json({ error: e.message || 'Failed to create holding' });
    }
  }

  async updateHolding(req: AuthRequest, res: Response) {
    try {
      const holding = await investmentService.updateHolding(req.dbUser.id, req.params.id, req.body);
      res.json(holding);
    } catch (e: any) {
      console.error('InvestmentController.updateHolding error:', e);
      res.status(400).json({ error: e.message || 'Failed to update holding' });
    }
  }

  async deleteHolding(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.deleteHolding(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deleteHolding error:', e);
      res.status(400).json({ error: e.message || 'Failed to delete holding' });
    }
  }

  async executeTrade(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.executeTrade(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.executeTrade error:', e);
      res.status(400).json({ error: e.message || 'Failed to execute trade' });
    }
  }

  async createDcaPlan(req: AuthRequest, res: Response) {
    try {
      const plan = await investmentService.createDcaPlan(req.dbUser.id, req.body);
      res.status(201).json(plan);
    } catch (e: any) {
      console.error('InvestmentController.createDcaPlan error:', e);
      res.status(400).json({ error: e.message || 'Failed to create DCA plan' });
    }
  }

  async updateDcaPlan(req: AuthRequest, res: Response) {
    try {
      const plan = await investmentService.updateDcaPlan(req.dbUser.id, req.params.id, req.body);
      res.json(plan);
    } catch (e: any) {
      console.error('InvestmentController.updateDcaPlan error:', e);
      res.status(400).json({ error: e.message || 'Failed to update DCA plan' });
    }
  }

  async deleteDcaPlan(req: AuthRequest, res: Response) {
    try {
      const result = await investmentService.deleteDcaPlan(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deleteDcaPlan error:', e);
      res.status(400).json({ error: e.message || 'Failed to delete DCA plan' });
    }
  }

  async getQuotes(req: AuthRequest, res: Response) {
    try {
      const symbolsStr = req.query.symbols as string;
      const symbols = symbolsStr ? symbolsStr.split(',') : [];
      const quotes = await investmentService.fetchLiveQuotes(symbols);
      res.json(quotes);
    } catch (e: any) {
      console.error('InvestmentController.getQuotes error:', e);
      res.status(500).json({ error: e.message || 'Failed to fetch quotes' });
    }
  }

  async getMarketCoins(req: AuthRequest, res: Response) {
    try {
      const vsCurrency = (req.query.vs_currency as string) || 'usd';
      const perPage = parseInt((req.query.per_page as string) || '50', 10);
      const forceRefresh = req.query.refresh === 'true';
      const coins = await investmentService.getMarketCoins(vsCurrency, perPage, forceRefresh);
      res.json(coins);
    } catch (e: any) {
      console.error('InvestmentController.getMarketCoins error:', e);
      res.status(500).json({ error: e.message || 'Failed to fetch market coins' });
    }
  }

  async searchCoins(req: AuthRequest, res: Response) {
    try {
      const query = (req.query.q as string) || '';
      const results = await investmentService.searchCoins(query);
      res.json(results);
    } catch (e: any) {
      console.error('InvestmentController.searchCoins error:', e);
      res.status(500).json({ error: e.message || 'Failed to search coins' });
    }
  }

  async getSpotPrice(req: AuthRequest, res: Response) {
    try {
      const symbol = (req.query.symbol as string) || '';
      const coinId = (req.query.coin_id as string) || undefined;
      const spot = await investmentService.getSpotPrice(symbol, coinId);
      res.json(spot);
    } catch (e: any) {
      console.error('InvestmentController.getSpotPrice error:', e);
      res.status(500).json({ error: e.message || 'Failed to fetch spot price' });
    }
  }

  async getWatchlist(req: AuthRequest, res: Response) {
    try {
      const list = await investmentService.getWatchlist(req.dbUser.id);
      res.json(list);
    } catch (e: any) {
      console.error('InvestmentController.getWatchlist error:', e);
      res.status(500).json({ error: e.message || 'Failed to fetch watchlist' });
    }
  }

  async addToWatchlist(req: AuthRequest, res: Response) {
    try {
      const item = await investmentService.addToWatchlist(req.dbUser.id, req.body);
      res.status(201).json(item);
    } catch (e: any) {
      console.error('InvestmentController.addToWatchlist error:', e);
      res.status(400).json({ error: e.message || 'Failed to add to watchlist' });
    }
  }

  async removeFromWatchlist(req: AuthRequest, res: Response) {
    try {
      const coinId = req.params.coinId;
      const result = await investmentService.removeFromWatchlist(req.dbUser.id, coinId);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.removeFromWatchlist error:', e);
      res.status(400).json({ error: e.message || 'Failed to remove from watchlist' });
    }
  }
}

export const investmentController = new InvestmentController();
