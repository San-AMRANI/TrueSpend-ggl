import { Request, Response } from 'express';
import {
  authService,
  AuthError,
  REFRESH_COOKIE_NAME,
  REFRESH_SESSION_TTL_MS,
  deriveDeviceLabel,
  RequestClientContext,
} from '../services/AuthService.js';
import { AuthRequest } from '../../src/middleware/auth.js';
import { getClientIp } from '../middleware/rateLimit.js';
import { isProductionEnv } from '../services/SecurityCrypto.js';

function getClientContext(req: Request): RequestClientContext {
  const userAgent = String(req.headers['user-agent'] || '');
  const isCapacitorNative =
    req.headers['x-client-platform'] === 'capacitor' ||
    req.headers.origin === 'https://localhost' ||
    req.headers.origin === 'capacitor://localhost';

  return {
    ipAddress: getClientIp(req),
    userAgent,
    deviceLabel: deriveDeviceLabel(userAgent),
    isCapacitorNative,
  };
}

function setRefreshCookie(req: Request, res: Response, cookieValue: string) {
  const origin = req.headers.origin || '';
  const isCrossOriginCapacitor =
    origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'ionic://localhost';
  const secure = isProductionEnv() || Boolean(req.secure) || isCrossOriginCapacitor;

  res.cookie(REFRESH_COOKIE_NAME, cookieValue, {
    httpOnly: true,
    secure,
    sameSite: isCrossOriginCapacitor ? 'none' : 'lax',
    path: '/api/auth',
    maxAge: REFRESH_SESSION_TTL_MS,
  });
}

function clearRefreshCookie(req: Request, res: Response) {
  const origin = req.headers.origin || '';
  const isCrossOriginCapacitor =
    origin === 'https://localhost' || origin === 'capacitor://localhost' || origin === 'ionic://localhost';
  const secure = isProductionEnv() || Boolean(req.secure) || isCrossOriginCapacitor;

  res.clearCookie(REFRESH_COOKIE_NAME, {
    httpOnly: true,
    secure,
    sameSite: isCrossOriginCapacitor ? 'none' : 'lax',
    path: '/api/auth',
  });
}

function handleAuthError(res: Response, error: any, fallbackStatus = 400) {
  if (error instanceof AuthError) {
    return res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.extra || {}),
    });
  }
  return res.status(fallbackStatus).json({
    error: error?.message || 'Authentication error',
    code: 'AUTH_ERROR',
  });
}

export class AuthController {
  async register(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const result = await authService.register(req.body || {}, ctx);
      res.status(202).json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async login(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const identifier = req.body?.email || req.body?.username || req.body?.identifier;
      const password = req.body?.password;
      const result = await authService.login(identifier, password, ctx);
      setRefreshCookie(req, res, result.refreshCookieValue);
      const { refreshCookieValue: _omitCookie, ...safePayload } = result;
      res.json(safePayload);
    } catch (e: any) {
      handleAuthError(res, e, 401);
    }
  }

  async refresh(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const cookieVal = req.cookies?.[REFRESH_COOKIE_NAME];
      const bodyRefresh = typeof req.body?.refreshToken === 'string' ? req.body.refreshToken : undefined;
      const rawToken = cookieVal || bodyRefresh;
      const result = await authService.refreshSession(rawToken, ctx);
      setRefreshCookie(req, res, result.refreshCookieValue);
      const { refreshCookieValue: _omitCookie, ...safePayload } = result;
      res.json(safePayload);
    } catch (e: any) {
      clearRefreshCookie(req, res);
      handleAuthError(res, e, 401);
    }
  }

  async logout(req: AuthRequest, res: Response) {
    try {
      const cookieVal = req.cookies?.[REFRESH_COOKIE_NAME] || req.body?.refreshToken;
      await authService.logout(cookieVal, req.sessionId, req.userId);
      clearRefreshCookie(req, res);
      res.json({ success: true });
    } catch (e: any) {
      clearRefreshCookie(req, res);
      handleAuthError(res, e, 400);
    }
  }

  async logoutAll(req: AuthRequest, res: Response) {
    try {
      const ctx = getClientContext(req);
      await authService.logoutAll(req.userId!, ctx);
      clearRefreshCookie(req, res);
      res.json({ success: true });
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async me(req: AuthRequest, res: Response) {
    try {
      if (!req.authUser) {
        return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
      }
      const formatted = authService.formatAuthUser(req.authUser);
      res.json({ user: formatted });
    } catch (e: any) {
      res.status(500).json({ error: e.message || 'Failed to load profile' });
    }
  }

  async verifyEmail(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const token = String(req.body?.token || req.query?.token || '');
      const result = await authService.verifyEmail(token, ctx);
      setRefreshCookie(req, res, result.refreshCookieValue);
      const { refreshCookieValue: _omitCookie, ...safePayload } = result;
      res.json(safePayload);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async resendVerification(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const email = String(req.body?.email || '');
      const result = await authService.resendVerification(email, ctx);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async forgotPassword(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const email = String(req.body?.email || '');
      const result = await authService.forgotPassword(email, ctx);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async resetPassword(req: Request, res: Response) {
    try {
      const ctx = getClientContext(req);
      const token = String(req.body?.token || '');
      const newPassword = String(req.body?.newPassword || req.body?.password || '');
      const result = await authService.resetPassword(token, newPassword, ctx);
      clearRefreshCookie(req, res);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async changePassword(req: AuthRequest, res: Response) {
    try {
      const ctx = getClientContext(req);
      const currentPassword = String(req.body?.currentPassword || '');
      const newPassword = String(req.body?.newPassword || '');
      const result = await authService.changePassword(
        req.authUser,
        currentPassword,
        newPassword,
        req.sessionId,
        ctx
      );
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async changeEmail(req: AuthRequest, res: Response) {
    try {
      const ctx = getClientContext(req);
      const currentPassword = String(req.body?.currentPassword || '');
      const newEmail = String(req.body?.newEmail || '');
      const result = await authService.changeEmail(req.authUser, currentPassword, newEmail, ctx);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async listSessions(req: AuthRequest, res: Response) {
    try {
      const sessions = await authService.listSessions(req.userId!, req.sessionId);
      res.json({ sessions });
    } catch (e: any) {
      handleAuthError(res, e, 500);
    }
  }

  async revokeSession(req: AuthRequest, res: Response) {
    try {
      const ctx = getClientContext(req);
      const result = await authService.revokeSession(req.userId!, req.params.id, ctx);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async listSecurityEvents(req: AuthRequest, res: Response) {
    try {
      const events = await authService.listSecurityEvents(req.userId!);
      res.json({ events });
    } catch (e: any) {
      handleAuthError(res, e, 500);
    }
  }

  async validateInvitation(req: Request, res: Response) {
    try {
      const code = String(req.body?.code || req.query?.code || '');
      const result = await authService.validateInvitation(code);
      res.json(result);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }

  async createInvitation(req: AuthRequest, res: Response) {
    try {
      const created = await authService.createInvitation(req.userId!, req.body || {});
      res.status(201).json(created);
    } catch (e: any) {
      handleAuthError(res, e, 400);
    }
  }
}

export const authController = new AuthController();
