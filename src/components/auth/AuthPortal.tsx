import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Layers,
  Ticket,
  ArrowLeft,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { dashboardService } from '../../services/api/dashboardService';
import { ApiError } from '../../services/api/apiClient';
import { Button } from '../ui/Button';
import { LegalModal } from '../legal/LegalModals';
import type { ExperienceTier } from '../../types';

type AuthMode = 'login' | 'register' | 'verify' | 'forgot' | 'reset';

interface AuthPortalProps {
  appIconSrc: string;
}

function getPasswordStrength(pw: string) {
  const length = pw.length;
  const hasUpper = /[A-Z]/.test(pw);
  const hasLower = /[a-z]/.test(pw);
  const hasNum = /\d/.test(pw);
  const hasSymbol = /[^A-Za-z0-9]/.test(pw);
  const isPassphrase = length >= 16 || pw.trim().includes(' ');
  const variety = [hasUpper, hasLower, hasNum, hasSymbol].filter(Boolean).length;

  if (length === 0) return { label: '', score: 0, color: 'bg-gray-200' };
  if (length < 12) return { label: 'Too short (min 12 chars)', score: 1, color: 'bg-rose-500' };
  if (isPassphrase || (length >= 14 && variety >= 3)) {
    return { label: 'Strong passphrase', score: 4, color: 'bg-emerald-500' };
  }
  if (variety >= 2) return { label: 'Good', score: 3, color: 'bg-indigo-500' };
  return { label: 'Fair — add length or spaces', score: 2, color: 'bg-amber-500' };
}

export const AuthPortal: React.FC<AuthPortalProps> = ({ appIconSrc }) => {
  const { signIn } = useAuth();
  const [mode, setMode] = useState<AuthMode>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [experienceTier, setExperienceTier] = useState<ExperienceTier>('basic');
  const [showInviteField, setShowInviteField] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStatus, setInviteStatus] = useState<{
    checked?: boolean;
    valid?: boolean;
    message?: string;
  }>({});

  const [verifyTokenInput, setVerifyTokenInput] = useState('');
  const [resetTokenInput, setResetTokenInput] = useState('');
  const [pendingVerifyEmail, setPendingVerifyEmail] = useState('');
  const [devPreviewToken, setDevPreviewToken] = useState<string | null>(null);
  const [deliveryWarning, setDeliveryWarning] = useState<string | null>(null);
  const [emailPreviewUrl, setEmailPreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [legalOpen, setLegalOpen] = useState(false);
  const [legalTab, setLegalTab] = useState<'privacy' | 'terms'>('privacy');

  // Auto-detect verifyToken / resetToken / invite / mode query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const vToken = params.get('verifyToken');
    const rToken = params.get('resetToken');
    const invite = params.get('invite');
    const reqMode = params.get('mode');

    if (vToken) {
      setVerifyTokenInput(vToken);
      setMode('verify');
      handleVerifyToken(vToken);
    } else if (rToken) {
      setResetTokenInput(rToken);
      setMode('reset');
    } else if (invite) {
      setShowInviteField(true);
      setInviteCode(invite);
      setMode('register');
      validateInvite(invite);
    } else if (reqMode === 'register') {
      setMode('register');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFeedback = () => {
    setError('');
    setNotice('');
    setDeliveryWarning(null);
    setEmailPreviewUrl(null);
  };

  const switchMode = (next: AuthMode) => {
    clearFeedback();
    setMode(next);
  };

  const validateInvite = async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) {
      setInviteStatus({});
      return;
    }
    try {
      const res = await dashboardService.validateInvitationCode(trimmed);
      setInviteStatus({
        checked: true,
        valid: res.valid,
        message: res.valid
          ? `Invitation recognized (${res.campaign || 'early access'})`
          : res.reason || 'Code unrecognized — you can still register without it.',
      });
    } catch {
      setInviteStatus({
        checked: true,
        valid: false,
        message: 'Could not validate code, but signup remains open.',
      });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setIsSubmitting(true);
    try {
      const res = await dashboardService.loginAccount({
        email: identifier.trim(),
        password,
      });
      signIn(res.accessToken || res.token, res.user, res.refreshToken);
    } catch (err: any) {
      if (err instanceof ApiError && err.code === 'EMAIL_VERIFICATION_REQUIRED') {
        setPendingVerifyEmail(err.extra?.email || identifier.trim());
        const instantToken = err.extra?.devVerificationToken || null;
        setDeliveryWarning(err.extra?.emailDeliveryWarning || null);
        setEmailPreviewUrl(err.extra?.emailPreviewUrl || null);
        if (instantToken) {
          setDevPreviewToken(instantToken);
          setVerifyTokenInput(instantToken);
          setNotice(err.message);
        } else {
          setError(err.message);
        }
        setMode('verify');
      } else {
        setError(err?.message || 'Sign in failed');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (password.length < 12) {
      setError('Password must be at least 12 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      const detectedTimezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Casablanca';
      const detectedLocale = (navigator.language || 'en').split('-')[0] || 'en';

      const res = await dashboardService.registerAccount({
        email: email.trim(),
        username: username.trim() || undefined,
        displayName: displayName.trim() || undefined,
        password,
        experienceTier,
        inviteCode: inviteCode.trim() || undefined,
        timezone: detectedTimezone,
        locale: detectedLocale,
      });

      setPendingVerifyEmail(email.trim().toLowerCase());
      setNotice(
        res.invitationWarning
          ? `${res.message} ${res.invitationWarning}`
          : res.message
      );
      setDeliveryWarning(res.emailDeliveryWarning || null);
      setEmailPreviewUrl(res.emailPreviewUrl || null);
      setDevPreviewToken(res.devVerificationToken || null);
      setVerifyTokenInput(res.devVerificationToken || '');
      setPassword('');
      setConfirmPassword('');
      setMode('verify');
    } catch (err: any) {
      setError(err?.message || 'Registration failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyToken = async (overrideToken?: string) => {
    const tokenToUse = (overrideToken ?? verifyTokenInput).trim();
    if (!tokenToUse) {
      setError('Enter the verification code sent to your email.');
      return;
    }
    clearFeedback();
    setIsSubmitting(true);
    try {
      const res = await dashboardService.verifyEmailToken(tokenToUse);
      // Clean URL query param cleanly
      if (window.location.search.includes('verifyToken')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      signIn(res.accessToken || res.token, res.user, res.refreshToken);
    } catch (err: any) {
      setError(err?.message || 'Verification failed or link expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendVerification = async () => {
    const targetEmail = (pendingVerifyEmail || email || identifier).trim();
    if (!targetEmail) {
      setError('Enter your email address to resend verification.');
      return;
    }
    clearFeedback();
    setIsSubmitting(true);
    try {
      const res = await dashboardService.resendVerificationEmail(targetEmail);
      setNotice(res.message);
      setDeliveryWarning(res.emailDeliveryWarning || null);
      setEmailPreviewUrl(res.emailPreviewUrl || null);
      if (res.devVerificationToken) {
        setDevPreviewToken(res.devVerificationToken);
        setVerifyTokenInput(res.devVerificationToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Could not resend verification email.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    setIsSubmitting(true);
    try {
      const res = await dashboardService.forgotPasswordRequest(email.trim());
      setNotice(res.message);
      setDeliveryWarning(res.emailDeliveryWarning || null);
      setEmailPreviewUrl(res.emailPreviewUrl || null);
      if (res.devResetToken) {
        setDevPreviewToken(res.devResetToken);
        setResetTokenInput(res.devResetToken);
      }
    } catch (err: any) {
      setError(err?.message || 'Request failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearFeedback();
    if (password.length < 12) {
      setError('New password must be at least 12 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await dashboardService.resetPasswordWithToken(resetTokenInput.trim(), password);
      if (window.location.search.includes('resetToken')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
      setPassword('');
      setConfirmPassword('');
      setNotice(res.message);
      setMode('login');
    } catch (err: any) {
      setError(err?.message || 'Password reset failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const strength = getPasswordStrength(password);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-950 p-4 sm:p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className={`w-full ${mode === 'register' ? 'max-w-lg' : 'max-w-md'} rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 sm:p-8 shadow-xl`}
      >
        <div className="text-center mb-6">
          <img src={appIconSrc} alt="TrueSpend Logo" className="mx-auto h-14 w-14 mb-3" />
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            {mode === 'login' && 'Welcome back to TrueSpend'}
            {mode === 'register' && 'Create your private workspace'}
            {mode === 'verify' && 'Verify your email'}
            {mode === 'forgot' && 'Reset your password'}
            {mode === 'reset' && 'Choose a new password'}
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {mode === 'login' && 'Sign in to your encrypted, single-owner financial ledger.'}
            {mode === 'register' &&
              'Every account has its own private workspace. Basic and Advanced modes are both 100% free.'}
            {mode === 'verify' &&
              'Confirm your email address before accessing financial tools.'}
            {mode === 'forgot' &&
              "We'll send a one-time reset link if your email is registered."}
            {mode === 'reset' && 'Update your passphrase and sign out any old devices.'}
          </p>
        </div>

        {(mode === 'login' || mode === 'register') && (
          <div className="grid grid-cols-2 rounded-xl bg-gray-100 dark:bg-gray-800 p-1 mb-5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => switchMode('login')}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                mode === 'login'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => switchMode('register')}
              className={`py-2 rounded-lg transition-colors cursor-pointer ${
                mode === 'register'
                  ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-xs'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              Create Account (Free)
            </button>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-rose-200 dark:border-rose-800/70 bg-rose-50 dark:bg-rose-950/40 p-3 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {notice && (
          <div className="mb-4 rounded-xl border border-emerald-200 dark:border-emerald-800/70 bg-emerald-50 dark:bg-emerald-950/40 p-3 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{notice}</span>
          </div>
        )}

        {mode === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email or Username
              </label>
              <div className="relative">
                <Mail className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="you@example.com or username"
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => switchMode('forgot')}
                  className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="h-4 w-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your passphrase"
                  className="w-full pl-9 pr-10 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  aria-label="Toggle password visibility"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        )}

        {mode === 'register' && (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Nadia B."
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Username (optional)
                </label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="e.g. nadiab"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                required
              />
            </div>

            {/* Experience Tier Selection — Both Free */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Choose Your Experience Mode
                </label>
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Both Free · Switch Anytime
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setExperienceTier('basic')}
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    experienceTier === 'basic'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                      <Layers className="h-3.5 w-3.5 text-indigo-600" />
                      Basic
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      Free
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                    Clean accounts, budgets, bills, goals, and everyday tracking.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setExperienceTier('advanced')}
                  className={`rounded-xl border p-3 text-left transition-colors cursor-pointer ${
                    experienceTier === 'advanced'
                      ? 'border-indigo-600 bg-indigo-50/70 dark:bg-indigo-950/40 dark:border-indigo-500'
                      : 'border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800/60'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-white">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                      Advanced
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300">
                      Free
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-600 dark:text-gray-400">
                    Forecasts, investments, CSV statements, rules, and audit tools.
                  </p>
                </button>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Passphrase (12+ chars)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 12 characters"
                    className="w-full pr-9 pl-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                  Confirm Passphrase
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat passphrase"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  required
                />
              </div>
            </div>

            {password.length > 0 && (
              <div className="space-y-1">
                <div className="grid grid-cols-4 gap-1 h-1.5">
                  {[1, 2, 3, 4].map((step) => (
                    <div
                      key={step}
                      className={`rounded-full transition-colors ${
                        strength.score >= step ? strength.color : 'bg-gray-200 dark:bg-gray-800'
                      }`}
                    />
                  ))}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">{strength.label}</p>
              </div>
            )}

            {/* Optional Invitation Code */}
            <div>
              {!showInviteField ? (
                <button
                  type="button"
                  onClick={() => setShowInviteField(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 hover:text-indigo-600 cursor-pointer"
                >
                  <Ticket className="h-3.5 w-3.5" />
                  Have an optional invitation code?
                </button>
              ) : (
                <div className="space-y-1">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => {
                        setInviteCode(e.target.value);
                        setInviteStatus({});
                      }}
                      onBlur={() => validateInvite(inviteCode)}
                      placeholder="Optional invitation code"
                      className="flex-1 px-3 py-1.5 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-xs text-gray-900 dark:text-white"
                    />
                    <button
                      type="button"
                      onClick={() => validateInvite(inviteCode)}
                      className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                    >
                      Check
                    </button>
                  </div>
                  {inviteStatus.checked && (
                    <p
                      className={`text-[11px] ${
                        inviteStatus.valid
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {inviteStatus.message}
                    </p>
                  )}
                </div>
              )}
            </div>

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Creating account...' : 'Create Private Account'}
            </Button>
          </form>
        )}

        {mode === 'verify' && (
          <div className="space-y-4">
            <div className="rounded-xl border border-indigo-200/70 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-indigo-950/30 p-3.5 text-xs text-gray-700 dark:text-gray-300 space-y-1">
              <div className="flex items-center gap-2 font-semibold text-indigo-700 dark:text-indigo-300">
                <ShieldCheck className="h-4 w-4" />
                <span>Check your inbox{pendingVerifyEmail ? `: ${pendingVerifyEmail}` : ''}</span>
              </div>
              <p>
                Open the verification link sent to your email or paste the verification code below to
                activate your account.
              </p>
              {deliveryWarning && (
                <div className="mt-2 rounded border border-indigo-200 dark:border-indigo-800/80 bg-white/80 dark:bg-gray-900/70 px-2.5 py-2 text-[11px] text-gray-700 dark:text-gray-300 leading-relaxed">
                  {deliveryWarning}
                </div>
              )}
              {devPreviewToken && (
                <div className="mt-2 rounded bg-white dark:bg-gray-900 border border-emerald-300 dark:border-emerald-800 px-2.5 py-1.5 font-mono text-[11px] break-all text-emerald-800 dark:text-emerald-300">
                  Instant verification code (pre-filled): <strong>{devPreviewToken}</strong>
                </div>
              )}
              {emailPreviewUrl && (
                <div className="mt-1.5">
                  <a
                    href={emailPreviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Open Webmail Email Preview ↗
                  </a>
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Verification Code
              </label>
              <input
                type="text"
                value={verifyTokenInput}
                onChange={(e) => setVerifyTokenInput(e.target.value)}
                placeholder="Paste verification code"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
              />
            </div>

            <Button
              type="button"
              onClick={() => handleVerifyToken()}
              disabled={isSubmitting}
              size="lg"
              className="w-full"
            >
              {isSubmitting ? 'Verifying...' : 'Verify & Open Workspace'}
            </Button>

            <div className="flex items-center justify-between pt-2 text-xs">
              <button
                type="button"
                onClick={handleResendVerification}
                disabled={isSubmitting}
                className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Resend verification link
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </div>
          </div>
        )}

        {mode === 'forgot' && (
          <form onSubmit={handleForgotSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Registered Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                required
              />
            </div>

            {deliveryWarning && (
              <div className="rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 p-3 text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                {deliveryWarning}
              </div>
            )}

            {devPreviewToken && (
              <div className="rounded-lg border border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30 p-3 text-xs space-y-2">
                <div className="font-mono break-all text-emerald-900 dark:text-emerald-200">
                  Instant reset token (pre-filled): <strong>{devPreviewToken}</strong>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setMode('reset')}
                    className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline cursor-pointer"
                  >
                    Continue to Set New Password →
                  </button>
                  {emailPreviewUrl && (
                    <a
                      href={emailPreviewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-emerald-700 dark:text-emerald-300 font-medium hover:underline"
                    >
                      Open Webmail Preview ↗
                    </a>
                  )}
                </div>
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Sending...' : 'Send Reset Instructions'}
            </Button>

            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => switchMode('reset')}
                className="text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Have a reset code already?
              </button>
              <button
                type="button"
                onClick={() => switchMode('login')}
                className="inline-flex items-center gap-1 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
              </button>
            </div>
          </form>
        )}

        {mode === 'reset' && (
          <form onSubmit={handleResetSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Reset Token
              </label>
              <input
                type="text"
                value={resetTokenInput}
                onChange={(e) => setResetTokenInput(e.target.value)}
                placeholder="Paste reset code from email"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm font-mono text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                New Passphrase (12+ chars)
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 12 characters"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                Confirm New Passphrase
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new passphrase"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-sm text-gray-900 dark:text-white"
                required
              />
            </div>

            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Updating...' : 'Reset Password'}
            </Button>

            <button
              type="button"
              onClick={() => switchMode('login')}
              className="w-full inline-flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 dark:border-gray-800 flex items-center justify-center gap-4 text-[11px] text-gray-500 dark:text-gray-400">
          <button
            type="button"
            onClick={() => {
              setLegalTab('privacy');
              setLegalOpen(true);
            }}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
          >
            Privacy Policy
          </button>
          <span>·</span>
          <button
            type="button"
            onClick={() => {
              setLegalTab('terms');
              setLegalOpen(true);
            }}
            className="hover:text-indigo-600 dark:hover:text-indigo-400 hover:underline cursor-pointer"
          >
            Terms of Service
          </button>
        </div>
      </motion.div>

      <LegalModal
        isOpen={legalOpen}
        initialTab={legalTab}
        onClose={() => setLegalOpen(false)}
      />
    </div>
  );
};
