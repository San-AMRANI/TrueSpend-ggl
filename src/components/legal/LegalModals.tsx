import React, { useState } from 'react';
import { X, Shield, FileText, Lock, Download, Trash2 } from 'lucide-react';

interface LegalModalProps {
  isOpen: boolean;
  initialTab?: 'privacy' | 'terms';
  onClose: () => void;
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  initialTab = 'privacy',
  onClose,
}) => {
  const [tab, setTab] = useState<'privacy' | 'terms'>(initialTab);

  React.useEffect(() => {
    setTab(initialTab);
  }, [initialTab, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTab('privacy')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'privacy'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <Shield className="h-3.5 w-3.5" />
              Privacy Policy
            </button>
            <button
              type="button"
              onClick={() => setTab('terms')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                tab === 'terms'
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              }`}
            >
              <FileText className="h-3.5 w-3.5" />
              Terms of Service
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close legal modal"
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
          {tab === 'privacy' ? (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  TrueSpend Privacy Policy
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Your private financial workspace belongs strictly to your account.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/70 dark:bg-gray-950/40">
                  <Lock className="h-4 w-4 text-indigo-600 dark:text-indigo-400 mb-1.5" />
                  <p className="font-semibold text-xs text-gray-900 dark:text-white">Strict Isolation</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Every user ledger, wallet, and goal is scoped solely to their verified user ID.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/70 dark:bg-gray-950/40">
                  <Download className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mb-1.5" />
                  <p className="font-semibold text-xs text-gray-900 dark:text-white">Full Data Portability</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Download your complete financial dataset as structured JSON or CSV at any time.
                  </p>
                </div>
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 bg-gray-50/70 dark:bg-gray-950/40">
                  <Trash2 className="h-4 w-4 text-rose-600 dark:text-rose-400 mb-1.5" />
                  <p className="font-semibold text-xs text-gray-900 dark:text-white">Verified Deletion</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    Delete your account and purge stored records cleanly from Settings anytime.
                  </p>
                </div>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">1. Data You Provide</h3>
                <p>
                  TrueSpend stores the account details you provide during registration (email,
                  display name, locale/currency preferences) and the financial entries you create
                  (accounts, transactions, budgets, debts, goals, subscriptions, and notes).
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  2. Security &amp; Credentials
                </h3>
                <p>
                  Passwords are hashed with unique per-user salts using asynchronous scrypt key
                  derivation and never stored in plaintext. Connected integration credentials such as
                  Google Drive tokens are encrypted at rest and never exposed in browser API
                  responses.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  3. Third-Party Services
                </h3>
                <p>
                  TrueSpend does not sell your data or connect to bank credentials. Optional external
                  calls occur only when you actively invoke AI queries (Spex AI), Google Drive
                  backups you authorize, or market price lookups in Advanced Investments.
                </p>
              </section>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  TrueSpend Terms of Service
                </h2>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Personal financial organization software — free Basic &amp; Advanced modes.
                </p>
              </div>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">1. Informational Use</h3>
                <p>
                  TrueSpend provides personal expense tracking, budgeting, forecasting, and
                  calculators for informational organization only. It does not constitute licensed
                  tax, legal, accounting, or investment advice.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  2. Free Experience Tiers
                </h3>
                <p>
                  Both the Basic and Advanced TrueSpend experiences are provided free of charge.
                  Switching between Basic and Advanced hides or reveals tools to match your
                  preferred complexity and never deletes your underlying financial records.
                </p>
              </section>

              <section className="space-y-1.5">
                <h3 className="font-semibold text-gray-900 dark:text-white">
                  3. Account Responsibility
                </h3>
                <p>
                  You are responsible for safeguarding your passphrase and verifying your email
                  address. Do not share credentials; audit active sessions regularly in Settings
                  → Security.
                </p>
              </section>
            </>
          )}
        </div>

        <div className="px-5 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/40 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
