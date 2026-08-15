import { Response } from 'express';
import { AuthRequest } from '../../src/middleware/auth.js';
import { settingsService } from '../services/SettingsService.js';

export class SettingsController {
  async getSettings(req: AuthRequest, res: Response) {
    try {
      const settings = await settingsService.getSettings(req.dbUser);
      res.json(settings);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error' });
    }
  }

  async updateSettings(req: AuthRequest, res: Response) {
    try {
      const result = await settingsService.updateSettings(req.dbUser.id, req.body);
      res.json(result);
    } catch (e: any) {
      console.error(e);
      if (e.message?.startsWith('Invalid')) {
        res.status(400).json({ error: e.message });
      } else {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    }
  }

  async exportSql(req: AuthRequest, res: Response) {
    try {
      const sqlContent = await settingsService.exportSqlDatabase();
      res.setHeader('Content-Type', 'application/sql');
      res.setHeader('Content-Disposition', 'attachment; filename="truespend_database_backup.sql"');
      res.send(sqlContent);
    } catch (e) {
      console.error('Error exporting SQL:', e);
      res.status(500).json({ error: 'Failed to export SQL database dump' });
    }
  }
}

export const settingsController = new SettingsController();
