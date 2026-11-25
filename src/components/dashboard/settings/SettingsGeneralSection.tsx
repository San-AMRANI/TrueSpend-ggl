import React, { useState } from 'react';
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronUp,
  Landmark,
  Layers,
  LogOut,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../ui/Button';
import { TemplatesGallery } from '../../onboarding/TemplatesGallery';
import type { DashboardTab, ExperienceTier, Wallet } from '../../../types';

interface PreservedSummary {
  investmentsCount: number;
  contextsCount: number;
  rulesCount: number;
  statementBatchesCount: number;
}

export interface SettingsGeneralSectionProps {
  user: any;
  isAdvanced: boolean;
  canManageUsers: boolean;
  wallets: Wallet[];
  displayName: string;
  setDisplayName: (v: string) => void;
  baseCurrency: string;
  setBaseCurrency: (v: string) => void;
  countryCode: string;
  setCountryCode: (v: string) => void;
  timezone: string;
  setTimezone: (v: string) => void;
  locale: string;
  setLocale: (v: string) => void;
  savingProfile: boolean;
  isSaving: boolean;
  profileNotice: string | null;
  onSaveProfile: (e: React.FormEvent) => void;
  switchingTier: boolean;
  tierFeedback: string | null;
  preservedSummary: PreservedSummary | null;
  onSwitchTier: (tier: ExperienceTier) => void;
  onSignOut: () => void;
  setActiveTab?: (tab: DashboardTab) => void;
  onDataChange?: () => Promise<void> | void;
}

export const SettingsGeneralSection: React.FC<SettingsGeneralSectionProps> = ({
  user,
  isAdvanced,
  canManageUsers,
  wallets,
  displayName,
  setDisplayName,
  baseCurrency,
  setBaseCurrency,
  countryCode,
  setCountryCode,
  timezone,
  setTimezone,
  locale,
  setLocale,
  savingProfile,
  isSaving,
  profileNotice,
  onSaveProfile,
  switchingTier,
  tierFeedback,
  preservedSummary,
  onSwitchTier,
  onSignOut,
  setActiveTab,
  onDataChange,
}) => {
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const initials = (
    user?.displayName?.[0] ||
    user?.username?.[0] ||
    user?.email?.[0] ||
    'U'
  ).toUpperCase();

  const roleLabel =
    user?.role === 'owner'
      ? 'Owner'
      : user?.role === 'admin'
      ? 'Administrator'
      : 'Account Holder';

  return (
    <div className="space-y-6">
      {/* 1. Account Identity & Regional Defaults */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        {/* Identity Header Row */}
        <div className="p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white font-semibold text-base">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                  {user?.displayName || user?.username || user?.email?.split('@')[0] || 'Member'}
                </h2>
                {user?.username && (
                  <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                    @{user.username}
                  </span>
                )}
              </div>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-gray-500 dark:text-gray-400">
                <span className="truncate">{user?.email || 'Authenticated User'}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-gray-700 dark:text-gray-300">{roleLabel}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    user?.emailVerified === false
                      ? 'text-amber-600 dark:text-amber-400 font-medium'
                      : 'text-emerald-600 dark:text-emerald-400 font-medium'
                  }
                >
                  {user?.emailVerified === false ? 'Verification pending' : 'Verified'}
                </span>
              </div>
              {user?.pendingEmail && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                  Pending email confirmation: <strong className="font-medium">{user.pendingEmail}</strong>
                </p>
              )}
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onSignOut}
            className="shrink-0 whitespace-nowrap gap-1.5 text-xs text-rose-600 border-rose-200 hover:bg-rose-50 dark:border-rose-900/50 dark:text-rose-400 dark:hover:bg-rose-950/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>

        {/* Regional Preferences Form */}
        <form onSubmit={onSaveProfile} className="p-5 sm:p-6 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Profile &amp; Regional Defaults
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Used for currency formatting, payroll cycle dates, and local reporting.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label
                htmlFor="settings-display-name"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Display Name
              </label>
              <input
                id="settings-display-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your name"
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="settings-base-currency"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Base Currency
              </label>
              <select
                id="settings-base-currency"
                value={baseCurrency}
                onChange={(e) => setBaseCurrency(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              >
                <option value="MAD">MAD — Moroccan Dirham</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="CAD">CAD — Canadian Dollar</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="settings-country"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Country &amp; Language Locale
              </label>
              <div className="flex gap-2">
                <input
                  id="settings-country"
                  type="text"
                  maxLength={8}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  placeholder="MA"
                  aria-label="Country code"
                  className="w-20 h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
                <input
                  id="settings-locale"
                  type="text"
                  maxLength={10}
                  value={locale}
                  onChange={(e) => setLocale(e.target.value)}
                  placeholder="en"
                  aria-label="Language locale"
                  className="flex-1 h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="settings-timezone"
                className="block text-xs font-medium text-gray-700 dark:text-gray-300"
              >
                Timezone
              </label>
              <input
                id="settings-timezone"
                type="text"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Africa/Casablanca"
                className="w-full h-9 px-3 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 dark:border-gray-800">
            <div className="text-xs text-indigo-600 dark:text-indigo-400 font-medium min-h-[1rem]">
              {profileNotice || ''}
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={savingProfile || isSaving}
              className="whitespace-nowrap px-4"
            >
              {savingProfile ? 'Saving...' : 'Save Preferences'}
            </Button>
          </div>
        </form>
      </section>

      {/* 2. Workspace Complexity Mode */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Workspace Mode
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Both modes are free. Switching adjusts visible tools without removing any saved data.
            </p>
          </div>
          <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400">
            Active: {isAdvanced ? 'Advanced · Free' : 'Basic · Free'}
          </span>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div
            className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors ${
              !isAdvanced
                ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/15'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                  <Layers className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  Basic · Free
                </span>
                {!isAdvanced && (
                  <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Everyday essentials: Overview, Transactions, Wallets, Budgets, Calendar, Debts, Goals, Subscriptions, and Core Reports.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!isAdvanced || switchingTier}
              onClick={() => onSwitchTier('basic')}
              className="text-xs whitespace-nowrap"
            >
              {!isAdvanced ? 'Current Mode' : switchingTier ? 'Switching...' : 'Switch to Basic'}
            </Button>
          </div>

          <div
            className={`rounded-lg border p-4 flex flex-col justify-between gap-3 transition-colors ${
              isAdvanced
                ? 'border-indigo-500 bg-indigo-50/30 dark:bg-indigo-950/15'
                : 'border-gray-200 dark:border-gray-800'
            }`}
          >
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gray-900 dark:text-white">
                  <Sparkles className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Advanced · Free
                </span>
                {isAdvanced && (
                  <span className="text-xs font-medium text-indigo-700 dark:text-indigo-400 inline-flex items-center gap-1">
                    <Check className="h-3.5 w-3.5" /> Active
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Full suite: Predictive Forecast, Simulators, Stocks &amp; Equities, Contexts, Rules Engine, and Cloud/SQL Backups.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isAdvanced || switchingTier}
              onClick={() => onSwitchTier('advanced')}
              className="text-xs whitespace-nowrap"
            >
              {isAdvanced ? 'Current Mode' : switchingTier ? 'Switching...' : 'Switch to Advanced'}
            </Button>
          </div>
        </div>

        {tierFeedback && (
          <div className="rounded-lg border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/40 dark:bg-indigo-950/20 px-3.5 py-2.5 text-xs text-indigo-800 dark:text-indigo-200">
            <p>{tierFeedback}</p>
            {preservedSummary && (
              <p className="mt-1 text-[11px] opacity-85 tabular-nums">
                Preserved safely: {preservedSummary.investmentsCount} equities ·{' '}
                {preservedSummary.contextsCount} contexts · {preservedSummary.rulesCount} rules ·{' '}
                {preservedSummary.statementBatchesCount} statement batches
              </p>
            )}
          </div>
        )}
      </section>

      {/* 3. Workspace Shortcuts & Guided Setup */}
      <section className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 divide-y divide-gray-100 dark:divide-gray-800">
        <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <Landmark className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {isAdvanced ? 'Accounts & Accounting Workbench' : 'Wallets & Balances'}
              </h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                {wallets.length} configured wallet{wallets.length === 1 ? '' : 's'}
                {isAdvanced ? ' · CSV import, review inbox & journal' : ''}
              </p>
            </div>
          </div>
          {setActiveTab && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setActiveTab('accounts')}
              className="shrink-0 whitespace-nowrap gap-1 text-xs self-start sm:self-auto"
            >
              Open <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>

        {canManageUsers && (
          <div className="p-4 sm:px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Users, Roles &amp; Access Control
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Manage registered accounts, invitation codes, and workspace permissions.
                </p>
              </div>
            </div>
            {setActiveTab && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('users')}
                className="shrink-0 whitespace-nowrap gap-1 text-xs self-start sm:self-auto"
              >
                Manage <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}

        <div className="p-4 sm:px-6 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-3">
              <RefreshCw className="h-4 w-4 text-gray-500 dark:text-gray-400 mt-0.5 shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                  Guided Setup Wizard &amp; Starter Templates
                </h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Re-run initial setup or preview optional budget and goal presets.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => window.dispatchEvent(new CustomEvent('truespend:openOnboarding'))}
                className="text-xs whitespace-nowrap"
              >
                Launch Wizard
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setTemplatesOpen((prev) => !prev)}
                aria-expanded={templatesOpen}
                className="text-xs whitespace-nowrap gap-1"
              >
                {templatesOpen ? 'Hide Templates' : 'Browse Templates'}
                {templatesOpen ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>

          {templatesOpen && (
            <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
              <TemplatesGallery compact onApplied={() => onDataChange?.()} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
