import { Router } from 'express';
import { authController } from '../controllers/AuthController.js';
import {
  requireAuth,
  requireUserManager,
  requireTrustedOriginForCookieAuth,
} from '../../src/middleware/auth.js';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit.js';

const router = Router();

const authAttemptLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  keyPrefix: 'auth_attempt',
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  maxRequests: 15,
  keyPrefix: 'auth_register',
  message: 'Too many registration requests from this network. Please wait before trying again.',
});

const recoveryEmailLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 6,
  keyPrefix: 'auth_recovery',
  keyFn: (req) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    return `${getClientIp(req)}:${email || 'unknown'}`;
  },
  message: 'Please wait a few minutes before requesting another email.',
});

const refreshLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 60,
  keyPrefix: 'auth_refresh',
  message: 'Too many session refresh requests.',
});

// Public Auth Lifecycle
router.post('/auth/register', registerLimiter, (req, res) => authController.register(req, res));
router.post('/auth/login', authAttemptLimiter, (req, res) => authController.login(req, res));
router.post('/login', authAttemptLimiter, (req, res) => authController.login(req, res));
router.post(
  '/auth/refresh',
  refreshLimiter,
  requireTrustedOriginForCookieAuth,
  (req, res) => authController.refresh(req, res)
);
router.post('/auth/logout', requireTrustedOriginForCookieAuth, (req, res) =>
  authController.logout(req as any, res)
);
router.post('/auth/verify-email', authAttemptLimiter, (req, res) =>
  authController.verifyEmail(req, res)
);
router.post('/auth/resend-verification', recoveryEmailLimiter, (req, res) =>
  authController.resendVerification(req, res)
);
router.post('/auth/forgot-password', recoveryEmailLimiter, (req, res) =>
  authController.forgotPassword(req, res)
);
router.post('/auth/reset-password', authAttemptLimiter, (req, res) =>
  authController.resetPassword(req, res)
);
router.get('/invitations/validate', authAttemptLimiter, (req, res) =>
  authController.validateInvitation(req, res)
);
router.post('/invitations/validate', authAttemptLimiter, (req, res) =>
  authController.validateInvitation(req, res)
);

// Authenticated Account & Security Routes
router.get('/auth/me', requireAuth, (req, res) => authController.me(req as any, res));
router.post('/auth/logout-all', requireAuth, (req, res) =>
  authController.logoutAll(req as any, res)
);
router.post('/auth/change-password', requireAuth, authAttemptLimiter, (req, res) =>
  authController.changePassword(req as any, res)
);
router.post('/auth/change-email', requireAuth, recoveryEmailLimiter, (req, res) =>
  authController.changeEmail(req as any, res)
);
router.get('/auth/sessions', requireAuth, (req, res) =>
  authController.listSessions(req as any, res)
);
router.delete('/auth/sessions/:id', requireAuth, (req, res) =>
  authController.revokeSession(req as any, res)
);
router.get('/auth/security-events', requireAuth, (req, res) =>
  authController.listSecurityEvents(req as any, res)
);
router.post('/invitations', requireAuth, requireUserManager, (req, res) =>
  authController.createInvitation(req as any, res)
);
router.get('/auth/test-email', requireAuth, requireUserManager, recoveryEmailLimiter, (req, res) =>
  authController.testEmail(req, res)
);
router.post('/auth/test-email', requireAuth, requireUserManager, recoveryEmailLimiter, (req, res) =>
  authController.testEmail(req, res)
);

export default router;
