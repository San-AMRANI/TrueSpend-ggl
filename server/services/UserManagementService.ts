import crypto from 'crypto';
import { eq, ne, desc, or, sql } from 'drizzle-orm';
import { db, createPool } from '../../src/db/index.js';
import { users, userAuditLogs, wallets } from '../../src/db/schema.js';
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
    shortDesc: 'Full system authority & root ledger owner',
    description:
      'Unrestricted control over the primary financial ledger, user accounts, role assignments, security audit logs, and full PostgreSQL database backups.',
    defaultWorkspaceMode: 'shared',
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
    shortDesc: 'User management & full financial operations',
    description:
      'Can manage non-owner users, configure budgets, wallets, investments, and export backups. Ideal for trusted co-administrators.',
    defaultWorkspaceMode: 'shared',
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
    label: 'Finance Manager / Partner',
    shortDesc: 'Full day-to-day financial read/write access',
    description:
      'Can record transactions, manage wallets, adjust category budgets, track investments, and consult Spex AI, without user administration or system backup access.',
    defaultWorkspaceMode: 'shared',
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
    shortDesc: 'Dedicated personal workspace or contributor',
    description:
      'Standard user account with full control over their own isolated financial workspace (or shared ledger if enabled), budgets, goals, and Spex AI co-pilot.',
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
    shortDesc: 'Strict read-only inspection & analytics',
    description:
      'Read-only access to dashboards, cash flow calendars, analytics, cycle retrospectives, and portfolios. Cannot create, edit, or delete any financial records.',
    defaultWorkspaceMode: 'shared',
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

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derivedKey = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${derivedKey}`;
}

export function verifyPassword(password: string, storedHash?: string | null): boolean {
  if (!storedHash) return false;
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 3 || parts[0] !== 'scrypt') {
      return false;
    }
    const [, salt, keyHex] = parts;
    const keyBuffer = Buffer.from(keyHex, 'hex');
    const derivedBuffer = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedBuffer.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
  } catch {
    return false;
  }
}

export class UserManagementService {
  async ensureOwnerConfigured() {
    const adminUsername = process.env.ADMIN_USERNAME || 'SanSpend';
    const existingOwner = await db
      .select()
      .from(users)
      .where(eq(users.email, PRIMARY_OWNER_EMAIL))
      .limit(1);

    if (existingOwner.length > 0) {
      const owner = existingOwner[0];
      if (owner.role !== 'owner' || !owner.username || !owner.displayName) {
        const [updated] = await db
          .update(users)
          .set({
            role: 'owner',
            status: 'active',
            workspaceMode: 'shared',
            username: owner.username || adminUsername,
            displayName: owner.displayName || 'Hassan Amrani (Owner)',
            avatarColor: owner.avatarColor || 'indigo',
          })
          .where(eq(users.id, owner.id))
          .returning();
        return updated;
      }
      return owner;
    }

    // Fallback if database had no owner record yet
    const [created] = await db
      .insert(users)
      .values({
        uid: PRIMARY_OWNER_EMAIL,
        username: adminUsername,
        displayName: 'Hassan Amrani (Owner)',
        email: PRIMARY_OWNER_EMAIL,
        role: 'owner',
        status: 'active',
        workspaceMode: 'shared',
        avatarColor: 'indigo',
      })
      .returning();
    return created;
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
      console.warn('[UserManagement] Failed to write audit log:', err);
    }
  }

  formatManagedUser(
    row: typeof users.$inferSelect,
    statsMap?: Record<string, { transactionCount: number; walletCount: number; holdingCount: number }>,
    ownerId?: string
  ): ManagedUser {
    const isOwner = row.role === 'owner' || row.email === PRIMARY_OWNER_EMAIL;
    const role = (isOwner ? 'owner' : row.role || 'member') as UserRole;
    const workspaceMode = (isOwner ? 'shared' : row.workspaceMode || 'isolated') as WorkspaceMode;
    const effectiveStatsUserId = workspaceMode === 'shared' && ownerId ? ownerId : row.id;
    const stats = statsMap?.[effectiveStatsUserId] || {
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
      workspaceMode,
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
    const owner = await this.ensureOwnerConfigured();
    const pool = createPool();

    const allRows = await db
      .select()
      .from(users)
      .where(ne(users.status, 'legacy_hidden'))
      .orderBy(users.createdAt);

    // Gather live counts per user_id
    const [txCountsRes, walletCountsRes, holdingCountsRes] = await Promise.all([
      pool.query('SELECT user_id, COUNT(*)::int AS cnt FROM transactions GROUP BY user_id'),
      pool.query('SELECT user_id, COUNT(*)::int AS cnt FROM wallets GROUP BY user_id'),
      pool.query('SELECT user_id, COUNT(*)::int AS cnt FROM stock_positions WHERE is_watchlist_only = false GROUP BY user_id'),
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
      .map((row) => this.formatManagedUser(row, statsMap, owner.id))
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
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please provide a valid email address.');
    }
    if (!password || password.length < 4) {
      throw new Error('Password must be at least 4 characters.');
    }

    // Prevent creating another 'owner' role unless normalized to 'admin'
    const assignedRole: UserRole =
      payload.role === 'owner' ? 'admin' : payload.role || 'member';

    // Check uniqueness among active/suspended users
    const existing = await db
      .select()
      .from(users)
      .where(
        or(
          sql`LOWER(${users.username}) = ${cleanUsername.toLowerCase()}`,
          sql`LOWER(${users.email}) = ${cleanEmail}`
        )
      );

    const activeConflict = existing.find((u) => u.status !== 'legacy_hidden');
    if (activeConflict) {
      throw new Error('A user with this username or email already exists.');
    }

    const defaultPerms = getDefaultPermissionsForRole(assignedRole);
    const mergedPermissions: UserPermissions = {
      ...defaultPerms,
      ...(payload.permissions || {}),
    };

    const workspaceMode: WorkspaceMode =
      payload.workspaceMode ||
      ROLE_DEFINITIONS.find((r) => r.role === assignedRole)?.defaultWorkspaceMode ||
      'isolated';

    const passwordHash = hashPassword(password);

    const [created] = await db
      .insert(users)
      .values({
        uid: `user_${crypto.randomUUID()}`,
        username: cleanUsername,
        displayName: cleanDisplayName,
        email: cleanEmail,
        passwordHash,
        role: assignedRole,
        status: 'active',
        workspaceMode,
        permissions: JSON.stringify(mergedPermissions),
        avatarColor: payload.avatarColor || 'indigo',
        notes: payload.notes || null,
        salary: String(payload.salary ?? 0),
        payday: payload.payday ?? 25,
        emergencyBuffer: String(payload.emergencyBuffer ?? 0),
        createdBy: actor.id,
      })
      .returning();

    // If isolated workspace, seed default Bank & Cash wallets so their dashboard works immediately
    if (workspaceMode === 'isolated' && payload.seedDefaultWallets !== false) {
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
        console.warn('[UserManagement] Default wallet seed notice:', wErr);
      }
    }

    await this.logAuditEvent({
      actorId: actor.id,
      actorName: actor.displayName || actor.username || actor.email,
      targetUserId: created.id,
      targetUserName: `${cleanDisplayName} (@${cleanUsername})`,
      action: 'USER_CREATED',
      details: `Created user with role "${assignedRole.toUpperCase()}" in ${workspaceMode === 'shared' ? 'Shared Ledger' : 'Isolated Workspace'} mode.`,
    });

    const owner = await this.ensureOwnerConfigured();
    return this.formatManagedUser(
      created,
      {
        [created.id]: {
          transactionCount: 0,
          walletCount: workspaceMode === 'isolated' && payload.seedDefaultWallets !== false ? 2 : 0,
          holdingCount: 0,
        },
      },
      owner.id
    );
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
    const isTargetOwner = target.role === 'owner' || target.email === PRIMARY_OWNER_EMAIL;

    // Only the owner can edit the owner's profile
    if (isTargetOwner && actor.id !== target.id && actor.role !== 'owner') {
      throw new Error('Only the Workspace Owner can modify the Owner profile.');
    }

    // Protect Owner from losing owner role, shared workspace mode, or active status
    const nextRole: UserRole = isTargetOwner
      ? 'owner'
      : payload.role === 'owner'
      ? 'admin'
      : ((payload.role || target.role || 'member') as UserRole);

    const nextStatus: UserStatus = isTargetOwner
      ? 'active'
      : ((payload.status || target.status || 'active') as UserStatus);

    const nextWorkspaceMode: WorkspaceMode = isTargetOwner
      ? 'shared'
      : ((payload.workspaceMode || target.workspaceMode || 'isolated') as WorkspaceMode);

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
      // Role changed without explicit custom permissions -> apply new role defaults
      nextPermissionsJson = JSON.stringify(getDefaultPermissionsForRole(nextRole));
    }

    const updateData: Record<string, any> = {
      role: nextRole,
      status: nextStatus,
      workspaceMode: nextWorkspaceMode,
      permissions: nextPermissionsJson,
    };

    if (payload.username !== undefined && payload.username.trim()) {
      updateData.username = payload.username.trim();
    }
    if (payload.displayName !== undefined && payload.displayName.trim()) {
      updateData.displayName = payload.displayName.trim();
    }
    if (payload.email !== undefined && payload.email.trim()) {
      // Keep PRIMARY_OWNER_EMAIL intact if owner, or allow updating if valid
      if (!isTargetOwner) {
        updateData.email = payload.email.trim().toLowerCase();
      }
    }
    if (payload.avatarColor !== undefined) {
      updateData.avatarColor = payload.avatarColor;
    }
    if (payload.notes !== undefined) {
      updateData.notes = payload.notes;
    }
    if (payload.password && payload.password.trim().length >= 4) {
      updateData.passwordHash = hashPassword(payload.password.trim());
    }

    const [updated] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, targetId))
      .returning();

    const changes: string[] = [];
    if (payload.role && payload.role !== target.role) {
      changes.push(`role → ${nextRole.toUpperCase()}`);
    }
    if (payload.status && payload.status !== target.status) {
      changes.push(`status → ${nextStatus.toUpperCase()}`);
    }
    if (payload.workspaceMode && payload.workspaceMode !== target.workspaceMode) {
      changes.push(`workspace → ${nextWorkspaceMode}`);
    }
    if (payload.password && payload.password.trim().length >= 4) {
      changes.push('password updated');
    }
    if (payload.permissions) {
      changes.push('permissions customized');
    }

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

    const owner = await this.ensureOwnerConfigured();
    return this.formatManagedUser(updated, undefined, owner.id);
  }

  async deleteUser(actor: typeof users.$inferSelect, targetId: string): Promise<{ deletedId: string }> {
    const existingRows = await db.select().from(users).where(eq(users.id, targetId)).limit(1);
    if (existingRows.length === 0) {
      throw new Error('User not found.');
    }
    const target = existingRows[0];

    if (target.role === 'owner' || target.email === PRIMARY_OWNER_EMAIL) {
      throw new Error('The primary Workspace Owner account cannot be deleted.');
    }
    if (target.id === actor.id) {
      throw new Error('You cannot delete your own active account.');
    }

    const pool = createPool();
    // Clean up dependent records if any exist for this non-owner user
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
