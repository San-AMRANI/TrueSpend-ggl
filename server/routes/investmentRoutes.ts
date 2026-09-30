import { Router } from 'express';
import { investmentController } from '../controllers/InvestmentController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

// Portfolio
router.get('/portfolio', requireAuth, investmentController.getPortfolio);

// Holdings
router.post('/holdings', requireAuth, investmentController.createHolding);
router.put('/holdings/:id', requireAuth, investmentController.updateHolding);
router.delete('/holdings/:id', requireAuth, investmentController.deleteHolding);

// Trade execution
router.post('/trade/buy', requireAuth, investmentController.executeBuyOrder);
router.post('/trade/sell', requireAuth, investmentController.executeSellOrder);
router.post('/income/dividend', requireAuth, investmentController.recordDividend);
router.post('/income/staking', requireAuth, investmentController.recordStakingYield);

// Prices
router.put('/prices/manual', requireAuth, investmentController.setManualPrice);
router.post('/prices/refresh', requireAuth, investmentController.refreshPrices);

// DCA Plans
router.get('/dca', requireAuth, investmentController.getDcaPlans);
router.post('/dca', requireAuth, investmentController.createDcaPlan);
router.put('/dca/:id', requireAuth, investmentController.updateDcaPlan);
router.delete('/dca/:id', requireAuth, investmentController.deleteDcaPlan);

// Net Worth History
router.get('/net-worth/history', requireAuth, investmentController.getNetWorthHistory);

// Safe-to-Invest
router.get('/safe-to-invest', requireAuth, investmentController.getSafeToInvest);

export default router;
