import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { investmentService } from '../services/InvestmentService.js';

function applyPrivateNoCacheHeaders(res: Response) {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
}

export class InvestmentController {
  async getData(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const forceRefresh = req.query.refresh === 'true';
      const data = await investmentService.getInvestmentsData(req.dbUser.id, { forceRefresh });
      res.json(data);
    } catch (e: any) {
      console.error('InvestmentController.getData error:', e?.message || 'Unknown error');
      res.status(500).json({ error: e?.message || 'Internal Server Error' });
    }
  }

  async getBinanceAccount(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const forceRefresh = req.query.refresh === 'true';
      const overview = await investmentService.getBinanceAccountOverview(req.dbUser.id, forceRefresh);
      res.json(overview);
    } catch (e: any) {
      console.error('InvestmentController.getBinanceAccount error:', e?.message || 'Unknown error');
      res.status(500).json({ error: e?.message || 'Failed to fetch Binance Spot account overview' });
    }
  }

  async getBinanceTrades(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const rawSymbol = typeof req.query.symbol === 'string' ? req.query.symbol.trim().toUpperCase() : '';
      if (!rawSymbol || !/^[A-Z0-9]{4,20}$/.test(rawSymbol)) {
        return res.status(400).json({
          error: 'Invalid or missing trading pair symbol. Expected uppercase alphanumeric symbol such as BTCUSDT or ETHUSDT.',
        });
      }

      const limit = req.query.limit !== undefined ? Number(req.query.limit) : 100;
      const startTime = req.query.startTime !== undefined ? Number(req.query.startTime) : undefined;
      const endTime = req.query.endTime !== undefined ? Number(req.query.endTime) : undefined;
      const fromId = req.query.fromId !== undefined ? Number(req.query.fromId) : undefined;
      const forceRefresh = req.query.refresh === 'true';

      const summary = await investmentService.getBinanceSymbolTrades(rawSymbol, {
        limit,
        startTime,
        endTime,
        fromId,
        forceRefresh,
      });

      return res.json(summary);
    } catch (e: any) {
      console.error('InvestmentController.getBinanceTrades error:', e?.message || 'Unknown error');
      return res.status(400).json({ error: e?.message || 'Failed to fetch Binance personal trade history' });
    }
  }

  async syncBinanceWallet(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const mode =
        req.body?.mode === 'full_spot_balance' ? 'full_spot_balance' : 'stablecoins_only';
      const walletId = typeof req.body?.walletId === 'string' ? req.body.walletId : undefined;
      const result = await investmentService.syncBinanceWithWallet(req.dbUser.id, {
        walletId,
        mode,
      });
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.syncBinanceWallet error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to synchronize Binance balance with TrueSpend wallet' });
    }
  }

  async logWalletCapitalTransfer(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const direction = req.body?.direction === 'withdrawal' ? 'withdrawal' : 'deposit';
      const amountMad = Number(req.body?.amountMad);
      const bankWalletId = typeof req.body?.bankWalletId === 'string' ? req.body.bankWalletId : undefined;
      const investmentWalletId =
        typeof req.body?.investmentWalletId === 'string' ? req.body.investmentWalletId : undefined;
      const notes = typeof req.body?.notes === 'string' ? req.body.notes : undefined;

      const result = await investmentService.logWalletCapitalTransfer(req.dbUser.id, {
        direction,
        bankWalletId,
        investmentWalletId,
        amountMad,
        notes,
      });
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.logWalletCapitalTransfer error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to log capital transfer' });
    }
  }

  async searchStocks(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const q = (req.query.q as string) || '';
      const results = await investmentService.searchStocks(q);
      res.json(results);
    } catch (e: any) {
      console.error('InvestmentController.searchStocks error:', e?.message || 'Unknown error');
      res.status(500).json({ error: e?.message || 'Failed to search stocks' });
    }
  }

  async upsertPosition(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const position = await investmentService.upsertStockPosition(req.dbUser.id, req.body);
      res.status(201).json(position);
    } catch (e: any) {
      console.error('InvestmentController.upsertPosition error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to save stock position' });
    }
  }

  async updatePosition(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const position = await investmentService.updateStockPosition(req.dbUser.id, req.params.id, req.body);
      res.json(position);
    } catch (e: any) {
      console.error('InvestmentController.updatePosition error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to update stock position' });
    }
  }

  async deletePosition(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const result = await investmentService.deleteStockPosition(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deletePosition error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to delete stock position' });
    }
  }

  async executeOrder(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const result = await investmentService.executeOrder(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.executeOrder error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to execute stock order' });
    }
  }

  async deleteOrder(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const result = await investmentService.deleteOrder(req.dbUser.id, req.params.id);
      res.json(result);
    } catch (e: any) {
      console.error('InvestmentController.deleteOrder error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to delete stock order' });
    }
  }

  async executePaydayBatchBuy(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const result = await investmentService.executePaydayBatchBuy(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.executePaydayBatchBuy error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to execute payday allocation' });
    }
  }

  async fundInvestmentWallet(req: AuthRequest, res: Response) {
    applyPrivateNoCacheHeaders(res);
    try {
      const result = await investmentService.fundInvestmentWallet(req.dbUser.id, req.body);
      res.status(201).json(result);
    } catch (e: any) {
      console.error('InvestmentController.fundInvestmentWallet error:', e?.message || 'Unknown error');
      res.status(400).json({ error: e?.message || 'Failed to fund investment wallet' });
    }
  }
}

export const investmentController = new InvestmentController();

