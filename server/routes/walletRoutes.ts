import { Router } from 'express';
import { walletController } from '../controllers/WalletController.js';
import { requireAuth } from '../../src/middleware/auth.js';

const router = Router();

router.get('/wallets', requireAuth, walletController.getWallets);
router.post('/wallets', requireAuth, walletController.createWallet);
router.put('/wallets/:id', requireAuth, walletController.updateWallet);
router.delete('/wallets/:id', requireAuth, walletController.deleteWallet);

export default router;
