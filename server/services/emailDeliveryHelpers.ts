export interface SmtpConfig {
  url?: string;
  host?: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  providerLabel: string;
}

export type EmailTransportChannel = 'resend' | 'smtp';

export type EmailDeliveryFailureReason =
  | 'RESEND_DOMAIN_NOT_VERIFIED'
  | 'NO_EMAIL_PROVIDER'
  | 'PROVIDER_ERROR';

export const DEFAULT_RESEND_FROM = 'TrueSpend Security <onboarding@resend.dev>';

function cleanEnvString(value?: string): string {
  return String(value || '')
    .trim()
    .replace(/^["']|["']$/g, '');
}

export type ActiveEmailSenderMode =
  | 'gmail_app_password'
  | 'smtp'
  | 'resend_verified_domain'
  | 'resend_sandbox'
  | 'none';

const FREE_WEBMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  'yahoo.com',
  'ymail.com',
  'icloud.com',
  'me.com',
  'mac.com',
  'zoho.com',
  'zohomail.com',
  'proton.me',
  'protonmail.com',
]);

function extractEmailDomain(address: string): string {
  const angleMatch = address.match(/<([^>]+)>/);
  const emailOnly = (angleMatch ? angleMatch[1] : address).trim().toLowerCase();
  const atIdx = emailOnly.lastIndexOf('@');
  return atIdx >= 0 ? emailOnly.slice(atIdx + 1).trim() : '';
}

function isFreeWebmailAddress(address: string): boolean {
  const domain = extractEmailDomain(address);
  return Boolean(domain && FREE_WEBMAIL_DOMAINS.has(domain));
}

function inferFreeSmtpProviderFromEmail(email: string): {
  host: string;
  port: number;
  secure: boolean;
} | null {
  const domain = (email.split('@')[1] || '').trim().toLowerCase();
  if (!domain) return null;
  if (domain === 'gmail.com' || domain === 'googlemail.com') {
    return { host: 'smtp.gmail.com', port: 465, secure: true };
  }
  if (
    domain === 'outlook.com' ||
    domain === 'hotmail.com' ||
    domain === 'live.com' ||
    domain === 'msn.com'
  ) {
    return { host: 'smtp-mail.outlook.com', port: 587, secure: false };
  }
  if (domain === 'yahoo.com' || domain === 'ymail.com') {
    return { host: 'smtp.mail.yahoo.com', port: 465, secure: true };
  }
  if (domain === 'icloud.com' || domain === 'me.com' || domain === 'mac.com') {
    return { host: 'smtp.mail.me.com', port: 587, secure: false };
  }
  if (domain === 'zoho.com' || domain === 'zohomail.com') {
    return { host: 'smtp.zoho.com', port: 465, secure: true };
  }
  return null;
}

/**
 * Resolves explicit SMTP or Gmail App-Password configuration from environment variables.
 * Never fabricates credentials or falls back to a hardcoded developer email.
 */
export function parseSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const smtpUrl = cleanEnvString(env.SMTP_URL);
  const smtpUser = cleanEnvString(
    env.SMTP_USER || env.EMAIL_USER || env.MAIL_USER || env.GOOGLE_USER
  );
  const smtpPass = cleanEnvString(
    env.SMTP_PASS ||
      env.SMTP_PASSWORD ||
      env.EMAIL_PASS ||
      env.EMAIL_PASSWORD ||
      env.EMAIL_APP_PASSWORD ||
      env.MAIL_PASS ||
      env.MAIL_PASSWORD ||
      env.GOOGLE_APP_PASSWORD
  );
  const smtpHost = cleanEnvString(env.SMTP_HOST || env.EMAIL_HOST || env.MAIL_HOST);

  const gmailUser = cleanEnvString(env.GMAIL_USER || env.GOOGLE_USER);
  const gmailPass = cleanEnvString(
    env.GMAIL_APP_PASSWORD ||
      env.GMAIL_APP_PASS ||
      env.GMAIL_PASS ||
      env.GMAIL_PASSWORD ||
      env.GOOGLE_APP_PASSWORD
  );

  // Explicit Gmail App Password configuration takes direct precedence when Gmail credentials are provided
  if (gmailUser && (gmailPass || smtpPass)) {
    const chosenPass = gmailPass || smtpPass;
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: gmailUser,
      pass: chosenPass.replace(/\s+/g, ''),
      providerLabel: 'smtp.gmail.com',
    };
  }

  // Fallback: GMAIL_APP_PASSWORD paired with SMTP_USER / EMAIL_USER (when Gmail address is in SMTP_USER)
  if (smtpUser && gmailPass) {
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: smtpUser,
      pass: gmailPass.replace(/\s+/g, ''),
      providerLabel: 'smtp.gmail.com',
    };
  }

  if (smtpUrl) {
    return {
      url: smtpUrl,
      port: Number(cleanEnvString(env.SMTP_PORT) || 587) || 587,
      secure: cleanEnvString(env.SMTP_SECURE).toLowerCase() === 'true',
      user: smtpUser,
      pass: smtpPass,
      providerLabel: 'smtp-url',
    };
  }

  if (smtpHost && smtpUser && smtpPass) {
    const port = Number(cleanEnvString(env.SMTP_PORT) || 587) || 587;
    const explicitSecure = cleanEnvString(env.SMTP_SECURE).toLowerCase();
    const secure = explicitSecure ? explicitSecure === 'true' : port === 465;
    const normalizedPass = smtpHost.toLowerCase().includes('gmail')
      ? smtpPass.replace(/\s+/g, '')
      : smtpPass;
    return {
      host: smtpHost,
      port,
      secure,
      user: smtpUser,
      pass: normalizedPass,
      providerLabel: smtpHost,
    };
  }

  if (smtpUser && smtpPass) {
    const inferred = inferFreeSmtpProviderFromEmail(smtpUser);
    if (inferred) {
      const normalizedPass = inferred.host.includes('gmail')
        ? smtpPass.replace(/\s+/g, '')
        : smtpPass;
      return {
        host: inferred.host,
        port: inferred.port,
        secure: inferred.secure,
        user: smtpUser,
        pass: normalizedPass,
        providerLabel: inferred.host,
      };
    }
  }

  return null;
}

/**
 * Resolves the sender "From" header strictly from explicit configuration or SMTP user,
 * preferring the authenticated Gmail/SMTP user whenever EMAIL_FROM is unset,
 * onboarding@resend.dev, or a mismatched sender when using Gmail SMTP.
 */
export function resolveEmailFromAddress(
  env: NodeJS.ProcessEnv = process.env,
  smtpConfig: SmtpConfig | null = null,
): string {
  const configured = cleanEnvString(env.EMAIL_FROM || env.SMTP_FROM);
  if (smtpConfig?.user && smtpConfig.user.includes('@')) {
    if (!configured || isOnboardingResendAddress(configured)) {
      return `TrueSpend Security <${smtpConfig.user}>`;
    }
    if (
      smtpConfig.host?.toLowerCase().includes('gmail') &&
      !configured.toLowerCase().includes(smtpConfig.user.toLowerCase())
    ) {
      return `TrueSpend Security <${smtpConfig.user}>`;
    }
  }
  if (configured) {
    return configured;
  }
  if (smtpConfig?.user && smtpConfig.user.includes('@')) {
    return `TrueSpend Security <${smtpConfig.user}>`;
  }
  return DEFAULT_RESEND_FROM;
}

export function isOnboardingResendAddress(fromAddress: string): boolean {
  return fromAddress.toLowerCase().includes('onboarding@resend.dev');
}

export function hasVerifiedCustomResendFrom(env: NodeJS.ProcessEnv = process.env): boolean {
  const configured = cleanEnvString(env.EMAIL_FROM);
  if (!configured) return false;
  if (isOnboardingResendAddress(configured)) return false;
  // Resend never allows verifying free public webmail domains (e.g. @gmail.com, @outlook.com)
  if (isFreeWebmailAddress(configured)) return false;
  return configured.includes('@');
}

export function resolveActiveEmailSenderMode(
  env: NodeJS.ProcessEnv,
  smtpConfig: SmtpConfig | null,
  hasResendKey: boolean
): ActiveEmailSenderMode {
  const order = selectEmailTransportOrder(env, smtpConfig, hasResendKey);
  const primary = order[0];
  if (primary === 'smtp' && smtpConfig) {
    return smtpConfig.host?.toLowerCase().includes('gmail') ? 'gmail_app_password' : 'smtp';
  }
  if (primary === 'resend' && hasResendKey) {
    return hasVerifiedCustomResendFrom(env) ? 'resend_verified_domain' : 'resend_sandbox';
  }
  return 'none';
}

/**
 * Chooses transport order cleanly:
 * - Explicit `EMAIL_PROVIDER=smtp` or `EMAIL_PROVIDER=gmail` tries SMTP / Gmail App Password first.
 * - If custom verified domain `EMAIL_FROM` (non-free-webmail, non-onboarding) + Resend key exist, tries Resend first, then SMTP backup.
 * - Whenever Gmail App Password / SMTP is configured and no verified custom Resend domain exists,
 *   tries Gmail/SMTP FIRST so every signup recipient receives real inbox emails!
 */
export function selectEmailTransportOrder(
  env: NodeJS.ProcessEnv,
  smtpConfig: SmtpConfig | null,
  hasResendKey: boolean,
): EmailTransportChannel[] {
  const hasSmtp = Boolean(smtpConfig);
  const preferred = cleanEnvString(env.EMAIL_PROVIDER).toLowerCase();
  const hasCustomResend = hasVerifiedCustomResendFrom(env);

  if (preferred === 'smtp' || preferred === 'gmail') {
    return [
      ...(hasSmtp ? (['smtp'] as const) : []),
      ...(hasResendKey ? (['resend'] as const) : []),
    ];
  }

  if (preferred === 'resend') {
    return [
      ...(hasResendKey ? (['resend'] as const) : []),
      ...(hasSmtp ? (['smtp'] as const) : []),
    ];
  }

  if (hasResendKey && hasCustomResend) {
    return hasSmtp ? ['resend', 'smtp'] : ['resend'];
  }

  if (hasSmtp) {
    return hasResendKey ? ['smtp', 'resend'] : ['smtp'];
  }

  return hasResendKey ? ['resend'] : [];
}

/**
 * Detects Resend's unverified-domain sandbox error so we never leak/redirect external
 * user verification emails to the Resend account owner.
 */
export function isResendSandboxRecipientRestriction(status: number, responseBody: string): boolean {
  if (status !== 403) return false;
  return /only send testing emails to your own email address|verify a domain at resend\.com/i.test(
    responseBody || '',
  );
}

export function formatEmailDeliveryWarning(
  reason: EmailDeliveryFailureReason,
  recipientEmail: string,
): string {
  switch (reason) {
    case 'RESEND_DOMAIN_NOT_VERIFIED':
      return `Free Sandbox Mode active for ${recipientEmail}: Resend's default onboarding@resend.dev sender only delivers to the Resend account owner unless a custom domain is verified — so your verification code is pre-filled below for instant 1-click activation! (To send real inbox emails to any address for 100% free without a domain, set GMAIL_USER + GMAIL_APP_PASSWORD.)`;
    case 'NO_EMAIL_PROVIDER':
      return `Free Sandbox Mode active for ${recipientEmail}: No custom domain or SMTP provider is configured yet, so your verification code is pre-filled below for instant 1-click activation! (To send real inbox emails for free without a domain, set GMAIL_USER + GMAIL_APP_PASSWORD.)`;
    case 'PROVIDER_ERROR':
    default:
      return `Email delivery to ${recipientEmail} encountered a provider restriction, so your verification code is pre-filled below for instant activation.`;
  }
}
