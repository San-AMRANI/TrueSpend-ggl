import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { walletService } from '../services/WalletService.js';

export class WalletController {
  async getWallets(req: AuthRequest, res: Response) {
    try {
      const wallets = await walletService.getWallets(req.dbUser.id);
      res.json(wallets);
    } catch (e: any) {
      console.error('WalletController.getWallets error:', e);
      res.status(500).json({ error: e.message || 'Internal Server Error' });
    }
  }

  async createWallet(req: AuthRequest, res: Response) {
    try {
      const wallet = await walletService.createWallet(req.dbUser.id, req.body);
      res.status(201).json(wallet);
    } catch (e: any) {
      console.error('WalletController.createWallet error:', e);
      res.status(400).json({ error: e.message || 'Failed to create wallet' });
    }
  }

  async updateWallet(req: AuthRequest, res: Response) {
    try {
      const walletId = req.params.id;
      const wallet = await walletService.updateWallet(req.dbUser.id, walletId, req.body);
      res.json(wallet);
    } catch (e: any) {
      console.error('WalletController.updateWallet error:', e);
      if (e.message === 'Wallet not found') {
        res.status(404).json({ error: 'Wallet not found' });
      } else {
        res.status(400).json({ error: e.message || 'Failed to update wallet' });
      }
    }
  }

  async deleteWallet(req: AuthRequest, res: Response) {
    try {
      const walletId = req.params.id;
      const reassignTo = req.query.reassignTo as string | undefined;
      const result = await walletService.deleteWallet(req.dbUser.id, walletId, reassignTo);
      res.json(result);
    } catch (e: any) {
      console.error('WalletController.deleteWallet error:', e);
      if (e.message === 'Wallet not found') {
        res.status(404).json({ error: 'Wallet not found' });
      } else {
        res.status(400).json({ error: e.message || 'Failed to delete wallet' });
      }
    }
  }
}

export const walletController = new WalletController();
