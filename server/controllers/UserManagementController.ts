import { Response } from 'express';
import { eq } from 'drizzle-orm';
import { AuthRequest } from '../../src/middleware/auth.js';
import { userManagementService } from '../services/UserManagementService.js';
import { authService } from '../services/AuthService.js';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';

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

  async impersonateUser(req: AuthRequest, res: Response) {
    try {
      const targetId = req.params.id;
      let actorRow = req.authUser || req.dbUser;

      // If the user is currently in an impersonated session and switching back to the original actor
      if (req.authUser?.impersonatedBy?.id) {
        const originalActorRows = await db
          .select()
          .from(users)
          .where(eq(users.id, req.authUser.impersonatedBy.id))
          .limit(1);
        if (originalActorRows.length > 0) {
          actorRow = originalActorRows[0];
        }
      }

      const result = await authService.createImpersonationSession(actorRow, targetId);
      res.json(result);
    } catch (error: any) {
      console.error('[UserManagementController.impersonateUser]', error);
      res.status(403).json({ error: error.message || 'Failed to switch user session' });
    }
  }
}

export const userManagementController = new UserManagementController();
