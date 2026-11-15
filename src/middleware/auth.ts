import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { resolveUserPermissions } from '../../server/services/UserManagementService.js';
import { getJwtSecret, isOriginAllowed, isProductionEnv } from '../../server/services/SecurityCrypto.js';
import {
  FEATURE_METADATA,
  hasFeatureAccess,
  normalizeExperienceTier,
} from '../lib/entitlements.js';
import type { ExperienceTier, FeatureKey, UserPermissions, UserRole } from '../types/index.js';

export interface AuthRequest extends Request {
  user?: any;
  dbUser?: any;
  authUser?: any;
  userId?: string;
  sessionId?: string | null;
  experienceTier?: ExperienceTier;
  userPermissions?: UserPermissions;
}

const PRE_VERIFICATION_ALLOWED_PATHS = [
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/logout-all',
  '/api/auth/verify-email',
  '/api/auth/resend-verification',
  '/api/auth/sessions',
  '/api/profile/delete-account',
];

function isPreVerificationAllowedPath(fullPath: string): boolean {
  return PRE_VERIFICATION_ALLOWED_PATHS.some(
    (allowed) => fullPath === allowed || fullPath.startsWith(`${allowed}/`)
  );
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token', code: 'UNAUTHORIZED' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = jwt.verify(token, getJwtSecret()) as any;
    if (!decodedToken?.userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid session claims', code: 'UNAUTHORIZED' });
    }

    // Only accept access tokens (or legacy tokens without tokenType for migration window)
    if (decodedToken.tokenType && decodedToken.tokenType !== 'access') {
      return res.status(401).json({ error: 'Unauthorized: Invalid token type', code: 'UNAUTHORIZED' });
    }

    const foundRows = await db
      .select()
      .from(users)
      .where(eq(users.id, decodedToken.userId))
      .limit(1);

    if (foundRows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Account not found', code: 'UNAUTHORIZED' });
    }

    const authenticatedUser = foundRows[0];

    if (authenticatedUser.status === 'deleted' || authenticatedUser.status === 'legacy_hidden' || authenticatedUser.deletedAt) {
      return res.status(401).json({
        error: 'This account is no longer active.',
        code: 'ACCOUNT_DELETED',
      });
    }

    if (authenticatedUser.status === 'suspended') {
      return res.status(403).json({
        error: 'Forbidden: Your account has been suspended.',
        code: 'ACCOUNT_SUSPENDED',
      });
    }

    const fullPath = `${req.baseUrl || ''}${req.path || ''}`;

    if (authenticatedUser.status === 'deletion_pending' && !isPreVerificationAllowedPath(fullPath)) {
      return res.status(403).json({
        error: 'Your account is scheduled for deletion and cannot access financial records.',
        code: 'ACCOUNT_DELETION_PENDING',
      });
    }

    const isVerified =
      Boolean(authenticatedUser.emailVerifiedAt) && authenticatedUser.status !== 'pending_verification';

    if (!isVerified && !isPreVerificationAllowedPath(fullPath)) {
      return res.status(403).json({
        error: 'Please verify your email address before accessing your financial workspace.',
        code: 'EMAIL_VERIFICATION_REQUIRED',
      });
    }

    const role = (authenticatedUser.role || 'member') as UserRole;
    const permissions = resolveUserPermissions(role, authenticatedUser.permissions);
    const experienceTier = normalizeExperienceTier(authenticatedUser.experienceTier);

    req.authUser = {
      ...authenticatedUser,
      role,
      workspaceMode: 'isolated',
      experienceTier,
      emailVerified: isVerified,
      permissions,
      impersonatedBy: null,
    };
    req.userPermissions = permissions;
    req.experienceTier = experienceTier;
    req.sessionId = decodedToken.sessionId || null;

    // Non-negotiable isolation invariant: every user always owns and accesses strictly their own data.
    req.dbUser = authenticatedUser;
    req.userId = authenticatedUser.id;

    req.user = {
      userId: authenticatedUser.id,
      id: authenticatedUser.id,
      uid: authenticatedUser.uid || authenticatedUser.id,
      authUserId: authenticatedUser.id,
      sessionId: decodedToken.sessionId || null,
      role,
      workspaceMode: 'isolated',
      experienceTier,
      permissions,
    };

    const method = req.method.toUpperCase();
    const path = `${req.baseUrl}${req.path}`;

    // Role-based investment guard (strictly separate from tier guard)
    if ((path.includes('/investments') || path.includes('/binance')) && !permissions.canAccessInvestments) {
      return res.status(403).json({
        error: 'Permission Denied: Your role does not have permission to access investment features.',
        code: 'ROLE_PERMISSION_DENIED',
      });
    }

    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isReadOnlyPostEndpoint =
      (path.includes('/chat') && !path.includes('/execute-actions') && !path.includes('/actions')) ||
      path.includes('/stocks/ai-analysis') ||
      path.includes('/receipts/extract') ||
      path.includes('/auth/') ||
      path.includes('/profile') ||
      path.includes('/onboarding') ||
      path.includes('/templates');

    if (isMutatingMethod && !isReadOnlyPostEndpoint && !path.includes('/users')) {
      if (role === 'viewer') {
        return res.status(403).json({
          error: 'Read-Only Access: Users with the Viewer role cannot create, edit, or delete records.',
          code: 'ROLE_PERMISSION_DENIED',
        });
      }

      if (path.includes('/wallets') && !permissions.canManageWallets) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to manage wallets.',
          code: 'ROLE_PERMISSION_DENIED',
        });
      }

      if (path.includes('/category-budgets') && !permissions.canManageBudgets) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to modify category budgets.',
          code: 'ROLE_PERMISSION_DENIED',
        });
      }

      if (path.includes('/investments') && !permissions.canAccessInvestments) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to modify investments.',
          code: 'ROLE_PERMISSION_DENIED',
        });
      }

      if (
        (path.includes('/transactions') ||
          path.includes('/debts') ||
          path.includes('/subscriptions') ||
          path.includes('/goals') ||
          path.includes('/payrolls') ||
          path.includes('/contexts') ||
          path.includes('/execute-actions') ||
          path.includes('/chat/actions')) &&
        !permissions.canWriteTransactions
      ) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to write or modify financial transactions.',
          code: 'ROLE_PERMISSION_DENIED',
        });
      }
    }

    if (
      (path.includes('/export-sql') || path.includes('/import-sql') || path.includes('/backup-drive')) &&
      !permissions.canExportData
    ) {
      return res.status(403).json({
        error: 'Permission Denied: SQL database export and restore require Data Export privileges.',
        code: 'ROLE_PERMISSION_DENIED',
      });
    }

    next();
  } catch (error: any) {
    const errName = String(error?.name || '');
    if (errName === 'TokenExpiredError' || errName === 'JsonWebTokenError' || errName === 'NotBeforeError') {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired token', code: 'UNAUTHORIZED' });
    }
    console.error('[Auth Middleware] Lookup failed:', error?.cause?.message || error?.message || error);
    return res.status(503).json({
      error: 'Authentication service is temporarily unavailable. Please try again shortly.',
      code: 'SERVICE_UNAVAILABLE',
    });
  }
};

export const requireVerifiedAccount = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const user = req.authUser;
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  }
  if (!user.emailVerifiedAt || user.status === 'pending_verification') {
    return res.status(403).json({
      error: 'Please verify your email address before continuing.',
      code: 'EMAIL_VERIFICATION_REQUIRED',
    });
  }
  if (user.status !== 'active') {
    return res.status(403).json({
      error: 'Your account is not active.',
      code: 'ACCOUNT_INACTIVE',
    });
  }
  next();
};

export const requireFeature = (feature: FeatureKey) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const tier = normalizeExperienceTier(req.experienceTier || req.authUser?.experienceTier);
    if (!hasFeatureAccess(tier, feature)) {
      const meta = FEATURE_METADATA[feature];
      return res.status(403).json({
        error: `${meta?.title || feature} is part of the Advanced experience. Both Basic and Advanced are free—switch anytime in Settings → Experience.`,
        code: 'FEATURE_NOT_AVAILABLE_FOR_TIER',
        feature,
        currentTier: tier,
        requiredTier: 'advanced',
      });
    }
    next();
  };
};

export const requireUserManager = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const role = req.authUser?.role;
  const canManage = role === 'owner' || role === 'admin';

  if (!canManage) {
    return res.status(403).json({
      error: 'Forbidden: Only internal administrators can access user management.',
      code: 'ADMIN_REQUIRED',
    });
  }
  next();
};

/**
 * CSRF Origin/Referer check for cookie-authenticated state-changing endpoints (e.g., refresh/logout).
 */
export const requireTrustedOriginForCookieAuth = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Only enforce strict browser origin check when a cookie is present and browser sent Origin/Referer
  const origin = req.headers.origin as string | undefined;
  const referer = req.headers.referer as string | undefined;

  if (origin) {
    if (!isOriginAllowed(origin)) {
      return res.status(403).json({
        error: 'Blocked request from untrusted origin.',
        code: 'CSRF_ORIGIN_DENIED',
      });
    }
    return next();
  }

  if (referer) {
    try {
      const refOrigin = new URL(referer).origin;
      if (!isOriginAllowed(refOrigin)) {
        return res.status(403).json({
          error: 'Blocked request from untrusted referer.',
          code: 'CSRF_ORIGIN_DENIED',
        });
      }
    } catch {
      if (isProductionEnv()) {
        return res.status(403).json({
          error: 'Malformed referer header.',
          code: 'CSRF_ORIGIN_DENIED',
        });
      }
    }
  }

  next();
};
