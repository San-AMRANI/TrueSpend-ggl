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

  async backupToGoogleDrive(req: AuthRequest, res: Response) {
    try {
      const accessToken = req.body?.accessToken || req.dbUser?.googleDriveToken;
      if (!accessToken) {
        return res.status(400).json({ error: 'No Google Drive access token provided' });
      }

      const backupResult = await settingsService.backupToGoogleDrive(accessToken);

      // Persist backup date in database
      await settingsService.updateSettings(req.dbUser.id, {
        lastDriveBackupDate: backupResult.lastDriveBackupDate,
      });

      res.json({ success: true, ...backupResult });
    } catch (e: any) {
      console.error('Error in server backup to Google Drive:', e);
      res.status(500).json({ error: e?.message || 'Failed to backup to Google Drive' });
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

  async importSql(req: AuthRequest, res: Response) {
    try {
      const restored = await settingsService.importSqlDatabase(req.body?.sql);
      const recordCount = Object.values(restored).reduce((total, count) => total + Number(count), 0);
      res.json({ success: true, restored, message: `Restore complete: ${recordCount} records imported.` });
    } catch (e: any) {
      console.error('Error importing SQL backup:', e);
      const message = e?.message || 'Failed to import the SQL backup';
      const isValidationError = message.startsWith('Please select') || message.startsWith('This backup') || message.startsWith('Invalid TrueSpend');
      res.status(isValidationError ? 400 : 500).json({ error: isValidationError ? message : 'Failed to import the SQL backup' });
    }
  }
}

export const settingsController = new SettingsController();
