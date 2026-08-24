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

const apiRouter = Router();

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

export default apiRouter;
