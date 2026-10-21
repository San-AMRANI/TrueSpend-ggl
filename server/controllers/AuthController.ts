import { Request, Response } from 'express';
import { authService } from '../services/AuthService.js';
import { AuthRequest } from '../../src/middleware/auth.js';

export class AuthController {
  async login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const result = await authService.login(username, password);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message || 'Invalid credentials' });
    }
  }

  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const formatted = authService.formatAuthUser(req.authUser, req.authUser.impersonatedBy);
      res.json({ user: formatted });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to load profile' });
    }
  }
}

export const authController = new AuthController();
