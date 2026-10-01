import { Router } from 'express';
import { investmentController } from '../controllers/InvestmentController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get('/investments', (req, res) => investmentController.getData(req as any, res));
router.get('/investments/quotes', (req, res) => investmentController.getQuotes(req as any, res));

// Holdings
router.post('/investments/holdings', (req, res) => investmentController.createHolding(req as any, res));
router.put('/investments/holdings/:id', (req, res) => investmentController.updateHolding(req as any, res));
router.delete('/investments/holdings/:id', (req, res) => investmentController.deleteHolding(req as any, res));

// Trades (Buy / Sell / Dividend / Staking)
router.post('/investments/trades', (req, res) => investmentController.executeTrade(req as any, res));

// DCA Plans
router.post('/investments/dca-plans', (req, res) => investmentController.createDcaPlan(req as any, res));
router.put('/investments/dca-plans/:id', (req, res) => investmentController.updateDcaPlan(req as any, res));
router.delete('/investments/dca-plans/:id', (req, res) => investmentController.deleteDcaPlan(req as any, res));

export default router;
