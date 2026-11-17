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

/**
 * Resolves explicit SMTP or Gmail App-Password configuration from environment variables.
 * Never fabricates credentials or falls back to a hardcoded developer email.
 */
export function parseSmtpConfig(env: NodeJS.ProcessEnv = process.env): SmtpConfig | null {
  const smtpUrl = cleanEnvString(env.SMTP_URL);
  const smtpUser = cleanEnvString(env.SMTP_USER);
  const smtpPass = cleanEnvString(env.SMTP_PASS);
  const smtpHost = cleanEnvString(env.SMTP_HOST);

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
    return {
      host: smtpHost,
      port,
      secure,
      user: smtpUser,
      pass: smtpPass,
      providerLabel: smtpHost,
    };
  }

  const gmailUser = cleanEnvString(env.GMAIL_USER);
  const gmailPass = cleanEnvString(env.GMAIL_APP_PASSWORD);
  if (gmailUser && gmailPass) {
    return {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      user: gmailUser,
      pass: gmailPass,
      providerLabel: 'smtp.gmail.com',
    };
  }

  return null;
}

/**
 * Resolves the sender "From" header strictly from explicit configuration or SMTP user,
 * only using Resend's default onboarding sender when no custom sender or SMTP user exists.
 */
export function resolveEmailFromAddress(
  env: NodeJS.ProcessEnv = process.env,
  smtpConfig: SmtpConfig | null = null,
): string {
  const configured = cleanEnvString(env.EMAIL_FROM || env.SMTP_FROM);
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

/**
 * Chooses transport order cleanly:
 * - Explicit `EMAIL_PROVIDER=smtp` tries SMTP first.
 * - If custom `EMAIL_FROM` (verified domain) + Resend key exist, tries Resend first, then SMTP backup.
 * - If only Resend sandbox (`onboarding@resend.dev`) is available and SMTP is configured,
 *   tries SMTP first so external signup recipients actually receive their own emails.
 */
export function selectEmailTransportOrder(
  env: NodeJS.ProcessEnv,
  smtpConfig: SmtpConfig | null,
  hasResendKey: boolean,
): EmailTransportChannel[] {
  const hasSmtp = Boolean(smtpConfig);
  const preferred = cleanEnvString(env.EMAIL_PROVIDER).toLowerCase();
  const fromAddress = resolveEmailFromAddress(env, smtpConfig);
  const hasCustomResendFrom = Boolean(cleanEnvString(env.EMAIL_FROM)) && !isOnboardingResendAddress(fromAddress);

  if (preferred === 'smtp') {
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

  if (hasResendKey && hasCustomResendFrom) {
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
      return `Unable to deliver email to ${recipientEmail}: Resend is still in unverified testing mode (onboarding@resend.dev only allows sending to the Resend owner address). Verify a sending domain in Resend + set EMAIL_FROM, or configure SMTP credentials (SMTP_HOST/SMTP_USER/SMTP_PASS or GMAIL_USER/GMAIL_APP_PASSWORD).`;
    case 'NO_EMAIL_PROVIDER':
      return `Unable to deliver email to ${recipientEmail}: no production email transport is configured. Configure SMTP credentials or a verified Resend domain (RESEND_API_KEY + EMAIL_FROM).`;
    case 'PROVIDER_ERROR':
    default:
      return `Email delivery to ${recipientEmail} could not be completed by the mail provider. Please verify your mail provider settings and try again.`;
  }
}
