import { Router } from 'express';
import { requireAuth } from '../../src/middleware/auth.js';
import { profileOnboardingController } from '../controllers/ProfileOnboardingController.js';

const router = Router();

router.put('/profile', requireAuth, (req, res) =>
  profileOnboardingController.updateProfile(req as any, res)
);
router.put('/profile/experience', requireAuth, (req, res) =>
  profileOnboardingController.switchExperience(req as any, res)
);
router.get('/profile/export', requireAuth, (req, res) =>
  profileOnboardingController.exportPersonalData(req as any, res)
);
router.post('/profile/delete-account', requireAuth, (req, res) =>
  profileOnboardingController.deleteAccount(req as any, res)
);

router.get('/onboarding', requireAuth, (req, res) =>
  profileOnboardingController.getOnboarding(req as any, res)
);
router.put('/onboarding', requireAuth, (req, res) =>
  profileOnboardingController.updateOnboarding(req as any, res)
);
router.post('/onboarding/setup-accounts', requireAuth, (req, res) =>
  profileOnboardingController.setupAccounts(req as any, res)
);

router.get('/templates', requireAuth, (req, res) =>
  profileOnboardingController.listTemplates(req as any, res)
);
router.get('/templates/:id/preview', requireAuth, (req, res) =>
  profileOnboardingController.previewTemplate(req as any, res)
);
router.post('/templates/:id/apply', requireAuth, (req, res) =>
  profileOnboardingController.applyTemplate(req as any, res)
);

export default router;
