import { Router } from 'express';
import { investmentController } from '../controllers/InvestmentController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

// Enforce authentication + server-side RBAC on all investment & Binance routes
router.use(requireAuth);

// Prevent shared or public caching of private financial responses
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
  res.setHeader('Vary', 'Authorization');
  next();
});

router.get('/investments', (req, res) => investmentController.getData(req as any, res));
router.get('/investments/stocks/search', (req, res) => investmentController.searchStocks(req as any, res));

// Read-Only Binance Spot Account & Personal Trade History Endpoints (Ed25519 Server-Signed)
router.get('/investments/binance/account', (req, res) => investmentController.getBinanceAccount(req as any, res));
router.get('/investments/binance/trades', (req, res) => investmentController.getBinanceTrades(req as any, res));

// TrueSpend Wallet Synchronization & Capital Flows (Local Ledger Only — Never Executes Binance Trades/Withdrawals)
router.post('/investments/binance/sync-wallet', (req, res) => investmentController.syncBinanceWallet(req as any, res));
router.post('/investments/wallet-transfer', (req, res) => investmentController.logWalletCapitalTransfer(req as any, res));

// Off-Exchange / Local Stock Positions Ledger
router.post('/investments/positions', (req, res) => investmentController.upsertPosition(req as any, res));
router.put('/investments/positions/:id', (req, res) => investmentController.updatePosition(req as any, res));
router.delete('/investments/positions/:id', (req, res) => investmentController.deletePosition(req as any, res));

// Local Stock & Asset Order Ledger (BUY / SELL / DIVIDEND with TrueSpend Wallet Sync)
router.post('/investments/orders', (req, res) => investmentController.executeOrder(req as any, res));
router.delete('/investments/orders/:id', (req, res) => investmentController.deleteOrder(req as any, res));

// Payday Batch Allocation & Brokerage Wallet Funding
router.post('/investments/payday-allocate', (req, res) => investmentController.executePaydayBatchBuy(req as any, res));
router.post('/investments/fund-wallet', (req, res) => investmentController.fundInvestmentWallet(req as any, res));

export default router;

