import { eq } from 'drizzle-orm';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import {
  PRIMARY_OWNER_EMAIL,
  resolveUserPermissions,
  userManagementService,
} from '../../server/services/UserManagementService.js';
import type { UserPermissions, UserRole } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

export interface AuthRequest extends Request {
  user?: any;
  dbUser?: any;
  authUser?: any;
  userPermissions?: UserPermissions;
}

export const requireAuth = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing token' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = jwt.verify(token, JWT_SECRET) as any;
    req.user = decodedToken;

    const ownerRecord = await userManagementService.ensureOwnerConfigured();
    let authenticatedUser = ownerRecord;

    if (decodedToken.userId) {
      const foundRows = await db
        .select()
        .from(users)
        .where(eq(users.id, decodedToken.userId))
        .limit(1);
      if (foundRows.length > 0) {
        authenticatedUser = foundRows[0];
      }
    }

    const isOwner =
      authenticatedUser.role === 'owner' ||
      authenticatedUser.email === PRIMARY_OWNER_EMAIL;

    if (!isOwner && authenticatedUser.status === 'suspended' && !decodedToken.impersonatedBy) {
      return res.status(403).json({
        error: 'Forbidden: Your account has been suspended by the Workspace Owner.',
      });
    }

    const role = (isOwner ? 'owner' : authenticatedUser.role || 'member') as UserRole;
    const permissions = resolveUserPermissions(role, authenticatedUser.permissions);
    const workspaceMode = isOwner ? 'shared' : authenticatedUser.workspaceMode || 'isolated';

    req.authUser = {
      ...authenticatedUser,
      role,
      workspaceMode,
      permissions,
      impersonatedBy: decodedToken.impersonatedBy || null,
    };
    req.userPermissions = permissions;

    // Resolve which ledger (dbUser) this user operates on:
    // - 'shared' mode (or 'owner') operates on the Owner's main ledger
    // - 'isolated' mode operates on the user's own private ledger
    if (workspaceMode === 'shared') {
      req.dbUser = ownerRecord;
    } else {
      req.dbUser = authenticatedUser;
    }

    req.user = {
      ...decodedToken,
      id: req.dbUser.id,
      uid: req.dbUser.uid || req.dbUser.id,
      authUserId: authenticatedUser.id,
      role,
      workspaceMode,
      permissions,
    };

    // Enforce RBAC permissions on mutating requests
    const method = req.method.toUpperCase();
    const path = req.baseUrl + req.path;

    const isMutatingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    const isReadOnlyPostEndpoint =
      path.includes('/chat') && !path.includes('/execute-actions')
        ? true
        : path.includes('/stocks/ai-analysis') ||
          path.includes('/receipts/extract') ||
          path.includes('/users/impersonate');

    if (isMutatingMethod && !isReadOnlyPostEndpoint && !path.includes('/users')) {
      if (role === 'viewer') {
        return res.status(403).json({
          error: 'Read-Only Access: Users with the Viewer role cannot create, edit, or delete records.',
        });
      }

      if (path.includes('/wallets') && !permissions.canManageWallets) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to manage wallets.',
        });
      }

      if (path.includes('/category-budgets') && !permissions.canManageBudgets) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to modify category budgets.',
        });
      }

      if (path.includes('/investments') && !permissions.canAccessInvestments) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to modify investments.',
        });
      }

      if (
        (path.includes('/transactions') ||
          path.includes('/debts') ||
          path.includes('/subscriptions') ||
          path.includes('/goals') ||
          path.includes('/payrolls') ||
          path.includes('/contexts') ||
          path.includes('/execute-actions')) &&
        !permissions.canWriteTransactions
      ) {
        return res.status(403).json({
          error: 'Permission Denied: Your role does not have permission to write or modify financial transactions.',
        });
      }
    }

    if (
      (path.includes('/export-sql') || path.includes('/import-sql')) &&
      !permissions.canExportData
    ) {
      return res.status(403).json({
        error: 'Permission Denied: SQL database export and restore require Data Export privileges.',
      });
    }

    next();
  } catch (error) {
    console.error('Error verifying JWT token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

export const requireUserManager = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const role = req.authUser?.role;
  const canManage =
    role === 'owner' ||
    role === 'admin' ||
    Boolean(req.userPermissions?.canManageUsers) ||
    Boolean(req.authUser?.impersonatedBy);

  if (!canManage) {
    return res.status(403).json({
      error: 'Forbidden: Only Workspace Owner or Administrators can manage users and roles.',
    });
  }
  next();
};
