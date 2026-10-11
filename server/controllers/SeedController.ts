import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { seedService } from '../services/SeedService.js';

export class SeedController {
  async seed(req: AuthRequest, res: Response) {
    try {
      const result = await seedService.seedForUser(req.dbUser.id);
      res.json(result);
    } catch (e: any) {
      console.error('Seed error:', e);
      res.status(500).json({ error: e.message || 'Seed failed' });
    }
  }
}

export const seedController = new SeedController();
