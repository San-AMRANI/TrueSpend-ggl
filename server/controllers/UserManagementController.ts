import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { userManagementService } from '../services/UserManagementService.js';

export class UserManagementController {
  async listUsers(_req: AuthRequest, res: Response) {
    try {
      const data = await userManagementService.listUsers();
      res.json(data);
    } catch (error: any) {
      console.error('[UserManagementController.listUsers]', error);
      res.status(500).json({ error: error.message || 'Failed to load users and roles' });
    }
  }

  async getOwnershipInventory(_req: AuthRequest, res: Response) {
    try {
      const report = await userManagementService.getLegacyOwnershipInventoryReport();
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to build ownership inventory report' });
    }
  }

  async createUser(req: AuthRequest, res: Response) {
    try {
      const actor = req.authUser || req.dbUser;
      const created = await userManagementService.createUser(actor, req.body);
      res.status(201).json(created);
    } catch (error: any) {
      console.error('[UserManagementController.createUser]', error);
      res.status(400).json({ error: error.message || 'Failed to create user' });
    }
  }

  async updateUser(req: AuthRequest, res: Response) {
    try {
      const actor = req.authUser || req.dbUser;
      const targetId = req.params.id;
      const updated = await userManagementService.updateUser(actor, targetId, req.body);
      res.json(updated);
    } catch (error: any) {
      console.error('[UserManagementController.updateUser]', error);
      res.status(400).json({ error: error.message || 'Failed to update user' });
    }
  }

  async deleteUser(req: AuthRequest, res: Response) {
    try {
      const actor = req.authUser || req.dbUser;
      const targetId = req.params.id;
      const result = await userManagementService.deleteUser(actor, targetId);
      res.json(result);
    } catch (error: any) {
      console.error('[UserManagementController.deleteUser]', error);
      res.status(400).json({ error: error.message || 'Failed to delete user' });
    }
  }

  async impersonateUser(_req: AuthRequest, res: Response) {
    res.status(403).json({
      error: 'User impersonation has been disabled to protect private account isolation.',
      code: 'IMPERSONATION_DISABLED',
    });
  }
}

export const userManagementController = new UserManagementController();
