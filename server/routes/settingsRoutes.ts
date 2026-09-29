import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { settingsController } from '../controllers/SettingsController.js';

const router = Router();

router.get('/settings', requireAuth, (req, res) => settingsController.getSettings(req as any, res));
router.get('/settings/export-sql', requireAuth, (req, res) => settingsController.exportSql(req as any, res));
router.post('/settings/import-sql', requireAuth, (req, res) => settingsController.importSql(req as any, res));
router.post('/settings/backup-drive', requireAuth, (req, res) => settingsController.backupToGoogleDrive(req as any, res));
router.post('/settings', requireAuth, (req, res) => settingsController.updateSettings(req as any, res));

export default router;
