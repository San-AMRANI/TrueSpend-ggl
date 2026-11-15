import crypto from 'crypto';
import { eq, ne, desc, or, sql, and, notInArray } from 'drizzle-orm';
import { db, createPool } from '../../src/db/index.js';
import {
  users,
  userAuditLogs,
  wallets,
  authSessions,
} from '../../src/db/schema.js';
import {
  hashPasswordAsync,
  verifyPasswordAsync,
  validatePasswordStrength,
} from './SecurityCrypto.js';
import { normalizeExperienceTier } from '../../src/lib/entitlements.js';
import type {
  UserRole,
  UserStatus,
  WorkspaceMode,
  UserPermissions,
  ManagedUser,
  RoleDefinition,
  UserAuditLog,
} from '../../src/types/index.js';

export const PRIMARY_OWNER_EMAIL = 'amranihassan.am@gmail.com';

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    role: 'owner',
    label: 'Owner (Super Admin)',
    shortDesc: 'Internal application administrator & support lead',
    description:
      'Administrative oversight of internal operational tools, user status management, and security audit logs within isolated workspaces.',
    defaultWorkspaceMode: 'isolated',
    defaultPermissions: {
      canWriteTransactions: true,
      canManageWallets: true,
      canManageBudgets: true,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: true,
      canManageUsers: true,
    },
  },
  {
    role: 'admin',
    label: 'Administrator',
    shortDesc: 'User management & administrative operations',
    description:
      'Can manage non-owner accounts, review security events, and access administrative tools in an isolated personal workspace.',
    defaultWorkspaceMode: 'isolated',
    defaultPermissions: {
      canWriteTransactions: true,
      canManageWallets: true,
      canManageBudgets: true,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: true,
      canManageUsers: true,
    },
  },
  {
    role: 'manager',
    label: 'Finance Manager',
    shortDesc: 'Full personal workspace read/write access',
    description:
      'Full control over their own private financial workspace, budgets, goals, and Spex AI without administrative privileges.',
    defaultWorkspaceMode: 'isolated',
    defaultPermissions: {
      canWriteTransactions: true,
      canManageWallets: true,
      canManageBudgets: true,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: false,
      canManageUsers: false,
    },
  },
  {
    role: 'member',
    label: 'Standard Member',
    shortDesc: 'Dedicated private financial workspace',
    description:
      'Standard user account with full control over their own isolated private workspace, budgets, goals, and Spex AI.',
    defaultWorkspaceMode: 'isolated',
    defaultPermissions: {
      canWriteTransactions: true,
      canManageWallets: true,
      canManageBudgets: true,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: false,
      canManageUsers: false,
    },
  },
  {
    role: 'viewer',
    label: 'Viewer / Auditor',
    shortDesc: 'Strict read-only inspection of own workspace',
    description:
      'Read-only access to dashboards, cash flow calendars, analytics, and reports inside their own account.',
    defaultWorkspaceMode: 'isolated',
    defaultPermissions: {
      canWriteTransactions: false,
      canManageWallets: false,
      canManageBudgets: false,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: false,
      canManageUsers: false,
    },
  },
];

export function getDefaultPermissionsForRole(role: UserRole): UserPermissions {
  const found = ROLE_DEFINITIONS.find((r) => r.role === role);
  if (found) {
    return { ...found.defaultPermissions };
  }
  return {
    canWriteTransactions: true,
    canManageWallets: true,
    canManageBudgets: true,
    canAccessInvestments: true,
    canUseAiChat: true,
    canExportData: false,
    canManageUsers: false,
  };
}

export function resolveUserPermissions(
  role?: string | null,
  rawPermissions?: string | null
): UserPermissions {
  const normalizedRole = (role || 'member') as UserRole;
  if (normalizedRole === 'owner') {
    return {
      canWriteTransactions: true,
      canManageWallets: true,
      canManageBudgets: true,
      canAccessInvestments: true,
      canUseAiChat: true,
      canExportData: true,
      canManageUsers: true,
    };
  }

  const defaults = getDefaultPermissionsForRole(normalizedRole);
  if (!rawPermissions) {
    return defaults;
  }

  try {
    const parsed = typeof rawPermissions === 'string' ? JSON.parse(rawPermissions) : rawPermissions;
    return {
      canWriteTransactions:
        typeof parsed.canWriteTransactions === 'boolean'
          ? parsed.canWriteTransactions
          : defaults.canWriteTransactions,
      canManageWallets:
        typeof parsed.canManageWallets === 'boolean'
          ? parsed.canManageWallets
          : defaults.canManageWallets,
      canManageBudgets:
        typeof parsed.canManageBudgets === 'boolean'
          ? parsed.canManageBudgets
          : defaults.canManageBudgets,
      canAccessInvestments:
        typeof parsed.canAccessInvestments === 'boolean'
          ? parsed.canAccessInvestments
          : defaults.canAccessInvestments,
      canUseAiChat:
        typeof parsed.canUseAiChat === 'boolean' ? parsed.canUseAiChat : defaults.canUseAiChat,
      canExportData:
        typeof parsed.canExportData === 'boolean' ? parsed.canExportData : defaults.canExportData,
      canManageUsers:
        typeof parsed.canManageUsers === 'boolean'
          ? parsed.canManageUsers
          : defaults.canManageUsers,
    };
  } catch {
    return defaults;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return hashPasswordAsync(password);
}

export async function verifyPassword(password: string, storedHash?: string | null): Promise<boolean> {
  return verifyPasswordAsync(password, storedHash);
}

export class UserManagementService {
  /**
   * Read-only inventory report of any legacy workspace_mode='shared' rows for migration review.
   * Does not auto-create any users or bypass isolation.
   */
  async getLegacyOwnershipInventoryReport() {
    const legacySharedUsers = await db
      .select({
        id: users.id,
        email: users.email,
        username: users.username,
        role: users.role,
        status: users.status,
        workspaceMode: users.workspaceMode,
      })
      .from(users)
      .where(ne(users.status, 'deleted'));

    return {
      totalUsers: legacySharedUsers.length,
      nonIsolatedRemainingCount: legacySharedUsers.filter((u) => u.workspaceMode !== 'isolated').length,
      users: legacySharedUsers,
    };
  }

  async logAuditEvent(params: {
    actorId?: string | null;
    actorName: string;
    targetUserId?: string | null;
    targetUserName: string;
    action: string;
    details: string;
  }) {
    try {
      await db.insert(userAuditLogs).values({
        actorId: params.actorId || null,
        actorName: params.actorName,
        targetUserId: params.targetUserId || null,
        targetUserName: params.targetUserName,
        action: params.action,
        details: params.details,
      });
    } catch (err) {
      console.warn('[UserManagement] Failed to write audit log:', (err as any)?.message || err);
    }
  }

  formatManagedUser(
    row: typeof users.$inferSelect,
    statsMap?: Record<string, { transactionCount: number; walletCount: number; holdingCount: number }>
  ): ManagedUser {
    const isOwner = row.role === 'owner';
    const role = (row.role || 'member') as UserRole;
    const stats = statsMap?.[row.id] || {
      transactionCount: 0,
      walletCount: 0,
      holdingCount: 0,
    };

    return {
      id: row.id,
      uid: row.uid,
      username: row.username || row.email.split('@')[0] || 'user',
      displayName: row.displayName || row.username || row.email.split('@')[0] || 'User',
      email: row.email,
      role,
      status: (row.status || 'active') as UserStatus,
      workspaceMode: 'isolated',
      experienceTier: normalizeExperienceTier(row.experienceTier),
      emailVerified: Boolean(row.emailVerifiedAt),
      emailVerifiedAt: row.emailVerifiedAt ? new Date(row.emailVerifiedAt).toISOString() : null,
      permissions: resolveUserPermissions(role, row.permissions),
      avatarColor: row.avatarColor || 'indigo',
      notes: row.notes || null,
      payday: row.payday ?? 25,
      salary: Number(row.salary || 0),
      emergencyBuffer: Number(row.emergencyBuffer || 0),
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : new Date().toISOString(),
      lastLoginAt: row.lastLoginAt ? new Date(row.lastLoginAt).toISOString() : null,
      isOwnerAccount: isOwner,
      stats,
    };
  }

  async listUsers(): Promise<{
    users: ManagedUser[];
    roles: RoleDefinition[];
    auditLogs: UserAuditLog[];
  }> {
    const pool = createPool();

    const allRows = await db
      .select()
      .from(users)
      .where(notInArray(users.status, ['legacy_hidden', 'deleted']))
      .orderBy(users.createdAt);

    const [txCountsRes, walletCountsRes, holdingCountsRes] = await Promise.all([
      pool.query('SELECT user_id, COUNT(*)::int AS cnt FROM transactions GROUP BY user_id'),
      pool.query('SELECT user_id, COUNT(*)::int AS cnt FROM wallets GROUP BY user_id'),
      pool.query(
        'SELECT user_id, COUNT(*)::int AS cnt FROM stock_positions WHERE is_watchlist_only = false GROUP BY user_id'
      ),
    ]);

    const statsMap: Record<
      string,
      { transactionCount: number; walletCount: number; holdingCount: number }
    > = {};

    for (const r of txCountsRes.rows) {
      if (!statsMap[r.user_id]) {
        statsMap[r.user_id] = { transactionCount: 0, walletCount: 0, holdingCount: 0 };
      }
      statsMap[r.user_id].transactionCount = Number(r.cnt || 0);
    }
    for (const r of walletCountsRes.rows) {
      if (!statsMap[r.user_id]) {
        statsMap[r.user_id] = { transactionCount: 0, walletCount: 0, holdingCount: 0 };
      }
      statsMap[r.user_id].walletCount = Number(r.cnt || 0);
    }
    for (const r of holdingCountsRes.rows) {
      if (!statsMap[r.user_id]) {
        statsMap[r.user_id] = { transactionCount: 0, walletCount: 0, holdingCount: 0 };
      }
      statsMap[r.user_id].holdingCount = Number(r.cnt || 0);
    }

    const formattedUsers = allRows
      .map((row) => this.formatManagedUser(row, statsMap))
      .sort((a, b) => {
        if (a.isOwnerAccount && !b.isOwnerAccount) return -1;
        if (!a.isOwnerAccount && b.isOwnerAccount) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    const auditRows = await db
      .select()
      .from(userAuditLogs)
      .orderBy(desc(userAuditLogs.createdAt))
      .limit(40);

    const formattedLogs: UserAuditLog[] = auditRows.map((l) => ({
      id: l.id,
      actorId: l.actorId,
      actorName: l.actorName,
      targetUserId: l.targetUserId,
      targetUserName: l.targetUserName,
      action: l.action,
      details: l.details,
      createdAt: new Date(l.createdAt).toISOString(),
    }));

    return {
      users: formattedUsers,
      roles: ROLE_DEFINITIONS,
      auditLogs: formattedLogs,
    };
  }

  async createUser(
    actor: typeof users.$inferSelect,
    payload: {
      username: string;
      displayName?: string;
      email: string;
      password: string;
      role?: UserRole;
      experienceTier?: 'basic' | 'advanced';
      workspaceMode?: WorkspaceMode;
      permissions?: Partial<UserPermissions>;
      avatarColor?: string;
      notes?: string;
      salary?: number;
      payday?: number;
      emergencyBuffer?: number;
      seedDefaultWallets?: boolean;
    }
  ): Promise<ManagedUser> {
    const cleanUsername = (payload.username || '').trim();
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const cleanDisplayName = (payload.displayName || cleanUsername).trim();
    const password = payload.password || '';

    if (!cleanUsername || cleanUsername.length < 2) {
      throw new Error('Username must be at least 2 characters.');
    }
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error('Please provide a valid email address.');
    }

    const pwCheck = validatePasswordStrength(password, {
      email: cleanEmail,
      username: cleanUsername,
    });
    if (!pwCheck.valid) {
      throw new Error(pwCheck.error || 'Password does not meet security requirements.');
    }

    const assignedRole: UserRole = payload.role === 'owner' ? 'admin' : payload.role || 'member';

    const existing = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = ${cleanUsername.toLowerCase()}`,
          sql`LOWER(${users.email}) = ${cleanEmail}`
        )
      );

    const activeConflict = existing.find(
      (u) => u.status !== 'legacy_hidden' && u.status !== 'deleted'
    );
    if (activeConflict) {
      throw new Error('A user with this username or email already exists.');
    }

    const defaultPerms = getDefaultPermissionsForRole(assignedRole);
    const mergedPermissions: UserPermissions = {
      ...defaultPerms,
      ...(payload.permissions || {}),
    };

    const passwordHash = await hashPasswordAsync(password);
    const now = new Date();
    const experienceTier = normalizeExperienceTier(payload.experienceTier);

    const [created] = await db
      .insert(users)
      .values({
        uid: `user_${crypto.randomUUID()}`,
        username: cleanUsername,
        displayName: cleanDisplayName,
        email: cleanEmail,
        emailVerifiedAt: now,
        passwordHash,
        passwordUpdatedAt: now,
        role: assignedRole,
        status: 'active',
        workspaceMode: 'isolated',
        experienceTier,
        onboardingVersion: 1,
        onboardingCompletedAt: now,
        permissions: JSON.stringify(mergedPermissions),
        avatarColor: payload.avatarColor || 'indigo',
        notes: payload.notes || null,
        salary: String(payload.salary ?? 0),
        payday: payload.payday ?? 25,
        emergencyBuffer: String(payload.emergencyBuffer ?? 0),
        createdBy: actor.id,
      })
      .returning();

    if (payload.seedDefaultWallets !== false) {
      try {
        await db.insert(wallets).values([
          {
            userId: created.id,
            name: 'Main Bank',
            type: 'Bank',
            isMain: true,
            initialBalance: '0',
            currentBalance: '0',
          },
          {
            userId: created.id,
            name: 'Cash Wallet',
            type: 'Cash',
            isMain: false,
            initialBalance: '0',
            currentBalance: '0',
          },
        ]);
      } catch (wErr) {
        console.warn('[UserManagement] Default wallet notice:', (wErr as any)?.message || wErr);
      }
    }

    await this.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.username || actor.email,
      targetUserId: created.id,
      targetUserName: `${cleanDisplayName} (@${cleanUsername})`,
      action: 'USER_CREATED',
      details: `Created isolated user with role "${assignedRole.toUpperCase()}" (${experienceTier} tier).`,
    });

    return this.formatManagedUser(created, {
      [created.id]: {
        transactionCount: 0,
        walletCount: payload.seedDefaultWallets !== false ? 2 : 0,
        holdingCount: 0,
      },
    });
  }

  async updateUser(
    actor: typeof users.$inferSelect,
    targetId: string,
    payload: {
      username?: string;
      displayName?: string;
      email?: string;
      role?: UserRole;
      status?: UserStatus;
      experienceTier?: 'basic' | 'advanced';
      workspaceMode?: WorkspaceMode;
      permissions?: Partial<UserPermissions>;
      avatarColor?: string;
      notes?: string | null;
      password?: string;
    }
  ): Promise<ManagedUser> {
    const existingRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (existingRows.length === 0) {
      throw new Error('User not found.');
    }
    const target = existingRows[0];
    const isTargetOwner = target.role === 'owner';

    if (isTargetOwner && actor.id !== target.id && actor.role !== 'owner') {
      throw new Error('Only the Owner can modify the Owner profile.');
    }

    const nextRole: UserRole = isTargetOwner
      ? 'owner'
      : payload.role === 'owner'
      ? 'admin'
      : ((payload.role || target.role || 'member') as UserRole);

    const nextStatus: UserStatus = isTargetOwner
      ? 'active'
      : ((payload.status || target.status || 'active') as UserStatus);

    let nextPermissionsJson = target.permissions;
    if (isTargetOwner) {
      nextPermissionsJson = JSON.stringify(getDefaultPermissionsForRole('owner'));
    } else if (payload.permissions) {
      const currentPerms = resolveUserPermissions(nextRole, target.permissions);
      nextPermissionsJson = JSON.stringify({
        ...currentPerms,
        ...payload.permissions,
      });
    } else if (payload.role && payload.role !== target.role) {
      nextPermissionsJson = JSON.stringify(getDefaultPermissionsForRole(nextRole));
    }

    const updateData: Record<string, any> = {
      role: nextRole,
      status: nextStatus,
      workspaceMode: 'isolated',
      permissions: nextPermissionsJson,
    };

    if (payload.experienceTier !== undefined) {
      updateData.experienceTier = normalizeExperienceTier(payload.experienceTier);
    }
    if (payload.username !== undefined && payload.username.trim()) {
      updateData.username = payload.username.trim();
    }
    if (payload.displayName !== undefined && payload.displayName.trim()) {
      updateData.displayName = payload.displayName.trim();
    }
    if (payload.email !== undefined && payload.email.trim() && !isTargetOwner) {
      updateData.email = payload.email.trim().toLowerCase();
    }
    if (payload.avatarColor !== undefined) {
      updateData.avatarColor = payload.avatarColor;
    }
    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
    }
    if (payload.password !== undefined && payload.password.trim().length > 0) {
      const pwCheck = validatePasswordStrength(payload.password.trim(), {
        email: updateData.email || target.email,
        username: updateData.username || target.username || undefined,
      });
      if (!pwCheck.valid) {
        throw new Error(pwCheck.error || 'Password does not meet security requirements.');
      }
      updateData.passwordHash = await hashPasswordAsync(payload.password.trim());
      updateData.passwordUpdatedAt = new Date();
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning();

    if (nextStatus === 'suspended' || payload.password) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.userId, targetId), sql`${authSessions.revokedAt} IS NULL`));
    }

    const changes: string[] = [];
    if (payload.role && payload.role !== target.role) changes.push(`role -> ${nextRole.toUpperCase()}`);
    if (payload.status && payload.status !== target.status) changes.push(`status -> ${nextStatus.toUpperCase()}`);
    if (payload.experienceTier && payload.experienceTier !== target.experienceTier) {
      changes.push(`tier -> ${updateData.experienceTier}`);
    }
    if (payload.password) changes.push('password updated');
    if (payload.permissions) changes.push('permissions customized');

    await this.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.username || actor.email,
      targetUserId: updated.id,
      targetUserName: `${updated.displayName || updated.username} (@${updated.username})`,
      action: 'USER_UPDATED',
      details:
        changes.length > 0
          ? `Updated user (${changes.join(', ')}).`
          : 'Updated user profile details.',
    });

    return this.formatManagedUser(updated);
  }

  async deleteUser(actor: typeof users.$inferSelect, targetId: string): Promise<{ deletedId: string }> {
    const existingRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (existingRows.length === 0) {
      throw new Error('User not found.');
    }
    const target = existingRows[0];

    if (target.role === 'owner') {
      throw new Error('The primary Owner account cannot be deleted from user management.');
    }
    if (target.id === actor.id) {
      throw new Error('Use Account Deletion in Settings -> Privacy & Data Rights to delete your own account.');
    }

    const pool = createPool();
    await pool.query('DELETE FROM transactions WHERE user_id = $1', [targetId]);
    await pool.query('DELETE FROM category_budgets WHERE user_id = $1', [targetId]);
    await pool.query('DELETE FROM payrolls WHERE user_id = $1', [targetId]);
    await pool.query('DELETE FROM debts WHERE user_id = $1', [targetId]);
    await pool.query('DELETE FROM financial_contexts WHERE user_id = $1', [targetId]);
    await pool.query('DELETE FROM wallets WHERE user_id = $1', [targetId]);
    await db.delete(users).where(eq(users.id, targetId));

    await this.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.username || actor.email,
      targetUserId: null,
      targetUserName: `${target.displayName || target.username} (@${target.username})`,
      action: 'USER_DELETED',
      details: `Removed user account (${target.email}) with role "${(target.role || 'member').toUpperCase()}".`,
    });

    return { deletedId: targetId };
  }
}

export const userManagementService = new UserManagementService();
