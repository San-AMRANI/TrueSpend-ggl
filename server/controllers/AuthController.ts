import { Request, Response } from 'express';
import { authService } from '../services/AuthService.js';

export class AuthController {
  login(req: Request, res: Response) {
    try {
      const { username, password } = req.body;
      const result = authService.login(username, password);
      res.json(result);
    } catch (e: any) {
      res.status(401).json({ error: e.message || 'Invalid credentials' });
    }
  }
}

export const authController = new AuthController();
