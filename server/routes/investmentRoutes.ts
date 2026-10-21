import { Router } from 'express';
import { investmentController } from '../controllers/InvestmentController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/investments', (req, res) => investmentController.getData(req as any, res));
router.get('/investments/stocks/search', (req, res) => investmentController.searchStocks(req as any, res));

// Stock Positions
router.post('/investments/positions', (req, res) => investmentController.upsertPosition(req as any, res));
router.put('/investments/positions/:id', (req, res) => investmentController.updatePosition(req as any, res));
router.delete('/investments/positions/:id', (req, res) => investmentController.deletePosition(req as any, res));

// Stock Orders (BUY / SELL / DIVIDEND with TrueSpend Wallet Sync)
router.post('/investments/orders', (req, res) => investmentController.executeOrder(req as any, res));
router.delete('/investments/orders/:id', (req, res) => investmentController.deleteOrder(req as any, res));

// Payday Batch Allocation
router.post('/investments/payday-allocate', (req, res) => investmentController.executePaydayBatchBuy(req as any, res));

export default router;
