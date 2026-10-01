import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { financialOperatingSystemController as controller } from '../controllers/FinancialOperatingSystemController.js';

const router = Router();
const guarded = (handler: (req: any, res: any) => Promise<unknown>) => (req: any, res: any) => handler(req, res);

router.get('/financial-profile', requireAuth, guarded((req, res) => controller.getProfile(req, res)));
router.put('/financial-profile', requireAuth, guarded((req, res) => controller.updateProfile(req, res)));
router.post('/financial-profile/checkup', requireAuth, guarded((req, res) => controller.checkup(req, res)));
router.get('/budget-category-preferences', requireAuth, guarded((req, res) => controller.listBudgetPreferences(req, res)));
router.put('/budget-category-preferences', requireAuth, guarded((req, res) => controller.updateBudgetPreference(req, res)));
router.get('/financial-home', requireAuth, guarded((req, res) => controller.financialHome(req, res)));
router.get('/financial-snapshots', requireAuth, guarded((req, res) => controller.listSnapshots(req, res)));
router.post('/financial-snapshots/refresh', requireAuth, guarded((req, res) => controller.refreshSnapshot(req, res)));

router.get('/financial-plans', requireAuth, guarded((req, res) => controller.listPlans(req, res)));
router.post('/financial-plans/draft', requireAuth, guarded((req, res) => controller.draftPlan(req, res)));
router.get('/financial-plans/:id', requireAuth, guarded((req, res) => controller.getPlan(req, res)));
router.put('/financial-plans/:id', requireAuth, guarded((req, res) => controller.editPlan(req, res)));
router.post('/financial-plans/:id/approve', requireAuth, guarded((req, res) => controller.approvePlan(req, res)));
router.post('/financial-plans/:id/replan', requireAuth, guarded((req, res) => controller.replan(req, res)));
router.post('/financial-plans/:id/cancel', requireAuth, guarded((req, res) => controller.cancelPlan(req, res)));

router.get('/recommendations', requireAuth, guarded((req, res) => controller.recommendations(req, res)));
router.post('/recommendations/:id/viewed', requireAuth, guarded((req, res) => controller.recommendationStatus(req, res, 'Viewed')));
router.post('/recommendations/:id/dismiss', requireAuth, guarded((req, res) => controller.recommendationStatus(req, res, 'Dismissed')));
router.post('/recommendations/:id/snooze', requireAuth, guarded((req, res) => controller.recommendationStatus(req, res, 'Snoozed')));
router.post('/recommendations/:id/approve', requireAuth, guarded((req, res) => controller.approveRecommendation(req, res)));

router.get('/investment-accounts', requireAuth, guarded((req, res) => controller.listAccounts(req, res)));
router.post('/investment-accounts', requireAuth, guarded((req, res) => controller.createAccount(req, res)));
router.put('/investment-accounts/:id', requireAuth, guarded((req, res) => controller.updateAccount(req, res)));
router.delete('/investment-accounts/:id', requireAuth, guarded((req, res) => controller.archiveAccount(req, res)));
router.post('/investment-accounts/:id/fund', requireAuth, guarded((req, res) => controller.fundAccount(req, res)));
router.post('/investment-accounts/:id/withdraw', requireAuth, guarded((req, res) => controller.withdrawAccount(req, res)));
router.get('/investment-assets', requireAuth, guarded((req, res) => controller.listAssets(req, res)));
router.post('/investment-assets', requireAuth, guarded((req, res) => controller.createAsset(req, res)));
router.get('/investment-events', requireAuth, guarded((req, res) => controller.listEvents(req, res)));
router.post('/investment-events', requireAuth, guarded((req, res) => controller.createEvent(req, res)));
router.post('/investment-events/:id/correct', requireAuth, guarded((req, res) => controller.correctEvent(req, res)));
router.get('/portfolio', requireAuth, guarded((req, res) => controller.portfolio(req, res)));
router.get('/portfolio/performance', requireAuth, guarded((req, res) => controller.portfolioPerformance(req, res)));
router.post('/portfolio/prices', requireAuth, guarded((req, res) => controller.manualPrice(req, res)));
router.get('/market-data/assets/search', requireAuth, guarded((req, res) => controller.searchMarketAssets(req, res)));
router.get('/market-data/assets/:coinGeckoId', requireAuth, guarded((req, res) => controller.marketAsset(req, res)));
router.get('/market-data/assets/:coinGeckoId/history', requireAuth, guarded((req, res) => controller.marketHistory(req, res)));
router.post('/market-data/prices/refresh', requireAuth, guarded((req, res) => controller.refreshPrices(req, res)));
router.get('/market-data/status', requireAuth, guarded((req, res) => controller.marketStatus(req, res)));

export default router;
