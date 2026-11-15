import { Router } from 'express';
import authRoutes from './authRoutes.js';
import kpiRoutes from './kpiRoutes.js';
import transactionRoutes from './transactionRoutes.js';
import debtRoutes from './debtRoutes.js';
import settingsRoutes from './settingsRoutes.js';
import seedRoutes from './seedRoutes.js';
import categoryBudgetRoutes from './categoryBudgetRoutes.js';
import chatRoutes from './chatRoutes.js';
import payrollRoutes from './payrollRoutes.js';
import receiptRoutes from './receiptRoutes.js';
import walletRoutes from './walletRoutes.js';
import contextRoutes from './contextRoutes.js';
import goalRoutes from './goalRoutes.js';
import subscriptionRoutes from './subscriptionRoutes.js';
import investmentRoutes from './investmentRoutes.js';
import cycleRetrospectiveRoutes from './cycleRetrospectiveRoutes.js';
import userManagementRoutes from './userManagementRoutes.js';
import coreAuditRoutes from './coreAuditRoutes.js';
import { NotificationController } from '../controllers/NotificationController.js';
import { requireAuth, AuthRequest } from '../../src/middleware/auth.js';
import { perfRequestMiddleware } from '../../src/lib/perfMonitor.js';
import { walletService } from '../services/WalletService.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { debtService } from '../services/DebtService.js';
import { transactionService } from '../services/TransactionService.js';
import { payrollService } from '../services/PayrollService.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { getContextsForUser } from '../controllers/ContextController.js';
import { goalService } from '../services/GoalService.js';
import { subscriptionService } from '../services/SubscriptionService.js';
import { settingsService } from '../services/SettingsService.js';
import { kpiService } from '../services/KpiService.js';
import { investmentService } from '../services/InvestmentService.js';

const apiRouter = Router();
const notificationController = new NotificationController();

// Mount request correlation ID & latency/DB telemetry middleware across all /api routes
apiRouter.use(perfRequestMiddleware);

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

/**
 * PERF-01 & PERF-10: Unified Dashboard Bootstrap Endpoint
 * Loads all core ledger entities once in parallel, computes KPIs from the loaded entities
 * with zero duplicate table scans, and optionally includes investment telemetry.
 */
apiRouter.get('/dashboard/bootstrap', requireAuth, async (req: any, res) => {
  try {
    const authReq = req as AuthRequest;
    const dbUser = authReq.dbUser;
    const userId = dbUser.id;
    const includeInvestments =
      req.query.includeInvestments !== 'false' &&
      Boolean(authReq.userPermissions?.canAccessInvestments ?? true);

    const [
      userWallets,
      rawDebts,
      budgets,
      contexts,
      goals,
      subscriptions,
      settings,
    ] = await Promise.all([
      walletService.getWallets(userId),
      debtRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
      getContextsForUser(userId),
      goalService.getGoalsForUser(userId),
      subscriptionService.getSubscriptionsForUser(userId),
      settingsService.getSettings(dbUser),
    ]);

    const [transactions, payrolls] = await Promise.all([
      transactionService.getTransactionsForUser(userId, rawDebts),
      payrollService.getPayrollsForUser(userId, userWallets),
    ]);

    const [debts, kpis] = await Promise.all([
      debtService.getDebtsWithSettlements(userId, {
        debts: rawDebts,
        transactions,
      }),
      kpiService.getKpisForUser(dbUser, {
        wallets: userWallets,
        transactions,
        payrolls,
        debts: rawDebts,
        budgets,
      }),
    ]);

    let investmentsData = null;
    if (includeInvestments) {
      investmentsData = await investmentService
        .getInvestmentsData(userId, {
          preloadedKpis: kpis,
          preloadedTransactions: transactions,
          preloadedUser: dbUser,
          preloadedSubscriptions: subscriptions,
        })
        .catch(() => null);
    }

    res.json({
      kpis,
      transactions,
      debts,
      payrolls,
      budgets,
      contexts,
      goals,
      subscriptions,
      settings,
      investmentsData,
    });
  } catch (error: any) {
    console.error('[DashboardBootstrap] Failed to load bootstrap payload:', error);
    res.status(500).json({ error: error?.message || 'Failed to load dashboard bootstrap' });
  }
});

apiRouter.use('/', authRoutes);
apiRouter.use('/', kpiRoutes);
apiRouter.use('/', transactionRoutes);
apiRouter.use('/', debtRoutes);
apiRouter.use('/', settingsRoutes);
apiRouter.use('/', seedRoutes);
apiRouter.use('/', categoryBudgetRoutes);
apiRouter.use('/chat', chatRoutes);
apiRouter.use('/', payrollRoutes);
apiRouter.use('/', receiptRoutes);
apiRouter.use('/', walletRoutes);
apiRouter.use('/', contextRoutes);
apiRouter.use('/', goalRoutes);
apiRouter.use('/', subscriptionRoutes);
apiRouter.use('/', investmentRoutes);
apiRouter.use('/', cycleRetrospectiveRoutes);
apiRouter.use('/', userManagementRoutes);
apiRouter.use('/', coreAuditRoutes);

// Push Notifications v2
apiRouter.get('/notifications/vapid-public-key', notificationController.getPublicKey);
apiRouter.post('/notifications/subscribe', requireAuth, notificationController.subscribe);
apiRouter.post('/notifications/unsubscribe', requireAuth, notificationController.unsubscribe);
apiRouter.get('/notifications/preferences', requireAuth, notificationController.getPreferences);
apiRouter.put('/notifications/preferences', requireAuth, notificationController.updatePreferences);

export default apiRouter;
