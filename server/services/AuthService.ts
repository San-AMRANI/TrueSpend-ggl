import jwt from 'jsonwebtoken';
import { eq, ne, or, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import {
  PRIMARY_OWNER_EMAIL,
  resolveUserPermissions,
  userManagementService,
  verifyPassword,
} from './UserManagementService.js';
import type { User, UserRole, UserStatus, WorkspaceMode } from '../../src/types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';

export class AuthService {
  formatAuthUser(
    dbRow: typeof users.$inferSelect,
    impersonatedBy?: {
      id: string;
      username: string;
      displayName: string;
      role: UserRole;
    } | null
  ): User {
    const isOwner = dbRow.role === 'owner' || dbRow.email === PRIMARY_OWNER_EMAIL;
    const role = (isOwner ? 'owner' : dbRow.role || 'member') as UserRole;
    const workspaceMode = (isOwner ? 'shared' : dbRow.workspaceMode || 'isolated') as WorkspaceMode;

    return {
      id: dbRow.id,
      uid: dbRow.uid,
      username: dbRow.username || dbRow.email.split('@')[0] || 'user',
      displayName: dbRow.displayName || dbRow.username || dbRow.email.split('@')[0] || 'User',
      email: dbRow.email,
      role,
      status: (dbRow.status || 'active') as UserStatus,
      workspaceMode,
      permissions: resolveUserPermissions(role, dbRow.permissions),
      avatarColor: dbRow.avatarColor || 'indigo',
      impersonatedBy: impersonatedBy || null,
    };
  }

  async login(usernameOrEmail?: string, password?: string) {
    const identifier = (usernameOrEmail || '').trim();
    const rawPassword = password || '';

    if (!identifier || !rawPassword) {
      throw new Error('Username/Email and password are required.');
    }

    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

    // Ensure the primary owner account is properly initialized
    const ownerRow = await userManagementService.ensureOwnerConfigured();

    // 1. Check if logging in with primary owner credentials (env or owner DB record)
    const matchesOwnerIdentifier =
      identifier.toLowerCase() === adminUser.toLowerCase() ||
      identifier.toLowerCase() === (ownerRow.username || '').toLowerCase() ||
      identifier.toLowerCase() === PRIMARY_OWNER_EMAIL.toLowerCase() ||
      identifier.toLowerCase() === 'admin';

    if (matchesOwnerIdentifier) {
      const envPassMatches = rawPassword === adminPass;
      const customHashMatches = ownerRow.passwordHash
        ? verifyPassword(rawPassword, ownerRow.passwordHash)
        : false;

      if (envPassMatches || customHashMatches) {
        await db
          .update(users)
          .set({ lastLoginAt: new Date() })
          .where(eq(users.id, ownerRow.id));

        const formattedUser = this.formatAuthUser(ownerRow);
        const token = jwt.sign(
          {
            userId: ownerRow.id,
            username: formattedUser.username,
            role: 'owner',
          },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        return {
          token,
          user: formattedUser,
        };
      }
    }

    // 2. Check managed users in the database by username or email
    const matchedRows = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = ${identifier.toLowerCase()}`,
          sql`LOWER(${users.email}) = ${identifier.toLowerCase()}`
        )
      );

    const activeRow = matchedRows.find((u) => u.status !== 'legacy_hidden');
    if (!activeRow) {
      throw new Error('Invalid username or password.');
    }

    if (activeRow.status === 'suspended') {
      throw new Error('This account has been suspended by the Workspace Owner.');
    }

    if (!verifyPassword(rawPassword, activeRow.passwordHash)) {
      throw new Error('Invalid username or password.');
    }

    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, activeRow.id));

    const formattedUser = this.formatAuthUser(activeRow);
    const token = jwt.sign(
      {
        userId: activeRow.id,
        username: formattedUser.username,
        role: formattedUser.role,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    await userManagementService.logAuditEvent({
      actorId: activeRow.id,
      actorName: formattedUser.displayName || formattedUser.username || formattedUser.email,
      targetUserId: activeRow.id,
      targetUserName: `${formattedUser.displayName} (@${formattedUser.username})`,
      action: 'USER_LOGIN',
      details: `Signed in with role "${(formattedUser.role || 'member').toUpperCase()}".`,
    });

    return {
      token,
      user: formattedUser,
    };
  }

  async createImpersonationSession(
    actorRow: typeof users.$inferSelect,
    targetUserId: string
  ) {
    const isActorOwnerOrAdmin =
      actorRow.role === 'owner' ||
      actorRow.role === 'admin' ||
      actorRow.email === PRIMARY_OWNER_EMAIL;

    if (!isActorOwnerOrAdmin) {
      throw new Error('Only Owner or Administrator can switch into another user session.');
    }

    const targetRows = await db
      .select()
      .from(users)
      .where(eq(users.id, targetUserId))
      .limit(1);

    if (targetRows.length === 0) {
      throw new Error('Target user not found.');
    }

    const targetRow = targetRows[0];
    const actorFormatted = this.formatAuthUser(actorRow);
    const impersonatedBy =
      targetRow.id === actorRow.id
        ? null
        : {
            id: actorRow.id,
            username: actorFormatted.username || 'Owner',
            displayName: actorFormatted.displayName || 'Owner',
            role: (actorFormatted.role || 'owner') as UserRole,
          };

    const formattedTarget = this.formatAuthUser(targetRow, impersonatedBy);
    const token = jwt.sign(
      {
        userId: targetRow.id,
        username: formattedTarget.username,
        role: formattedTarget.role,
        impersonatedBy,
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    if (impersonatedBy) {
      await userManagementService.logAuditEvent({
        actorId: actorRow.id,
        actorName: actorFormatted.displayName || actorFormatted.username || actorFormatted.email,
        targetUserId: targetRow.id,
        targetUserName: `${formattedTarget.displayName} (@${formattedTarget.username})`,
        action: 'SESSION_SWITCH',
        details: `Switched active workspace view to @${formattedTarget.username} (${(formattedTarget.role || 'member').toUpperCase()}).`,
      });
    }

    return {
      token,
      user: formattedTarget,
    };
  }
}

export const authService = new AuthService();
