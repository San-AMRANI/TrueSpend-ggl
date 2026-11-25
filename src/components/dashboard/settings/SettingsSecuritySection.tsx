import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  History,
  Lock,
  Trash2,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import type { AccountSecurityEventInfo, AuthSessionInfo } from '../../../types';

export interface SettingsSecuritySectionProps {
  sessions: AuthSessionInfo[];
  securityEvents: AccountSecurityEventInfo[];
  loadingSecurity: boolean;
  currentPwForChange: string;
  setCurrentPwForChange: (v: string) => void;
  newPasswordInput: string;
  setNewPasswordInput: (v: string) => void;
  pwFeedback: { type: 'ok' | 'err'; text: string } | null;
  changingPw: boolean;
  onChangePassword: (e: React.FormEvent) => void;
  currentPwForEmail: string;
  setCurrentPwForEmail: (v: string) => void;
  newEmailInput: string;
  setNewEmailInput: (v: string) => void;
  emailFeedback: { type: 'ok' | 'err'; text: string } | null;
  pendingEmailChangeToken: string | null;
  pendingEmailPreviewUrl: string | null;
  changingEmail: boolean;
  onChangeEmail: (e: React.FormEvent) => void;
  onConfirmPendingEmailChange: () => void;
  revokingSessionId: string | null;
  loggingOutAll: boolean;
  onRevokeSession: (id: string) => void;
  onLogoutAllDevices: () => void;
  exportingPersonalJson: boolean;
  onExportPersonalJson: () => void;
  onOpenLegalModal: (tab: 'privacy' | 'terms') => void;
  deleteFlowOpen: boolean;
  setDeleteFlowOpen: (v: boolean) => void;
  deletePassword: string;
  setDeletePassword: (v: string) => void;
  deleteConfirmText: string;
  setDeleteConfirmText: (v: string) => void;
  deleteError: string | null;
  setDeleteError: (v: string | null) => void;
  deletingAccount: boolean;
  onDeleteOwnAccount: (e: React.FormEvent) => void;
}

export const SettingsSecuritySection: React.FC<SettingsSecuritySectionProps> = ({
  sessions,
  securityEvents,
  loadingSecurity,
  currentPwForChange,
  setCurrentPwForChange,
  newPasswordInput,
  setNewPasswordInput,
  pwFeedback,
  changingPw,
  onChangePassword,
  currentPwForEmail,
  setCurrentPwForEmail,
  newEmailInput,
  setNewEmailInput,
  emailFeedback,
  pendingEmailChangeToken,
  pendingEmailPreviewUrl,
  changingEmail,
  onChangeEmail,
  onConfirmPendingEmailChange,
  revokingSessionId,
  loggingOutAll,
  onRevokeSession,
  onLogoutAllDevices,
  exportingPersonalJson,
  onExportPersonalJson,
  onOpenLegalModal,
  deleteFlowOpen,
  setDeleteFlowOpen,
  deletePassword,
  setDeletePassword,
  deleteConfirmText,
  setDeleteConfirmText,
  deleteError,
  setDeleteError,
  deletingAccount,
  onDeleteOwnAccount,
}) => {
  const [activityOpen, setActivityOpen] = useState(false);
  const [showAllSessions, setShowAllSessions] = useState(false);
  const sortedSessions = [...sessions].sort((a, b) => Number(Boolean(b.isCurrent)) - Number(Boolean(a.isCurrent)));
  const visibleSessions = showAllSessions ? sortedSessions : sortedSessions.slice(0, 4);

  return (
    <div className="space-y-6">
      {/* 1. Credentials (Password & Email) */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Lock className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
            Login &amp; Credentials
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Update your password or change your verified login email address.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100 dark:divide-gray-800">
          {/* Change Password */}
          <form onSubmit={onChangePassword} className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">Change Password</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Minimum 12 characters. Revokes other active sessions automatically.
              </p>
            </div>
            <div className="space-y-2.5">
              <input
                type="password"
                required
                aria-label="Current password"
                value={currentPwForChange}
                onChange={(e) => setCurrentPwForChange(e.target.value)}
                placeholder="Current password"
                className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="password"
                required
                minLength={12}
                aria-label="New password"
                value={newPasswordInput}
                onChange={(e) => setNewPasswordInput(e.target.value)}
                placeholder="New password (12+ characters)"
                className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            {pwFeedback && (
              <p
                className={`text-xs ${
                  pwFeedback.type === 'ok'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {pwFeedback.text}
              </p>
            )}
            <Button type="submit" size="sm" disabled={changingPw} className="text-xs whitespace-nowrap">
              {changingPw ? 'Updating...' : 'Update Password'}
            </Button>
          </form>

          {/* Change Email */}
          <form onSubmit={onChangeEmail} className="p-5 sm:p-6 space-y-3">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Change Account Email
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                A verification link is sent to the new address before switching.
              </p>
            </div>
            <div className="space-y-2.5">
              <input
                type="password"
                required
                aria-label="Confirm current password for email change"
                value={currentPwForEmail}
                onChange={(e) => setCurrentPwForEmail(e.target.value)}
                placeholder="Confirm current password"
                className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
              <input
                type="email"
                required
                aria-label="New email address"
                value={newEmailInput}
                onChange={(e) => setNewEmailInput(e.target.value)}
                placeholder="New email address"
                className="w-full h-9 px-3 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>
            {emailFeedback && (
              <p
                className={`text-xs break-words ${
                  emailFeedback.type === 'ok'
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-rose-600 dark:text-rose-400'
                }`}
              >
                {emailFeedback.text}
              </p>
            )}
            {pendingEmailChangeToken && (
              <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20 p-2.5 text-xs space-y-2">
                <p className="font-mono text-[11px] break-all text-emerald-900 dark:text-emerald-200">
                  Verification token: <strong>{pendingEmailChangeToken}</strong>
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    disabled={changingEmail}
                    onClick={onConfirmPendingEmailChange}
                    className="text-xs whitespace-nowrap"
                  >
                    {changingEmail ? 'Confirming...' : 'Confirm New Email'}
                  </Button>
                  {pendingEmailPreviewUrl && (
                    <a
                      href={pendingEmailPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                    >
                      Open Preview ↗
                    </a>
                  )}
                </div>
              </div>
            )}
            <Button
              type="submit"
              size="sm"
              variant="outline"
              disabled={changingEmail}
              className="text-xs whitespace-nowrap"
            >
              {changingEmail ? 'Sending...' : 'Send Verification Link'}
            </Button>
          </form>
        </div>
      </section>

      {/* 2. Active Devices & Sessions */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="p-5 sm:p-6 border-b border-gray-100 dark:border-gray-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white tabular-nums">
              Active Devices &amp; Sessions ({sessions.length})
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Revoke any unfamiliar browser or mobile session immediately.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={loggingOutAll}
            onClick={onLogoutAllDevices}
            className="text-xs whitespace-nowrap text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
          >
            {loggingOutAll ? 'Signing Out...' : 'Log Out All Devices'}
          </Button>
        </div>

        <div className="px-5 sm:px-6">
          {loadingSecurity && sessions.length === 0 ? (
            <p className="py-5 text-xs text-gray-500 dark:text-gray-400">Loading active sessions...</p>
          ) : sessions.length === 0 ? (
            <p className="py-5 text-xs text-gray-500 dark:text-gray-400">
              No tracked refresh sessions found.
            </p>
          ) : (
            <>
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {visibleSessions.map((sess) => (
                  <div
                    key={sess.id}
                    className="py-3.5 flex flex-wrap items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          {sess.deviceLabel || 'Web Browser'}
                        </span>
                        {sess.isCurrent && (
                          <>
                            <span aria-hidden="true" className="text-gray-300 dark:text-gray-700">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              Current Session
                            </span>
                          </>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono tabular-nums truncate">
                        IP {sess.ipAddress || 'Unknown'} · Last active{' '}
                        {new Date(sess.lastUsedAt).toLocaleString()}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={revokingSessionId === sess.id}
                      onClick={() => onRevokeSession(sess.id)}
                      className="text-xs whitespace-nowrap text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400"
                    >
                      {revokingSessionId === sess.id ? 'Revoking...' : 'Revoke'}
                    </Button>
                  </div>
                ))}
              </div>
              {sortedSessions.length > 4 && (
                <div className="py-2.5 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAllSessions((v) => !v)}
                    className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                  >
                    {showAllSessions
                      ? 'Show fewer sessions'
                      : `Show all ${sortedSessions.length} active sessions`}
                  </button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Collapsible Security Activity Log */}
        {securityEvents.length > 0 && (
          <div className="px-5 sm:px-6 py-3.5 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={() => setActivityOpen((prev) => !prev)}
              aria-expanded={activityOpen}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            >
              <History className="h-3.5 w-3.5" />
              Recent Security Activity ({securityEvents.length})
              {activityOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>
            {activityOpen && (
              <div className="mt-3 divide-y divide-gray-100 dark:divide-gray-800 max-h-48 overflow-y-auto text-xs">
                {securityEvents.slice(0, 10).map((ev) => (
                  <div
                    key={ev.id}
                    className="py-2 flex flex-wrap items-center justify-between gap-2"
                  >
                    <span className="text-gray-700 dark:text-gray-300">
                      <span className="font-mono text-[11px] font-semibold">{ev.eventType}</span> ·{' '}
                      <span
                        className={
                          ev.outcome === 'failure'
                            ? 'text-rose-600 dark:text-rose-400'
                            : 'text-emerald-600 dark:text-emerald-400'
                        }
                      >
                        {ev.outcome}
                      </span>{' '}
                      <span className="text-gray-500">
                        ({ev.deviceSummary || ev.ipAddress || 'Web'})
                      </span>
                    </span>
                    <span className="text-[11px] text-gray-400 font-mono tabular-nums">
                      {new Date(ev.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 3. Privacy, Data Portability & Danger Zone */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <FileText className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Privacy &amp; Personal Data Export
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Download a full JSON copy of your records or review legal documentation.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={exportingPersonalJson}
              onClick={onExportPersonalJson}
              className="text-xs whitespace-nowrap gap-1.5"
            >
              <Download className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400" />
              {exportingPersonalJson ? 'Preparing...' : 'Export JSON'}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenLegalModal('privacy')}
              className="text-xs whitespace-nowrap"
            >
              Privacy Policy
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenLegalModal('terms')}
              className="text-xs whitespace-nowrap"
            >
              Terms
            </Button>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="p-5 sm:p-6 bg-rose-50/30 dark:bg-rose-950/10 space-y-3 rounded-b-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-rose-700 dark:text-rose-400 flex items-center gap-1.5">
                <Trash2 className="h-4 w-4" />
                Delete Account Permanently
              </h3>
              <p className="text-xs text-rose-700/80 dark:text-rose-300/80 mt-0.5">
                Permanently erases your profile, wallets, transactions, budgets, goals, debts, and sessions.
              </p>
            </div>
            {!deleteFlowOpen && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setDeleteFlowOpen(true)}
                className="text-xs whitespace-nowrap text-rose-600 border-rose-300 hover:bg-rose-100 dark:border-rose-800 dark:text-rose-400"
              >
                Delete Account...
              </Button>
            )}
          </div>

          {deleteFlowOpen && (
            <form
              onSubmit={onDeleteOwnAccount}
              className="space-y-3 pt-3 border-t border-rose-200 dark:border-rose-900/50"
            >
              <div className="grid gap-2.5 sm:grid-cols-2">
                <input
                  type="password"
                  required
                  aria-label="Current password to delete account"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter current password"
                  className="h-9 px-3 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white"
                />
                <input
                  type="text"
                  required
                  aria-label="Type DELETE to confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  placeholder="Type DELETE to confirm"
                  className="h-9 px-3 text-xs rounded-lg border border-rose-200 dark:border-rose-800 bg-white dark:bg-gray-900 text-gray-900 dark:text-white font-mono"
                />
              </div>
              {deleteError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {deleteError}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="submit"
                  size="sm"
                  disabled={deletingAccount}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs whitespace-nowrap"
                >
                  {deletingAccount ? 'Deleting...' : 'Permanently Delete Account'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setDeleteFlowOpen(false);
                    setDeleteError(null);
                    setDeletePassword('');
                    setDeleteConfirmText('');
                  }}
                  className="text-xs whitespace-nowrap"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>
  );
};
