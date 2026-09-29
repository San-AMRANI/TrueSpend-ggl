import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { parseReceipt } from '../controllers/ReceiptController.js';

const router = Router();

router.post('/receipts/parse', requireAuth, parseReceipt as any);

export default router;