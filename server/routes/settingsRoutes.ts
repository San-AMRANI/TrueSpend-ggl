import { Router } from 'express';
import { requireAuth, requireFeature } from '../../src/middleware/auth.js';
import { settingsController } from '../controllers/SettingsController.js';

const router = Router();

router.get('/settings', requireAuth, (req, res) => settingsController.getSettings(req as any, res));
router.post('/settings', requireAuth, (req, res) => settingsController.updateSettings(req as any, res));
router.post('/settings/disconnect-drive', requireAuth, (req, res) =>
  settingsController.disconnectGoogleDrive(req as any, res)
);

router.get('/settings/export-sql', requireAuth, requireFeature('backups.advanced'), (req, res) =>
  settingsController.exportSql(req as any, res)
);
router.post('/settings/validate-backup', requireAuth, requireFeature('backups.advanced'), (req, res) =>
  settingsController.validateBackup(req as any, res)
);
router.post('/settings/import-sql', requireAuth, requireFeature('backups.advanced'), (req, res) =>
  settingsController.importSql(req as any, res)
);
router.post('/settings/backup-drive', requireAuth, requireFeature('backups.advanced'), (req, res) =>
  settingsController.backupToGoogleDrive(req as any, res)
);

export default router;
