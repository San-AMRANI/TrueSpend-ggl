import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { categoryBudgetController } from '../controllers/CategoryBudgetController.js';

const router = Router();

router.get('/category-budgets', requireAuth, (req, res) => categoryBudgetController.getBudgets(req as any, res));
router.put('/category-budgets', requireAuth, (req, res) => categoryBudgetController.upsertBudget(req as any, res));
router.post('/category-budgets/copy-previous', requireAuth, (req, res) => categoryBudgetController.copyPreviousMonth(req as any, res));

export default router;
