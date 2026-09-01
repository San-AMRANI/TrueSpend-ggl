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
import goalRoutes from './goalRoutes.js';
import insightsRoutes from './insightsRoutes.js';
import { NotificationController } from '../controllers/NotificationController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const apiRouter = Router();
const notificationController = new NotificationController();

apiRouter.get('/health', (req, res) => {
  res.json({ status: 'ok' });
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
apiRouter.use('/', goalRoutes);
apiRouter.use('/', insightsRoutes);

// Push Notifications v2
apiRouter.get('/notifications/vapid-public-key', notificationController.getPublicKey);
apiRouter.post('/notifications/subscribe', requireAuth, notificationController.subscribe);
apiRouter.post('/notifications/unsubscribe', requireAuth, notificationController.unsubscribe);
apiRouter.get('/notifications/preferences', requireAuth, notificationController.getPreferences);
apiRouter.put('/notifications/preferences', requireAuth, notificationController.updatePreferences);

export default apiRouter;
