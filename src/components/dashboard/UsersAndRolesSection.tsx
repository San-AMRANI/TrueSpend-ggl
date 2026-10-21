import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ShieldCheck,
  UserPlus,
  Users,
  Key,
  Lock,
  Check,
  X,
  Edit3,
  Trash2,
  RefreshCw,
  Eye,
  AlertTriangle,
  Building2,
  UserCheck,
  UserX,
  Activity,
  Search,
  Sliders,
  ArrowRightLeft,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import type {
  ManagedUser,
  RoleDefinition,
  UserAuditLog,
  UserPermissions,
  UserRole,
  WorkspaceMode,
} from '../../types';

const AVATAR_COLORS: { id: string; label: string; bg: string }[] = [
  { id: 'indigo', label: 'Indigo', bg: 'from-indigo-600 to-violet-600' },
  { id: 'emerald', label: 'Emerald', bg: 'from-emerald-600 to-teal-600' },
  { id: 'blue', label: 'Ocean', bg: 'from-blue-600 to-cyan-600' },
  { id: 'amber', label: 'Amber', bg: 'from-amber-500 to-orange-600' },
  { id: 'rose', label: 'Rose', bg: 'from-rose-600 to-pink-600' },
  { id: 'slate', label: 'Slate', bg: 'from-slate-700 to-gray-900' },
];

const PERMISSION_LABELS: {
  key: keyof UserPermissions;
  label: string;
  desc: string;
}[] = [
  {
    key: 'canWriteTransactions',
    label: 'Write Transactions & Debts',
    desc: 'Create, edit, or delete income, expenses, transfers, debts, goals, and subscriptions',
  },
  {
    key: 'canManageWallets',
    label: 'Manage Wallets & Accounts',
    desc: 'Create, rename, adjust balances, or delete bank, cash, and savings wallets',
  },
  {
    key: 'canManageBudgets',
    label: 'Configure Category Budgets',
    desc: 'Set or modify monthly category budget limits and payday parameters',
  },
  {
    key: 'canUseAiChat',
    label: 'Spex AI Co-Pilot',
    desc: 'Consult Spex AI assistant, run what-if simulations, and receipt vision',
  },
  {
    key: 'canExportData',
    label: 'Database Backup & Restore',
    desc: 'Export full SQL backups or restore database snapshots',
  },
  {
    key: 'canManageUsers',
    label: 'User & Role Administration',
    desc: 'Invite users, assign roles, customize permissions, and view security logs',
  },
];

const ROLE_LABELS: Record<UserRole, string> = {
  owner: 'Owner (Super Admin)',
  admin: 'Administrator',
  manager: 'Finance Manager',
  member: 'Standard Member',
  viewer: 'Viewer (Read-Only)',
};

export const UsersAndRolesSection: React.FC = () => {
  const { user: currentUser, token, refreshUserProfile, switchUserSession } = useAuth();

  const [usersList, setUsersList] = useState<ManagedUser[]>([]);
  const [rolesList, setRolesList] = useState<RoleDefinition[]>([]);
  const [auditLogs, setAuditLogs] = useState<UserAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [activeSubView, setActiveSubView] = useState<'directory' | 'matrix' | 'audit'>('directory');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Create / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ManagedUser | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete confirmation state
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [switchingUserId, setSwitchingUserId] = useState<string | null>(null);

  // Form fields
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('manager');
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('shared');
  const [avatarColor, setAvatarColor] = useState('indigo');
  const [notes, setNotes] = useState('');
  const [seedDefaultWallets, setSeedDefaultWallets] = useState(true);
  const [permissions, setPermissions] = useState<UserPermissions>({
    canWriteTransactions: true,
    canManageWallets: true,
    canManageBudgets: true,
    canAccessInvestments: true,
    canUseAiChat: true,
    canExportData: false,
    canManageUsers: false,
  });

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const fetchUsersAndRoles = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const data = await dashboardService.getUsersAndRoles(token);
      setUsersList(data.users || []);
      setRolesList(data.roles || []);
      setAuditLogs(data.auditLogs || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load users and roles');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUsersAndRoles();
  }, [fetchUsersAndRoles]);

  const canManageUsers =
    currentUser?.role === 'owner' ||
    currentUser?.role === 'admin' ||
    Boolean(currentUser?.permissions?.canManageUsers) ||
    Boolean(currentUser?.impersonatedBy);

  const handleSelectRoleInForm = (newRole: UserRole) => {
    setRole(newRole);
    const roleDef = rolesList.find((r) => r.role === newRole);
    if (roleDef) {
      setPermissions({ ...roleDef.defaultPermissions });
      if (!editingUser) {
        setWorkspaceMode(roleDef.defaultWorkspaceMode);
      }
    }
  };

  const openCreateModal = () => {
    setEditingUser(null);
    setFormError(null);
    setUsername('');
    setDisplayName('');
    setEmail('');
    setPassword('');
    setRole('manager');
    setWorkspaceMode('shared');
    setAvatarColor('emerald');
    setNotes('');
    setSeedDefaultWallets(true);
    const managerDef = rolesList.find((r) => r.role === 'manager');
    setPermissions(
      managerDef
        ? { ...managerDef.defaultPermissions }
        : {
            canWriteTransactions: true,
            canManageWallets: true,
            canManageBudgets: true,
            canAccessInvestments: true,
            canUseAiChat: true,
            canExportData: false,
            canManageUsers: false,
          }
    );
    setIsModalOpen(true);
  };

  const openEditModal = (target: ManagedUser) => {
    setEditingUser(target);
    setFormError(null);
    setUsername(target.username);
    setDisplayName(target.displayName);
    setEmail(target.email);
    setPassword('');
    setRole(target.role);
    setWorkspaceMode(target.workspaceMode);
    setAvatarColor(target.avatarColor || 'indigo');
    setNotes(target.notes || '');
    setPermissions({ ...target.permissions });
    setIsModalOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setFormError(null);
    setSubmitting(true);

    try {
      if (editingUser) {
        await dashboardService.updateManagedUser(
          editingUser.id,
          {
            username: username.trim(),
            displayName: displayName.trim(),
            email: email.trim(),
            role: editingUser.isOwnerAccount ? 'owner' : role,
            workspaceMode: editingUser.isOwnerAccount ? 'shared' : workspaceMode,
            permissions,
            avatarColor,
            notes: notes.trim() || null,
            ...(password.trim() ? { password: password.trim() } : {}),
          },
          token
        );
        showToast(`Updated profile & permissions for ${displayName || username}.`);
        if (editingUser.id === currentUser?.id) {
          await refreshUserProfile();
        }
      } else {
        await dashboardService.createManagedUser(
          {
            username: username.trim(),
            displayName: displayName.trim() || username.trim(),
            email: email.trim(),
            password,
            role,
            workspaceMode,
            permissions,
            avatarColor,
            notes: notes.trim() || undefined,
            seedDefaultWallets,
          },
          token
        );
        showToast(`Created user @${username.trim()} with role ${ROLE_LABELS[role]}.`);
      }

      setIsModalOpen(false);
      await fetchUsersAndRoles();
    } catch (err: any) {
      setFormError(err.message || 'Could not save user changes.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleSuspend = async (target: ManagedUser) => {
    if (!token || target.isOwnerAccount) return;
    const nextStatus = target.status === 'suspended' ? 'active' : 'suspended';
    try {
      await dashboardService.updateManagedUser(target.id, { status: nextStatus }, token);
      showToast(
        nextStatus === 'suspended'
          ? `Suspended @${target.username}.`
          : `Reactivated @${target.username}.`
      );
      await fetchUsersAndRoles();
    } catch (err: any) {
      showToast(err.message || 'Failed to update status');
    }
  };

  const handleQuickRoleChange = async (target: ManagedUser, newRole: UserRole) => {
    if (!token || target.isOwnerAccount) return;
    try {
      await dashboardService.updateManagedUser(target.id, { role: newRole }, token);
      showToast(`Changed @${target.username}'s role to ${ROLE_LABELS[newRole]}.`);
      await fetchUsersAndRoles();
    } catch (err: any) {
      showToast(err.message || 'Failed to update role');
    }
  };

  const handleDeleteUser = async (target: ManagedUser) => {
    if (!token || target.isOwnerAccount) return;
    try {
      await dashboardService.deleteManagedUser(target.id, token);
      setConfirmDeleteId(null);
      showToast(`Removed user @${target.username}.`);
      await fetchUsersAndRoles();
    } catch (err: any) {
      showToast(err.message || 'Failed to delete user');
    }
  };

  const handleSwitchSession = async (targetUserId: string, targetName: string) => {
    setSwitchingUserId(targetUserId);
    try {
      await switchUserSession(targetUserId);
      showToast(`Switched active session to ${targetName}.`);
      await fetchUsersAndRoles();
    } catch (err: any) {
      showToast(err.message || 'Could not switch session');
    } finally {
      setSwitchingUserId(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          u.username.toLowerCase().includes(q) ||
          u.displayName.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.role.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [usersList, roleFilter, searchQuery]);

  const getAvatarGradient = (color?: string) => {
    return AVATAR_COLORS.find((c) => c.id === color)?.bg || 'from-indigo-600 to-violet-600';
  };

  const totalActiveCount = usersList.filter((u) => u.status === 'active').length;
  const sharedLedgerCount = usersList.filter((u) => u.workspaceMode === 'shared').length;
  const isolatedCount = usersList.filter((u) => u.workspaceMode === 'isolated').length;
  const adminCount = usersList.filter((u) => u.role === 'owner' || u.role === 'admin').length;

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-xl bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 px-4 py-3 text-sm font-medium shadow-lg">
          <Check className="h-4 w-4 text-emerald-400 dark:text-emerald-600 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Impersonation Banner if currently previewing another user */}
      {currentUser?.impersonatedBy && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 px-4 py-3 text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <Eye className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs sm:text-sm">
              <span className="font-semibold">
                Previewing Workspace as {currentUser.displayName} (@{currentUser.username})
              </span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <span className="text-amber-800 dark:text-amber-300">
                Role: {ROLE_LABELS[currentUser.role || 'member']} ({currentUser.workspaceMode === 'shared' ? 'Shared Main Ledger' : 'Isolated Personal Ledger'})
              </span>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              currentUser.impersonatedBy &&
              handleSwitchSession(
                currentUser.impersonatedBy.id,
                currentUser.impersonatedBy.displayName
              )
            }
            className="border-amber-400 dark:border-amber-700 bg-white dark:bg-gray-900 text-amber-900 dark:text-amber-200 hover:bg-amber-100 dark:hover:bg-amber-900/50 shrink-0"
          >
            <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
            Return to Owner ({currentUser.impersonatedBy.username})
          </Button>
        </div>
      )}

      {/* Header & Sub-Navigation */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2.5 text-lg sm:text-xl">
                <ShieldCheck className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                User Management &amp; Role-Based Access Control
              </CardTitle>
              <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                Manage accounts, assign financial roles, and control whether members collaborate on your main ledger or operate in an isolated workspace.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveSubView('directory')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                    activeSubView === 'directory'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  <span>Users ({usersList.length})</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubView('matrix')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                    activeSubView === 'matrix'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>Roles &amp; Permissions</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveSubView('audit')}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                    activeSubView === 'audit'
                      ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>Security Log ({auditLogs.length})</span>
                </button>
              </div>

              {canManageUsers && (
                <Button
                  size="sm"
                  onClick={openCreateModal}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-1.5"
                >
                  <UserPlus className="h-4 w-4" />
                  <span>Add User</span>
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Summary KPI Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Active Accounts</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                {totalActiveCount} / {usersList.length}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                {usersList.length === 1 ? 'Single owner configured' : 'Multi-user RBAC enabled'}
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Admin &amp; Owner Seats</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                {adminCount}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Root owner account protected
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Workspace Topology</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white mt-1 font-mono">
                {sharedLedgerCount} Shared · {isolatedCount} Isolated
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Main ledger vs. private ledgers
              </p>
            </div>

            <div className="p-3.5 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-900/50">
              <p className="text-xs text-gray-500 dark:text-gray-400">Your Active Role</p>
              <p className="text-base font-bold text-indigo-600 dark:text-indigo-400 mt-1 truncate">
                {ROLE_LABELS[currentUser?.role || 'owner']}
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                @{currentUser?.username || 'SanSpend'} · {currentUser?.email}
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3.5 rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/30 text-xs text-red-700 dark:text-red-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
              <Button size="sm" variant="outline" onClick={fetchUsersAndRoles}>
                Retry
              </Button>
            </div>
          )}

          {/* ── SUBVIEW 1: USERS DIRECTORY ── */}
          {activeSubView === 'directory' && (
            <div className="space-y-4">
              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="relative flex-1 max-w-sm">
                  <Search className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by name, @username, or email..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs sm:text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-x-auto">
                  {(
                    [
                      { id: 'all', label: 'All Roles' },
                      { id: 'owner', label: 'Owner' },
                      { id: 'admin', label: 'Admin' },
                      { id: 'manager', label: 'Manager' },
                      { id: 'member', label: 'Member' },
                      { id: 'viewer', label: 'Viewer' },
                    ] as const
                  ).map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setRoleFilter(item.id)}
                      className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                        roleFilter === item.id
                          ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-2xs'
                          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2].map((n) => (
                    <div
                      key={n}
                      className="h-24 rounded-xl bg-gray-100 dark:bg-gray-800/60 animate-pulse"
                    />
                  ))}
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="text-center py-10 px-4 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
                  <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    No matching users found
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Try clearing your search filter or add a new user account.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredUsers.map((u) => {
                    const isCurrentSession = currentUser?.id === u.id;
                    const enabledPermCount = Object.values(u.permissions).filter(Boolean).length;

                    return (
                      <div
                        key={u.id}
                        className={`p-4 rounded-xl border transition-all ${
                          u.status === 'suspended'
                            ? 'border-red-200/80 dark:border-red-900/40 bg-red-50/20 dark:bg-red-950/10 opacity-80'
                            : u.isOwnerAccount
                            ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20'
                            : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/60'
                        }`}
                      >
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                          {/* Left: Identity & Metadata */}
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div
                              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr ${getAvatarGradient(
                                u.avatarColor
                              )} text-white font-bold text-base shadow-xs`}
                            >
                              {(u.displayName?.[0] || u.username?.[0] || 'U').toUpperCase()}
                            </div>

                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                <h4 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                                  {u.displayName}
                                </h4>
                                <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                  @{u.username}
                                </span>
                                {isCurrentSession && (
                                  <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                                    · Current Session
                                  </span>
                                )}
                                {u.status === 'suspended' && (
                                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    · Suspended
                                  </span>
                                )}
                              </div>

                              {/* Clean unboxed metadata row */}
                              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 dark:text-gray-400 mt-1">
                                <span>{u.email}</span>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-gray-700 dark:text-gray-300">
                                  {ROLE_LABELS[u.role]}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>
                                  {u.workspaceMode === 'shared'
                                    ? 'Shared Main Ledger'
                                    : 'Isolated Personal Workspace'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="font-mono">
                                  {u.stats.transactionCount} txns / {u.stats.walletCount} wallets
                                </span>
                                <span aria-hidden="true">·</span>
                                <span>{enabledPermCount}/7 capabilities</span>
                              </div>

                              {u.notes && (
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 italic">
                                  {u.notes}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Right: Role selector & Actions */}
                          <div className="flex flex-wrap items-center gap-2 pt-2 lg:pt-0 border-t lg:border-t-0 border-gray-100 dark:border-gray-800 shrink-0">
                            {!u.isOwnerAccount && canManageUsers && (
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  handleQuickRoleChange(u, e.target.value as UserRole)
                                }
                                aria-label={`Change role for ${u.displayName}`}
                                className="px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              >
                                <option value="admin">Administrator</option>
                                <option value="manager">Finance Manager</option>
                                <option value="member">Standard Member</option>
                                <option value="viewer">Viewer (Read-Only)</option>
                              </select>
                            )}

                            {/* Switch / Preview Session Button */}
                            {canManageUsers && !isCurrentSession && u.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={switchingUserId === u.id}
                                onClick={() => handleSwitchSession(u.id, u.displayName)}
                                title={`Switch into @${u.username}'s session to preview their role and workspace`}
                                className="text-xs flex items-center gap-1.5"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
                                <span>
                                  {switchingUserId === u.id ? 'Switching...' : 'Preview Session'}
                                </span>
                              </Button>
                            )}

                            {/* Edit Profile & Permissions */}
                            {(canManageUsers || isCurrentSession) && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => openEditModal(u)}
                                className="text-xs flex items-center gap-1.5"
                              >
                                <Edit3 className="h-3.5 w-3.5" />
                                <span>{u.isOwnerAccount ? 'Edit Owner Profile' : 'Configure'}</span>
                              </Button>
                            )}

                            {/* Suspend / Reactivate */}
                            {!u.isOwnerAccount && canManageUsers && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleToggleSuspend(u)}
                                className={`text-xs flex items-center gap-1.5 ${
                                  u.status === 'suspended'
                                    ? 'text-emerald-600 border-emerald-200 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400'
                                    : 'text-amber-600 border-amber-200 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400'
                                }`}
                              >
                                {u.status === 'suspended' ? (
                                  <>
                                    <UserCheck className="h-3.5 w-3.5" />
                                    <span>Activate</span>
                                  </>
                                ) : (
                                  <>
                                    <UserX className="h-3.5 w-3.5" />
                                    <span>Suspend</span>
                                  </>
                                )}
                              </Button>
                            )}

                            {/* Delete with inline confirmation */}
                            {!u.isOwnerAccount && canManageUsers && (
                              <>
                                {confirmDeleteId === u.id ? (
                                  <div className="flex items-center gap-1.5 bg-red-50 dark:bg-red-950/40 px-2 py-1 rounded-lg border border-red-200 dark:border-red-900/50">
                                    <span className="text-[11px] font-medium text-red-700 dark:text-red-300">
                                      Delete @{u.username}?
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteUser(u)}
                                      className="px-2 py-0.5 text-[11px] font-semibold bg-red-600 text-white rounded hover:bg-red-700"
                                    >
                                      Confirm
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setConfirmDeleteId(null)}
                                      className="px-1.5 py-0.5 text-[11px] text-gray-600 dark:text-gray-400 hover:text-gray-900"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setConfirmDeleteId(u.id)}
                                    className="text-xs text-red-600 border-red-200 hover:bg-red-50 dark:border-red-900/40 dark:text-red-400 px-2.5"
                                    title={`Delete @${u.username}`}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── SUBVIEW 2: ROLES & PERMISSION MATRIX ── */}
          {activeSubView === 'matrix' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                    <span>Shared Main Ledger Mode</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Users assigned to <strong>Shared Main Ledger</strong> view and collaborate on your primary TrueSpend financial workspace ({currentUser?.email || 'Owner'}), governed by their role permissions. Ideal for a partner, co-manager, or read-only accountant/auditor.
                  </p>
                </div>

                <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/50">
                  <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 dark:text-white">
                    <Lock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Isolated Personal Workspace Mode</span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1.5 leading-relaxed">
                    Users assigned to <strong>Isolated Workspace</strong> get their own completely separate TrueSpend ledger with dedicated wallets, transactions, budgets, and goals. Your personal financial data remains private.
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
                      <th className="py-3 px-4 text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Capability / Module
                      </th>
                      {rolesList.map((r) => (
                        <th
                          key={r.role}
                          className="py-3 px-4 text-xs font-semibold text-gray-900 dark:text-white text-center"
                        >
                          <div>{r.label}</div>
                          <div className="text-[10px] font-normal text-gray-500 dark:text-gray-400 mt-0.5">
                            Default: {r.defaultWorkspaceMode === 'shared' ? 'Shared' : 'Isolated'}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-800 text-xs">
                    {PERMISSION_LABELS.map((perm) => (
                      <tr
                        key={perm.key}
                        className="hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="font-medium text-gray-900 dark:text-white">
                            {perm.label}
                          </div>
                          <div className="text-[11px] text-gray-500 dark:text-gray-400">
                            {perm.desc}
                          </div>
                        </td>
                        {rolesList.map((r) => {
                          const allowed = r.defaultPermissions[perm.key];
                          return (
                            <td key={r.role} className="py-3 px-4 text-center">
                              {allowed ? (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400">
                                  <Check className="h-3.5 w-3.5" />
                                </span>
                              ) : (
                                <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600">
                                  <X className="h-3.5 w-3.5" />
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── SUBVIEW 3: SECURITY & AUDIT LOG ── */}
          {activeSubView === 'audit' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Recent authentication, role assignment, and access control events across your workspace.
                </p>
                <Button size="sm" variant="outline" onClick={fetchUsersAndRoles}>
                  <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                  Refresh
                </Button>
              </div>

              {auditLogs.length === 0 ? (
                <div className="text-center py-8 rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-xs text-gray-500 dark:text-gray-400">
                  No role or user management events recorded yet.
                </div>
              ) : (
                <div className="divide-y divide-gray-200 dark:divide-gray-800 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900/50">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex flex-wrap items-center gap-1.5 text-gray-900 dark:text-white font-medium">
                          <span>{log.actorName}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono text-indigo-600 dark:text-indigo-400">
                            {log.action}
                          </span>
                          <span aria-hidden="true">→</span>
                          <span>{log.targetUserName}</span>
                        </div>
                        <p className="text-gray-600 dark:text-gray-400">{log.details}</p>
                      </div>
                      <span className="text-[11px] font-mono text-gray-400 dark:text-gray-500 shrink-0">
                        {new Date(log.createdAt).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── CREATE / EDIT USER MODAL ── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl overflow-hidden my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  {editingUser
                    ? editingUser.isOwnerAccount
                      ? 'Edit Workspace Owner Profile'
                      : `Configure User: @${editingUser.username}`
                    : 'Create New User Account'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {editingUser?.isOwnerAccount
                    ? 'Update your display name, username, avatar color, or set a custom login password.'
                    : 'Assign login credentials, role level, ledger isolation mode, and module permissions.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-xs text-red-700 dark:text-red-300 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Identity Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Username (for login) *
                  </label>
                  <Input
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. sarah_finance"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Display Name *
                  </label>
                  <Input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Sarah Amrani"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Email Address *
                  </label>
                  <Input
                    type="email"
                    required
                    disabled={Boolean(editingUser?.isOwnerAccount)}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    {editingUser ? 'New Password (leave blank to keep current)' : 'Initial Password *'}
                  </label>
                  <Input
                    type="password"
                    required={!editingUser}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={editingUser ? '••••••••' : 'Minimum 4 characters'}
                  />
                </div>
              </div>

              {/* Avatar Color Picker */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Avatar Theme
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  {AVATAR_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setAvatarColor(c.id)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                        avatarColor === c.id
                          ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-900 dark:text-indigo-200 shadow-2xs'
                          : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className={`h-3.5 w-3.5 rounded-full bg-gradient-to-tr ${c.bg}`} />
                      <span>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Role & Workspace Mode (for non-owner accounts) */}
              {!editingUser?.isOwnerAccount && (
                <>
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Assign Role
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {rolesList
                        .filter((r) => r.role !== 'owner')
                        .map((r) => {
                          const isSelected = role === r.role;
                          return (
                            <button
                              key={r.role}
                              type="button"
                              onClick={() => handleSelectRoleInForm(r.role)}
                              className={`text-left p-3 rounded-xl border transition-all ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 dark:border-indigo-500'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-900 dark:text-white">
                                  {r.label}
                                </span>
                                {isSelected && (
                                  <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                                )}
                              </div>
                              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                                {r.shortDesc}
                              </p>
                            </button>
                          );
                        })}
                    </div>
                  </div>

                  {/* Workspace Mode Selection */}
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Ledger &amp; Data Access Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <button
                        type="button"
                        onClick={() => setWorkspaceMode('shared')}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          workspaceMode === 'shared'
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 dark:border-indigo-500'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            Shared Main Ledger
                          </span>
                          {workspaceMode === 'shared' && (
                            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Accesses your main household/team ledger according to the permissions below.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setWorkspaceMode('isolated')}
                        className={`text-left p-3 rounded-xl border transition-all ${
                          workspaceMode === 'isolated'
                            ? 'border-indigo-600 bg-indigo-50/60 dark:bg-indigo-950/40 dark:border-indigo-500'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-900 dark:text-white">
                            Isolated Personal Workspace
                          </span>
                          {workspaceMode === 'isolated' && (
                            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1">
                          Dedicated private wallets, transactions, and budgets separate from your data.
                        </p>
                      </button>
                    </div>

                    {!editingUser && workspaceMode === 'isolated' && (
                      <label className="flex items-center gap-2 pt-1 text-xs text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={seedDefaultWallets}
                          onChange={(e) => setSeedDefaultWallets(e.target.checked)}
                          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span>Initialize with default Main Bank &amp; Cash wallets</span>
                      </label>
                    )}
                  </div>

                  {/* Granular Module Permissions */}
                  <div className="space-y-2 pt-2 border-t border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between">
                      <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                        Granular Module Permissions
                      </label>
                      <span className="text-[11px] text-gray-500 dark:text-gray-400">
                        Customize individual capabilities for this user
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {PERMISSION_LABELS.map((perm) => {
                        const checked = permissions[perm.key];
                        return (
                          <label
                            key={perm.key}
                            className={`flex items-start gap-2.5 p-2.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                              checked
                                ? 'border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20'
                                : 'border-gray-200 dark:border-gray-800 bg-gray-50/40 dark:bg-gray-900/40'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) =>
                                setPermissions((prev) => ({
                                  ...prev,
                                  [perm.key]: e.target.checked,
                                }))
                              }
                              className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <div className="font-semibold text-gray-900 dark:text-white">
                                {perm.label}
                              </div>
                              <div className="text-[11px] text-gray-500 dark:text-gray-400 leading-snug mt-0.5">
                                {perm.desc}
                              </div>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Role / Account Notes (optional)
                </label>
                <Input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Household partner account or CPA tax advisor read-only access"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-200 dark:border-gray-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={submitting}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {submitting
                    ? 'Saving...'
                    : editingUser
                    ? 'Save User Configuration'
                    : 'Create User Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
