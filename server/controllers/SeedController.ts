import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { seedService } from '../services/SeedService.js';

export class SeedController {
  async seed(req: AuthRequest, res: Response) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({
        error: 'Database seeding is disabled in production.',
        code: 'SEED_DISABLED_IN_PRODUCTION',
      });
    }
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
