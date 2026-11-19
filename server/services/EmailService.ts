import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '../../src/db/index.js';
import { emailOutbox } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  ActiveEmailSenderMode,
  DEFAULT_RESEND_FROM,
  EmailDeliveryFailureReason,
  EmailTransportChannel,
  SmtpConfig,
  formatEmailDeliveryWarning,
  isResendSandboxRecipientRestriction,
  parseSmtpConfig,
  resolveActiveEmailSenderMode,
  resolveEmailFromAddress,
  selectEmailTransportOrder,
} from './emailDeliveryHelpers.js';

export type EmailTemplateName =
  | 'email_verification'
  | 'password_reset'
  | 'password_changed'
  | 'email_change_verification'
  | 'email_change_notice'
  | 'new_signin_alert'
  | 'account_deleted';

export interface EnqueueEmailParams {
  userId?: string | null;
  recipientEmail: string;
  templateName: EmailTemplateName;
  subject: string;
  payload: Record<string, any>;
  skipOutboxDb?: boolean;
}

export interface EmailTemplateViewModel {
  subject: string;
  badgeLabel: string;
  displayName: string;
  heading: string;
  bodyHtml: string;
  actionUrl?: string;
  actionLabel?: string;
  token?: string;
  expiryNotice: string;
  textFallback: string;
}

export interface EmailDeliveryResult {
  outboxId: string;
  status: string;
  transportUsed?: EmailTransportChannel;
  errorCode?: EmailDeliveryFailureReason;
  warning?: string;
  providerStatus?: number;
  providerResponse?: string;
  fromUsed?: string;
  previewUrl?: string;
}

const DEFAULT_GITHUB_SPEX_AVATAR_URL =
  'https://raw.githubusercontent.com/San-AMRANI/TrueSpend-ggl/main/public/spex-avatar.jpg';
const DEFAULT_GITHUB_APP_ICON_URL =
  'https://raw.githubusercontent.com/San-AMRANI/TrueSpend-ggl/main/public/app-icon.png';

export interface EmailThemePalette {
  id: string;
  mode: 'light' | 'dark';
  canvas: string;
  surface: string;
  surfaceMuted: string;
  border: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  secondaryAccent: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
  fontBody: string;
  fontDisplay: string;
  fontMono: string;
}

const EMAIL_THEME_PALETTES: Record<string, EmailThemePalette> = {
  light: {
    id: 'light',
    mode: 'light',
    canvas: '#f8fafc',
    surface: '#ffffff',
    surfaceMuted: '#f1f5f9',
    border: '#e2e8f0',
    text: '#0f172a',
    textMuted: '#475569',
    textSubtle: '#64748b',
    accent: '#4f46e5',
    secondaryAccent: '#0d9488',
    badgeBg: '#eef2ff',
    badgeBorder: '#c7d2fe',
    badgeText: '#4338ca',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    fontDisplay: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    fontMono: "'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
  },
  dark: {
    id: 'dark',
    mode: 'dark',
    canvas: '#090d16',
    surface: '#111827',
    surfaceMuted: '#1a2234',
    border: '#1f2937',
    text: '#f8fafc',
    textMuted: '#cbd5e1',
    textSubtle: '#94a3b8',
    accent: '#6366f1',
    secondaryAccent: '#2dd4bf',
    badgeBg: '#1e1b4b',
    badgeBorder: '#3730a3',
    badgeText: '#a5b4fc',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    fontDisplay: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif",
    fontMono: "'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace",
  },
  vintage: {
    id: 'vintage',
    mode: 'light',
    canvas: '#f3ebd9',
    surface: '#fbf7ee',
    surfaceMuted: '#eadec6',
    border: '#d5c5a7',
    text: '#24190d',
    textMuted: '#59462d',
    textSubtle: '#725d40',
    accent: '#9a4422',
    secondaryAccent: '#2f684a',
    badgeBg: '#f6e8dc',
    badgeBorder: '#deb08d',
    badgeText: '#833518',
    fontBody: "Lora,Georgia,Cambria,'Times New Roman',serif",
    fontDisplay: "Fraunces,Georgia,serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  espresso: {
    id: 'espresso',
    mode: 'light',
    canvas: '#f4f0ea',
    surface: '#fcfaf7',
    surfaceMuted: '#ebe4da',
    border: '#ded4c6',
    text: '#1f1914',
    textMuted: '#605243',
    textSubtle: '#7d6d5b',
    accent: '#875937',
    secondaryAccent: '#3d6352',
    badgeBg: '#f5eee7',
    badgeBorder: '#d5b99f',
    badgeText: '#6e4629',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontDisplay: "Fraunces,Georgia,serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  'sahara-dune': {
    id: 'sahara-dune',
    mode: 'light',
    canvas: '#faf4eb',
    surface: '#fffdf9',
    surfaceMuted: '#f2e7d7',
    border: '#e6d7c3',
    text: '#261c14',
    textMuted: '#695440',
    textSubtle: '#876f57',
    accent: '#c85a2b',
    secondaryAccent: '#2a6349',
    badgeBg: '#fdf2eb',
    badgeBorder: '#f4c3a7',
    badgeText: '#ab461e',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontDisplay: "Fraunces,Georgia,serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  'kyoto-zen': {
    id: 'kyoto-zen',
    mode: 'light',
    canvas: '#f5f7f2',
    surface: '#fcfffa',
    surfaceMuted: '#e9eee4',
    border: '#d2ded0',
    text: '#192019',
    textMuted: '#4e5d4d',
    textSubtle: '#677865',
    accent: '#2d6a4f',
    secondaryAccent: '#b47834',
    badgeBg: '#eef7f2',
    badgeBorder: '#b2dbc6',
    badgeText: '#22563f',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif",
    fontDisplay: "Lora,Georgia,serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  'rose-atelier': {
    id: 'rose-atelier',
    mode: 'light',
    canvas: '#faf5f2',
    surface: '#fffcfb',
    surfaceMuted: '#f4eae5',
    border: '#ebd8d0',
    text: '#281a17',
    textMuted: '#745850',
    textSubtle: '#93736a',
    accent: '#b35d6b',
    secondaryAccent: '#4a6b5d',
    badgeBg: '#fdf2f4',
    badgeBorder: '#f7ced7',
    badgeText: '#9b4b58',
    fontBody: "Lora,Georgia,serif",
    fontDisplay: "Fraunces,Georgia,serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  'emerald-night': {
    id: 'emerald-night',
    mode: 'dark',
    canvas: '#050e0b',
    surface: '#0b1b16',
    surfaceMuted: '#132a22',
    border: '#1b3b30',
    text: '#ecfdf5',
    textMuted: '#a7f3d0',
    textSubtle: '#6ee7b7',
    accent: '#10b981',
    secondaryAccent: '#d4af37',
    badgeBg: '#064e3b',
    badgeBorder: '#047857',
    badgeText: '#6ee7b7',
    fontBody: "Outfit,'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif",
    fontDisplay: "Fraunces,Outfit,sans-serif",
    fontMono: "'JetBrains Mono','SFMono-Regular',Consolas,monospace",
  },
  terminal: {
    id: 'terminal',
    mode: 'dark',
    canvas: '#08090b',
    surface: '#111215',
    surfaceMuted: '#1f2023',
    border: '#2f2e2b',
    text: '#f7f5f0',
    textMuted: '#d2cbbd',
    textSubtle: '#857e71',
    accent: '#f59e0b',
    secondaryAccent: '#fbbf24',
    badgeBg: '#451a03',
    badgeBorder: '#92400e',
    badgeText: '#fcd34d',
    fontBody: "'IBM Plex Mono','JetBrains Mono',monospace",
    fontDisplay: "'IBM Plex Mono','JetBrains Mono',monospace",
    fontMono: "'IBM Plex Mono','JetBrains Mono',monospace",
  },
  'tokyo-night': {
    id: 'tokyo-night',
    mode: 'dark',
    canvas: '#0a0d17',
    surface: '#111624',
    surfaceMuted: '#182032',
    border: '#1e293b',
    text: '#f1f5f9',
    textMuted: '#cbd5e1',
    textSubtle: '#94a3b8',
    accent: '#06b6d4',
    secondaryAccent: '#d946ef',
    badgeBg: '#083344',
    badgeBorder: '#155e75',
    badgeText: '#67e8f9',
    fontBody: "Outfit,-apple-system,BlinkMacSystemFont,sans-serif",
    fontDisplay: "Outfit,sans-serif",
    fontMono: "'JetBrains Mono','SFMono-Regular',Consolas,monospace",
  },
  'wall-street': {
    id: 'wall-street',
    mode: 'dark',
    canvas: '#070d17',
    surface: '#0e1929',
    surfaceMuted: '#14243b',
    border: '#1d3553',
    text: '#f0f6fc',
    textMuted: '#c9dbed',
    textSubtle: '#93b5d9',
    accent: '#3b82f6',
    secondaryAccent: '#f59e0b',
    badgeBg: '#172554',
    badgeBorder: '#1e40af',
    badgeText: '#93c5fd',
    fontBody: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif",
    fontDisplay: "'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,sans-serif",
    fontMono: "'IBM Plex Mono','SFMono-Regular',Consolas,monospace",
  },
  'deep-abyss': {
    id: 'deep-abyss',
    mode: 'dark',
    canvas: '#030b0f',
    surface: '#06151c',
    surfaceMuted: '#0a212a',
    border: '#0f3440',
    text: '#ecfeff',
    textMuted: '#a5f3fc',
    textSubtle: '#67e8f9',
    accent: '#14b8a6',
    secondaryAccent: '#38bdf8',
    badgeBg: '#042f2e',
    badgeBorder: '#115e59',
    badgeText: '#5eead4',
    fontBody: "Outfit,'JetBrains Mono',sans-serif",
    fontDisplay: "Outfit,sans-serif",
    fontMono: "'JetBrains Mono','SFMono-Regular',Consolas,monospace",
  },
};

export function resolveEmailThemePalette(themeId?: string | null): EmailThemePalette {
  const key = String(themeId || '').trim().toLowerCase();
  return EMAIL_THEME_PALETTES[key] || EMAIL_THEME_PALETTES.light;
}

function escapeHtml(raw: string): string {
  return String(raw || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class EmailService {
  private getAppBaseUrl(): string {
    return (
      process.env.APP_URL ||
      process.env.FRONTEND_URL ||
      'https://true-spend-ggl.vercel.app'
    ).replace(/\/$/, '');
  }

  private resolveFromAddress(smtpConfig: SmtpConfig | null = parseSmtpConfig()): string {
    return resolveEmailFromAddress(process.env, smtpConfig);
  }

  private buildTemplateModel(
    templateName: EmailTemplateName,
    subject: string,
    payload: Record<string, any>
  ): EmailTemplateViewModel {
    const baseUrl = this.getAppBaseUrl();
    const safeName = escapeHtml(String(payload.displayName || 'there'));
    const rawToken = payload.token ? String(payload.token).trim() : '';
    const safeToken = rawToken ? escapeHtml(rawToken) : undefined;

    switch (templateName) {
      case 'email_verification': {
        const link = `${baseUrl}/?verifyToken=${encodeURIComponent(rawToken)}`;
        return {
          subject,
          badgeLabel: 'Email Verification',
          displayName: safeName,
          heading: `Welcome to TrueSpend, ${safeName}`,
          bodyHtml:
            'Confirm your email address to activate your private financial workspace and synchronize your multi-currency ledger.',
          actionUrl: link,
          actionLabel: 'Verify Email Address',
          token: safeToken,
          expiryNotice:
            'This verification link and code expire in 24 hours. If you did not create a TrueSpend account, you can safely ignore this email.',
          textFallback: `Welcome to TrueSpend, ${safeName}!\n\nVerify your email address: ${link}\nVerification code: ${rawToken}\n\nThis link expires in 24 hours.`,
        };
      }
      case 'email_change_verification': {
        const link = `${baseUrl}/?verifyToken=${encodeURIComponent(rawToken)}`;
        return {
          subject,
          badgeLabel: 'Email Update Confirmation',
          displayName: safeName,
          heading: 'Confirm your new TrueSpend email',
          bodyHtml:
            'Confirm this email change to complete updating your account email address. Your previous email remains active until confirmed.',
          actionUrl: link,
          actionLabel: 'Confirm New Email',
          token: safeToken,
          expiryNotice:
            'This confirmation link and code expire in 24 hours. If you did not request this change, please review your account security immediately.',
          textFallback: `Hi ${safeName},\n\nConfirm your new TrueSpend email: ${link}\nVerification code: ${rawToken}`,
        };
      }
      case 'email_change_notice': {
        const pendingEmail = escapeHtml(String(payload.pendingEmail || 'a new address'));
        return {
          subject,
          badgeLabel: 'Security Alert',
          displayName: safeName,
          heading: 'Email change requested on your account',
          bodyHtml: `A request was made to change your TrueSpend account email to <strong style="color:#0f172a;">${pendingEmail}</strong>.`,
          actionUrl: baseUrl,
          actionLabel: 'Review Account Security',
          expiryNotice:
            'If this was not you, change your password immediately and revoke active sessions in Settings → Security.',
          textFallback: `Hi ${safeName}, a request was made to change your TrueSpend account email to ${pendingEmail}. If this wasn't you, secure your account immediately at ${baseUrl}.`,
        };
      }
      case 'password_reset': {
        const link = `${baseUrl}/?resetToken=${encodeURIComponent(rawToken)}`;
        return {
          subject,
          badgeLabel: 'Password Recovery',
          displayName: safeName,
          heading: 'Reset your TrueSpend password',
          bodyHtml:
            'We received a request to reset the password for your TrueSpend account. Use the secure button or one-time recovery code below to choose a new password.',
          actionUrl: link,
          actionLabel: 'Choose a New Password',
          token: safeToken,
          expiryNotice:
            'This recovery link and code expire in 30 minutes and can only be used once. If you did not request a password reset, you can safely ignore this message.',
          textFallback: `Hi ${safeName},\n\nReset your TrueSpend password: ${link}\nRecovery code: ${rawToken}\n\nThis link expires in 30 minutes.`,
        };
      }
      case 'password_changed': {
        return {
          subject,
          badgeLabel: 'Security Confirmation',
          displayName: safeName,
          heading: 'Your TrueSpend password was updated',
          bodyHtml:
            'Your TrueSpend account password was recently changed and all other active sessions have been signed out automatically.',
          actionUrl: baseUrl,
          actionLabel: 'Open TrueSpend',
          expiryNotice:
            'If you did not make this change, use Forgot Password immediately to recover your account.',
          textFallback: `Hi ${safeName}, your TrueSpend password was recently updated and other active sessions were signed out.`,
        };
      }
      case 'new_signin_alert': {
        const deviceLabel = escapeHtml(String(payload.deviceLabel || 'a new device'));
        return {
          subject,
          badgeLabel: 'Sign-In Alert',
          displayName: safeName,
          heading: 'New sign-in to your TrueSpend account',
          bodyHtml: `We noticed a new sign-in to your TrueSpend workspace from <strong style="color:#0f172a;">${deviceLabel}</strong>.`,
          actionUrl: baseUrl,
          actionLabel: 'Review Active Sessions',
          expiryNotice:
            'You can inspect or revoke active sessions at any time in Settings → Security.',
          textFallback: `Hi ${safeName}, we noticed a sign-in from ${deviceLabel}. You can review or revoke active sessions in Settings → Security at ${baseUrl}.`,
        };
      }
      case 'account_deleted': {
        return {
          subject,
          badgeLabel: 'Account Closed',
          displayName: safeName,
          heading: 'Your TrueSpend account has been removed',
          bodyHtml:
            'Your TrueSpend account and all active sessions have been permanently closed. Encrypted backups expire automatically according to our retention schedule.',
          expiryNotice: 'Thank you for using TrueSpend.',
          textFallback: `Hi ${safeName}, your TrueSpend account and active sessions have been closed.`,
        };
      }
      default: {
        return {
          subject: subject || 'Notification from TrueSpend',
          badgeLabel: 'Security Notice',
          displayName: safeName,
          heading: 'Notification from TrueSpend',
          bodyHtml: 'You have a new security notification regarding your TrueSpend workspace.',
          actionUrl: baseUrl,
          actionLabel: 'Open Workspace',
          expiryNotice: 'Manage your security preferences in Settings → Security.',
          textFallback: 'Notification from TrueSpend.',
        };
      }
    }
  }

  private resolvePublicBrandUrls(): { appIconUrl: string; spexAvatarUrl: string } {
    const baseUrl = this.getAppBaseUrl();
    const isPublicHttps =
      baseUrl.startsWith('https://') &&
      !baseUrl.includes('localhost') &&
      !baseUrl.includes('127.0.0.1');
    return {
      appIconUrl: isPublicHttps ? `${baseUrl}/app-icon.png` : DEFAULT_GITHUB_APP_ICON_URL,
      spexAvatarUrl: isPublicHttps ? `${baseUrl}/spex-avatar.jpg` : DEFAULT_GITHUB_SPEX_AVATAR_URL,
    };
  }

  public renderHtml(
    templateName: EmailTemplateName,
    payload: Record<string, any>,
    subject = 'TrueSpend Security Notification',
    eventRef = crypto.randomUUID().slice(0, 8).toUpperCase()
  ): string {
    const model = this.buildTemplateModel(templateName, subject, payload);
    const theme = resolveEmailThemePalette(payload?.theme || process.env.EMAIL_THEME);
    const darkPalette = EMAIL_THEME_PALETTES.dark;
    const { appIconUrl, spexAvatarUrl } = this.resolvePublicBrandUrls();
    const timestampUtc = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
    const preheader = escapeHtml(`${model.heading} — ${model.badgeLabel} for your TrueSpend account.`);
    const isDarkTheme = theme.mode === 'dark';

    const ctaSectionHtml =
      model.actionUrl && model.actionLabel
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta-wrap" style="margin:0 0 18px 0;">
            <tr>
              <td align="center" class="cta-cell ts-cta-cell" style="border-radius:10px;background-color:${theme.accent};">
                <a href="${model.actionUrl}" target="_blank" class="cta-btn" style="display:inline-block;min-height:20px;padding:12px 22px;font-family:${theme.fontDisplay};font-size:13.5px;line-height:1.3;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;text-align:center;">${model.actionLabel} &rarr;</a>
              </td>
            </tr>
          </table>`
        : '';

    const tokenSectionHtml = model.token
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ts-token-box" style="background-color:${theme.surfaceMuted};border:1px dashed ${theme.border};border-radius:10px;margin:0 0 18px 0;">
            <tr>
              <td style="padding:14px 16px;">
                <div class="ts-subtle" style="font-size:10px;line-height:1.3;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:${theme.textSubtle};margin-bottom:6px;">One-Time Verification / Recovery Code</div>
                <div class="ts-token" style="font-family:${theme.fontMono};font-size:13.5px;line-height:1.45;font-weight:700;color:${theme.text};letter-spacing:0.04em;word-break:break-all;">${model.token}</div>
              </td>
            </tr>
          </table>`
      : '';

    const fallbackLinkHtml = model.actionUrl
      ? `<div class="ts-subtle" style="font-size:11px;line-height:1.5;color:${theme.textSubtle};word-break:break-all;margin-top:10px;">Button not working? Copy &amp; paste this secure link into your browser:<br /><a href="${model.actionUrl}" class="ts-link" style="color:${theme.accent};text-decoration:underline;">${model.actionUrl}</a></div>`
      : '';

    const adaptiveDarkCss = isDarkTheme
      ? ''
      : `
    @media (prefers-color-scheme: dark) {
      html, body, .ts-canvas { background-color: ${darkPalette.canvas} !important; color: ${darkPalette.text} !important; }
      .ts-card { background-color: ${darkPalette.surface} !important; border-color: ${darkPalette.border} !important; }
      .ts-surface-muted, .ts-token-box, .ts-footer { background-color: ${darkPalette.surfaceMuted} !important; border-color: ${darkPalette.border} !important; }
      .ts-header-rule { border-bottom-color: ${darkPalette.border} !important; }
      .ts-title, .ts-token, .ts-brand-name { color: ${darkPalette.text} !important; }
      .ts-body { color: ${darkPalette.textMuted} !important; }
      .ts-subtle { color: ${darkPalette.textSubtle} !important; }
      .ts-badge { background-color: ${darkPalette.badgeBg} !important; border-color: ${darkPalette.badgeBorder} !important; color: ${darkPalette.badgeText} !important; }
      .ts-eyebrow { color: ${darkPalette.secondaryAccent} !important; }
      .ts-link { color: #818cf8 !important; }
      .ts-cta-cell { background-color: ${darkPalette.accent} !important; }
    }
    [data-ogsc] .ts-canvas { background-color: ${darkPalette.canvas} !important; }
    [data-ogsc] .ts-card { background-color: ${darkPalette.surface} !important; border-color: ${darkPalette.border} !important; }
    [data-ogsc] .ts-title, [data-ogsc] .ts-token, [data-ogsc] .ts-brand-name { color: ${darkPalette.text} !important; }
    [data-ogsc] .ts-body { color: ${darkPalette.textMuted} !important; }`;

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="color-scheme" content="${isDarkTheme ? 'dark' : 'light dark'}" />
  <meta name="supported-color-schemes" content="${isDarkTheme ? 'dark' : 'light dark'}" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <title>${escapeHtml(model.subject)}</title>
  <style type="text/css">
    :root { color-scheme: ${isDarkTheme ? 'dark' : 'light dark'}; supported-color-schemes: ${isDarkTheme ? 'dark' : 'light dark'}; }
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: ${theme.canvas} !important; -webkit-text-size-adjust: 100% !important; -ms-text-size-adjust: 100% !important; }
    table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (max-width: 560px) {
      .ts-outer-pad { padding: 12px 8px !important; }
      .ts-card { border-radius: 12px !important; }
      .sec-h { padding: 16px 16px 14px 16px !important; }
      .sec-s { padding: 14px 16px 4px 16px !important; }
      .sec-b { padding: 16px 16px 20px 16px !important; }
      .sec-f { padding: 14px 16px !important; }
      .e-h1 { font-size: 18px !important; }
      .e-p { font-size: 13.5px !important; }
    }
    @media only screen and (max-width: 480px) {
      .h-stack { display: block !important; width: 100% !important; text-align: left !important; }
      .h-badge { padding-top: 10px !important; text-align: left !important; }
      .cta-wrap, .cta-cell { width: 100% !important; }
      .cta-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 13px 16px !important; white-space: normal !important; }
    }${adaptiveDarkCss}
  </style>
</head>
<body class="ts-canvas" style="margin:0;padding:0;width:100%;background-color:${theme.canvas};font-family:${theme.fontBody};color:${theme.text};-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <div style="display:none;font-size:1px;color:${theme.canvas};line-height:1px;max-height:0px;max-width:0px;opacity:0;overflow:hidden;mso-hide:all;">
    ${preheader}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ts-canvas" style="width:100%;margin:0;padding:0;background-color:${theme.canvas};">
    <tr>
      <td align="center" class="ts-outer-pad" style="margin:0;padding:24px 12px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ts-card" style="width:100%;max-width:580px;margin:0 auto;padding:0;background-color:${theme.surface};border:1px solid ${theme.border};border-radius:16px;overflow:hidden;box-shadow:0 4px 16px rgba(15,23,42,0.05);">
          <tr>
            <td style="height:4px;background-color:${theme.accent};background:linear-gradient(90deg,${theme.accent} 0%,${theme.secondaryAccent} 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="sec-h ts-header-rule" style="padding:18px 24px 16px 24px;border-bottom:1px solid ${theme.border};">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" class="h-stack">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" width="38" style="width:38px;padding-right:10px;">
                          <img src="${appIconUrl}" alt="TrueSpend" width="30" height="30" style="display:block;width:30px;height:30px;border-radius:8px;border:1px solid ${theme.border};" />
                        </td>
                        <td valign="middle">
                          <span class="ts-brand-name" style="font-family:${theme.fontDisplay};font-size:15.5px;font-weight:800;letter-spacing:-0.02em;color:${theme.text};display:block;line-height:1.15;">TrueSpend</span>
                          <span class="ts-subtle" style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.06em;color:${theme.textSubtle};display:block;line-height:1.25;margin-top:2px;">Private Financial Intelligence</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" class="h-stack h-badge" style="white-space:nowrap;">
                    <span class="ts-badge" style="display:inline-block;padding:4px 10px;border-radius:6px;background-color:${theme.badgeBg};border:1px solid ${theme.badgeBorder};color:${theme.badgeText};font-size:10px;line-height:1.2;font-weight:700;letter-spacing:0.05em;text-transform:uppercase;white-space:nowrap;">${escapeHtml(model.badgeLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sec-s" style="padding:18px 24px 4px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ts-surface-muted" style="background-color:${theme.surfaceMuted};border:1px solid ${theme.border};border-radius:12px;">
                <tr>
                  <td style="padding:12px 14px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top" style="width:48px;padding-right:12px;">
                          <img src="${spexAvatarUrl}" alt="Spex AI" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:10px;background-color:${theme.surface};border:1px solid ${theme.border};object-fit:cover;" />
                        </td>
                        <td valign="middle">
                          <div class="ts-eyebrow" style="font-size:10px;line-height:1.3;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:${theme.secondaryAccent};margin-bottom:3px;">Spex Security Guardian &middot; ${timestampUtc}</div>
                          <div class="ts-title" style="font-size:13px;line-height:1.45;font-weight:600;color:${theme.text};">Hi ${model.displayName}, here is your ${escapeHtml(model.badgeLabel.toLowerCase())} update for TrueSpend.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sec-b" style="padding:18px 24px 24px 24px;">
              <h1 class="e-h1 ts-title" style="margin:0 0 10px 0;font-family:${theme.fontDisplay};font-size:20px;font-weight:800;letter-spacing:-0.02em;color:${theme.text};line-height:1.3;">${model.heading}</h1>
              <p class="e-p ts-body" style="margin:0 0 18px 0;font-size:14px;line-height:1.6;color:${theme.textMuted};">${model.bodyHtml}</p>
              ${ctaSectionHtml}
              ${tokenSectionHtml}
              <p class="ts-subtle" style="margin:0;font-size:12px;line-height:1.55;color:${theme.textSubtle};">${escapeHtml(model.expiryNotice)}</p>
            </td>
          </tr>
          <tr>
            <td class="sec-f ts-footer" style="padding:16px 24px;background-color:${theme.surfaceMuted};border-top:1px solid ${theme.border};">
              <div class="ts-subtle" style="font-size:11.5px;line-height:1.55;color:${theme.textSubtle};">
                <strong class="ts-title" style="color:${theme.text};">TrueSpend Security</strong> &middot; Ref #${escapeHtml(eventRef)}<br />
                Review active devices &amp; sessions anytime in <strong class="ts-body" style="color:${theme.textMuted};">Settings &rarr; Security</strong>.
              </div>
              ${fallbackLinkHtml}
              <div class="ts-subtle" style="font-size:11px;color:${theme.textSubtle};line-height:1.4;margin-top:10px;">&copy; 2026 TrueSpend. Automated security notice (${escapeHtml(eventRef)}).</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();
  }

  /**
   * Transactional outbox write + direct delivery attempt strictly to recipientEmail.
   * Never redirects external users' security emails to another address.
   */
  async enqueueAndSend(params: EnqueueEmailParams): Promise<EmailDeliveryResult> {
    let outboxId = '';
    if (!params.skipOutboxDb) {
      try {
        const [inserted] = await db
          .insert(emailOutbox)
          .values({
            userId: params.userId || null,
            recipientEmail: params.recipientEmail.trim().toLowerCase(),
            templateName: params.templateName,
            subject: params.subject,
            payloadJson: JSON.stringify(params.payload),
            status: 'pending',
            attempts: 0,
          })
          .returning();
        outboxId = inserted.id;
      } catch (err) {
        console.warn(
          '[EmailService] Outbox DB insert warning (proceeding with direct mail delivery):',
          (err as any)?.message || err
        );
      }
    }

    return await this.deliverOutboxEntry(
      outboxId,
      params.recipientEmail,
      params.subject,
      params.templateName,
      params.payload
    );
  }

  private async sendViaResend(
    resendApiKey: string,
    fromAddress: string,
    recipientEmail: string,
    subject: string,
    html: string,
    textFallback: string,
    entityRefId: string = crypto.randomUUID()
  ): Promise<Response> {
    return await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [recipientEmail.trim()],
        subject,
        html,
        text: textFallback,
        headers: {
          'X-Entity-Ref-ID': entityRefId,
        },
      }),
    });
  }

  private etherealAccountPromise: Promise<
    Awaited<ReturnType<typeof nodemailer.createTestAccount>> | null
  > | null = null;

  private async sendViaSmtp(
    smtpConfig: SmtpConfig,
    fromAddress: string,
    recipientEmail: string,
    subject: string,
    html: string,
    textFallback: string,
    entityRefId: string = crypto.randomUUID()
  ): Promise<{ messageId: string; response: string }> {
    const isGmailHost = Boolean(smtpConfig.host?.toLowerCase().includes('gmail'));
    const normalizedPass = isGmailHost
      ? smtpConfig.pass.replace(/\s+/g, '')
      : smtpConfig.pass;

    const transporter = smtpConfig.url
      ? nodemailer.createTransport(smtpConfig.url)
      : nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.user,
            pass: normalizedPass,
          },
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        });

    const smtpFrom =
      smtpConfig.user.includes('@') &&
      (fromAddress.toLowerCase().includes('onboarding@resend.dev') ||
        (isGmailHost && !fromAddress.toLowerCase().includes(smtpConfig.user.toLowerCase())))
        ? `TrueSpend Security <${smtpConfig.user}>`
        : fromAddress;

    const info = await transporter.sendMail({
      from: smtpFrom,
      to: recipientEmail.trim(),
      subject,
      html,
      text: textFallback,
      headers: {
        'X-Entity-Ref-ID': entityRefId,
      },
    });

    return {
      messageId: String(info?.messageId || entityRefId),
      response: String(info?.response || '250 OK'),
    };
  }

  /**
   * Free zero-domain Nodemailer Ethereal webmail relay for sandbox/unconfigured environments.
   * Generates a real, inspectable webmail URL (https://ethereal.email/message/...) without
   * requiring a paid domain or external SMTP credentials. Skipped during unit tests.
   */
  private async sendViaEtherealPreview(
    recipientEmail: string,
    subject: string,
    html: string,
    textFallback: string,
    entityRefId: string
  ): Promise<string | undefined> {
    if (process.env.NODE_ENV === 'test') {
      return undefined;
    }
    try {
      if (!this.etherealAccountPromise) {
        this.etherealAccountPromise = Promise.race([
          nodemailer.createTestAccount(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
        ]).catch(() => null);
      }
      const testAccount = await this.etherealAccountPromise;
      if (!testAccount) return undefined;

      const transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
        connectionTimeout: 3500,
        greetingTimeout: 3500,
      });

      const info = await Promise.race([
        transporter.sendMail({
          from: `TrueSpend Security <${testAccount.user}>`,
          to: recipientEmail.trim(),
          subject,
          html,
          text: textFallback,
          headers: { 'X-Entity-Ref-ID': entityRefId },
        }),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3500)),
      ]);

      if (!info) return undefined;
      const url = nodemailer.getTestMessageUrl(info);
      return typeof url === 'string' && url ? url : undefined;
    } catch {
      return undefined;
    }
  }

  private getResendApiKey(): string {
    return (
      process.env.RESEND_API_KEY ||
      process.env.RESEND_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');
  }

  private async updateOutboxStatus(
    outboxId: string,
    fields: { status: string; attempts: number; sentAt?: Date | null; lastError?: string | null }
  ) {
    if (!outboxId) return;
    await db
      .update(emailOutbox)
      .set(fields)
      .where(eq(emailOutbox.id, outboxId))
      .catch(() => undefined);
  }

  private async deliverOutboxEntry(
    outboxId: string,
    recipientEmail: string,
    subject: string,
    templateName: EmailTemplateName,
    payload: Record<string, any>
  ): Promise<EmailDeliveryResult> {
    const cleanRecipient = recipientEmail.trim();
    const rawKey = this.getResendApiKey();
    const smtpConfig = parseSmtpConfig(process.env);
    const transportOrder = selectEmailTransportOrder(process.env, smtpConfig, Boolean(rawKey));
    const configuredFrom = this.resolveFromAddress(smtpConfig);
    const entityRefId = outboxId || crypto.randomUUID();
    const shortRef = entityRefId.slice(0, 8).toUpperCase();
    const model = this.buildTemplateModel(templateName, subject, payload);
    const html = this.renderHtml(templateName, payload, subject, shortRef);

    if (transportOrder.length === 0) {
      const warning = formatEmailDeliveryWarning('NO_EMAIL_PROVIDER', cleanRecipient);
      const previewUrl = await this.sendViaEtherealPreview(
        cleanRecipient,
        subject,
        html,
        model.textFallback,
        entityRefId
      );
      console.info(
        `[EmailService] Outbox queued (${templateName}) -> ${cleanRecipient} (no SMTP or RESEND_API_KEY configured).`
      );
      await this.updateOutboxStatus(outboxId, {
        status: 'failed',
        attempts: 1,
        lastError: warning.slice(0, 240),
      });
      return {
        outboxId,
        status: 'queued_no_api_key',
        errorCode: 'NO_EMAIL_PROVIDER',
        warning,
        fromUsed: configuredFrom,
        ...(previewUrl ? { previewUrl } : {}),
      };
    }

    let attempts = 0;
    let lastErrorMessage = 'Email delivery failed';
    let lastErrorCode: EmailDeliveryFailureReason = 'PROVIDER_ERROR';
    let lastProviderStatus: number | undefined;

    for (const channel of transportOrder) {
      attempts += 1;

      if (channel === 'smtp' && smtpConfig) {
        try {
          const isGmailHost = Boolean(smtpConfig.host?.toLowerCase().includes('gmail'));
          const smtpFrom =
            smtpConfig.user.includes('@') &&
            (configuredFrom.toLowerCase().includes('onboarding@resend.dev') ||
              (isGmailHost && !configuredFrom.toLowerCase().includes(smtpConfig.user.toLowerCase())))
              ? `TrueSpend Security <${smtpConfig.user}>`
              : configuredFrom;

          const info = await this.sendViaSmtp(
            smtpConfig,
            smtpFrom,
            cleanRecipient,
            subject,
            html,
            model.textFallback,
            entityRefId
          );

          await this.updateOutboxStatus(outboxId, {
            status: 'sent',
            attempts,
            sentAt: new Date(),
            lastError: null,
          });

          return {
            outboxId,
            status: 'sent',
            transportUsed: 'smtp',
            providerStatus: 250,
            providerResponse: `${info.messageId}: ${info.response}`.slice(0, 240),
            fromUsed: smtpFrom,
          };
        } catch (smtpErr: any) {
          lastErrorMessage = String(smtpErr?.message || 'SMTP send failed');
          lastErrorCode = 'PROVIDER_ERROR';
          console.error(
            `[EmailService] SMTP delivery error (${smtpConfig.providerLabel}) -> ${cleanRecipient}:`,
            lastErrorMessage
          );
          continue;
        }
      }

      if (channel === 'resend' && rawKey) {
        let emailFrom = configuredFrom;
        try {
          let res = await this.sendViaResend(
            rawKey,
            emailFrom,
            cleanRecipient,
            subject,
            html,
            model.textFallback,
            entityRefId
          );
          let resBody = await res.text().catch(() => '');

          // Only retry with Resend's default sender if the configured From address itself is invalid/unverified,
          // NOT when Resend already rejected external recipients due to sandbox account restrictions.
          if (
            !res.ok &&
            (res.status === 403 || res.status === 422) &&
            !isResendSandboxRecipientRestriction(res.status, resBody) &&
            emailFrom !== DEFAULT_RESEND_FROM
          ) {
            console.warn(
              `[EmailService] Primary sender "${emailFrom}" returned ${res.status} (${resBody.slice(0, 160)}); retrying with "${DEFAULT_RESEND_FROM}".`
            );
            emailFrom = DEFAULT_RESEND_FROM;
            res = await this.sendViaResend(
              rawKey,
              emailFrom,
              cleanRecipient,
              subject,
              html,
              model.textFallback,
              entityRefId
            );
            resBody = await res.text().catch(() => '');
          }

          if (res.ok) {
            await this.updateOutboxStatus(outboxId, {
              status: 'sent',
              attempts,
              sentAt: new Date(),
              lastError: null,
            });
            return {
              outboxId,
              status: 'sent',
              transportUsed: 'resend',
              providerStatus: res.status,
              providerResponse: resBody.slice(0, 240),
              fromUsed: emailFrom,
            };
          }

          lastProviderStatus = res.status;
          if (isResendSandboxRecipientRestriction(res.status, resBody)) {
            lastErrorCode = 'RESEND_DOMAIN_NOT_VERIFIED';
            lastErrorMessage = `Resend sandbox restriction for recipient "${cleanRecipient}": ${resBody.slice(0, 180)}`;
            console.warn(`[EmailService] ${lastErrorMessage}`);
          } else {
            lastErrorCode = 'PROVIDER_ERROR';
            lastErrorMessage = `Email provider error (${res.status}): ${resBody.slice(0, 200)}`;
            console.error(`[EmailService] Resend delivery failed -> ${cleanRecipient}:`, lastErrorMessage);
          }
        } catch (resendErr: any) {
          lastErrorCode = 'PROVIDER_ERROR';
          lastErrorMessage = String(resendErr?.message || 'Resend send failed');
          console.error('[EmailService] Resend request error:', lastErrorMessage);
        }
      }
    }

    const warning = formatEmailDeliveryWarning(lastErrorCode, cleanRecipient);
    const previewUrl = await this.sendViaEtherealPreview(
      cleanRecipient,
      subject,
      html,
      model.textFallback,
      entityRefId
    );
    await this.updateOutboxStatus(outboxId, {
      status: 'failed',
      attempts,
      lastError: lastErrorMessage.slice(0, 240),
    });

    return {
      outboxId,
      status: lastErrorCode === 'RESEND_DOMAIN_NOT_VERIFIED' ? 'sandbox_blocked' : 'failed',
      errorCode: lastErrorCode,
      warning,
      providerStatus: lastProviderStatus,
      providerResponse: lastErrorMessage.slice(0, 240),
      fromUsed: configuredFrom,
      ...(previewUrl ? { previewUrl } : {}),
    };
  }

  async sendTestEmailWithDiagnostics(params: {
    email?: string;
    templateName?: EmailTemplateName;
    subject?: string;
    payload?: Record<string, any>;
  }) {
    const targetEmail = String(params.email || '').trim();
    if (!targetEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      throw new Error('A valid target email address is required.');
    }

    const rawKey = this.getResendApiKey();
    const smtpConfig = parseSmtpConfig(process.env);
    const transportOrder = selectEmailTransportOrder(process.env, smtpConfig, Boolean(rawKey));
    const templateName: EmailTemplateName = params.templateName || 'email_verification';
    const subject = params.subject || 'Verify your TrueSpend email address';
    const payload = params.payload || {
      displayName: targetEmail.split('@')[0] || 'TrueSpend User',
      token: 'TS-VERIFY-SAMPLE',
      deviceLabel: 'TrueSpend Web & Android Suite',
    };

    const primaryResult = await this.enqueueAndSend({
      recipientEmail: targetEmail,
      templateName,
      subject,
      payload,
    });

    let recentOutbox: any[] = [];
    try {
      const rows = await db.select().from(emailOutbox).limit(10);
      recentOutbox = rows
        .slice(-5)
        .map((r) => ({
          id: r.id,
          recipientEmail: r.recipientEmail,
          templateName: r.templateName,
          status: r.status,
          lastError: r.lastError,
          createdAt: r.createdAt,
          sentAt: r.sentAt,
        }));
    } catch {}

    const activeSenderMode: ActiveEmailSenderMode = resolveActiveEmailSenderMode(
      process.env,
      smtpConfig,
      Boolean(rawKey)
    );

    return {
      activeSenderMode,
      gmailAppPasswordActive: activeSenderMode === 'gmail_app_password',
      hasResendApiKey: Boolean(rawKey),
      resendKeyPrefix: rawKey ? `${rawKey.slice(0, 6)}...` : null,
      hasSmtpConfig: Boolean(smtpConfig),
      smtpProvider: smtpConfig?.providerLabel || null,
      transportOrder,
      configuredEmailFrom: process.env.EMAIL_FROM || null,
      resolvedEmailFrom: this.resolveFromAddress(smtpConfig),
      targetEmail,
      primaryResult,
      recentOutbox,
    };
  }
}

export const emailService = new EmailService();
