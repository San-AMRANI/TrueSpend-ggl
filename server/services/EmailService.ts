import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { db } from '../../src/db/index.js';
import { emailOutbox } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';
import {
  DEFAULT_RESEND_FROM,
  EmailDeliveryFailureReason,
  EmailTransportChannel,
  SmtpConfig,
  formatEmailDeliveryWarning,
  isResendSandboxRecipientRestriction,
  parseSmtpConfig,
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
}

const SPEX_AVATAR_URL =
  'https://raw.githubusercontent.com/San-AMRANI/TrueSpend-ggl/main/public/spex-avatar.jpg';
const APP_ICON_URL =
  'https://raw.githubusercontent.com/San-AMRANI/TrueSpend-ggl/main/public/app-icon.png';

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

  private renderHtml(
    templateName: EmailTemplateName,
    payload: Record<string, any>,
    subject = 'TrueSpend Security Notification',
    eventRef = crypto.randomUUID().slice(0, 8).toUpperCase()
  ): string {
    const model = this.buildTemplateModel(templateName, subject, payload);
    const timestampUtc = new Date().toISOString().replace('T', ' ').slice(0, 16) + ' UTC';

    const ctaSectionHtml =
      model.actionUrl && model.actionLabel
        ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="cta-wrap" style="margin:0 0 16px 0;">
            <tr>
              <td align="center" class="cta-cell" style="border-radius:10px;background-color:#4f46e5;">
                <a href="${model.actionUrl}" target="_blank" class="cta-btn" style="display:inline-block;padding:11px 20px;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.2;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;white-space:nowrap;">${model.actionLabel} &rarr;</a>
              </td>
            </tr>
          </table>`
        : '';

    const tokenSectionHtml = model.token
      ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:10px;margin:0 0 16px 0;">
            <tr>
              <td style="padding:12px 14px;">
                <div style="font-size:10px;line-height:1.3;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#64748b;margin-bottom:4px;">Verification / Recovery Code</div>
                <div style="font-family:'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:14px;line-height:1.4;font-weight:700;color:#0f172a;letter-spacing:0.05em;word-break:break-all;">${model.token}</div>
              </td>
            </tr>
          </table>`
      : '';

    const fallbackLinkHtml = model.actionUrl
      ? `<div style="font-size:11px;line-height:1.45;color:#64748b;word-break:break-all;margin-top:8px;">Button not working? Paste this URL into your browser:<br /><a href="${model.actionUrl}" style="color:#4f46e5;text-decoration:underline;">${model.actionUrl}</a></div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no" />
  <title>${escapeHtml(model.subject)}</title>
  <style type="text/css">
    html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #ffffff !important; -webkit-text-size-adjust: 100% !important; -ms-text-size-adjust: 100% !important; }
    table, td { mso-table-lspace: 0pt !important; mso-table-rspace: 0pt !important; border-collapse: collapse !important; }
    img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; }
    @media only screen and (min-width: 600px) {
      .sec-h { padding: 18px 24px 14px 24px !important; }
      .sec-s { padding: 14px 24px 4px 24px !important; }
      .sec-b { padding: 14px 24px 20px 24px !important; }
      .sec-f { padding: 16px 24px !important; }
      .e-h1 { font-size: 20px !important; }
      .e-p { font-size: 14px !important; }
    }
    @media only screen and (max-width: 480px) {
      .h-stack { display: block !important; width: 100% !important; text-align: left !important; }
      .h-badge { padding-top: 8px !important; }
      .cta-wrap, .cta-cell { width: 100% !important; }
      .cta-btn { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;width:100%;background-color:#ffffff;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0;padding:0;background-color:#ffffff;">
    <tr>
      <td align="center" style="margin:0;padding:0;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;margin:0 auto;padding:0;background-color:#ffffff;">
          <tr>
            <td style="height:4px;background-color:#4f46e5;background:linear-gradient(90deg,#4f46e5 0%,#0d9488 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td class="sec-h" style="padding:14px 16px 12px 16px;border-bottom:1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle" class="h-stack">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" width="36" style="width:36px;padding-right:10px;">
                          <img src="${APP_ICON_URL}" alt="TrueSpend" width="28" height="28" style="display:block;width:28px;height:28px;border-radius:7px;border:1px solid #e2e8f0;" />
                        </td>
                        <td valign="middle">
                          <span style="font-size:15px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;display:block;line-height:1.15;">TrueSpend</span>
                          <span style="font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.05em;color:#64748b;display:block;line-height:1.25;margin-top:2px;">Private Financial Intelligence</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle" class="h-stack h-badge" style="white-space:nowrap;">
                    <span style="display:inline-block;padding:4px 9px;border-radius:999px;background-color:#eef2ff;border:1px solid #c7d2fe;color:#4f46e5;font-size:10px;line-height:1.2;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;white-space:nowrap;">${escapeHtml(model.badgeLabel)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sec-s" style="padding:14px 16px 4px 16px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;">
                <tr>
                  <td style="padding:12px;">
                    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td width="48" valign="top" style="width:48px;padding-right:12px;">
                          <img src="${SPEX_AVATAR_URL}" alt="Spex AI" width="40" height="40" style="display:block;width:40px;height:40px;border-radius:10px;background-color:#ffffff;border:1px solid #cbd5e1;object-fit:cover;" />
                        </td>
                        <td valign="middle">
                          <div style="font-size:10px;line-height:1.3;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#0d9488;margin-bottom:2px;">Spex Security Guardian &middot; ${timestampUtc}</div>
                          <div style="font-size:13px;line-height:1.45;font-weight:600;color:#0f172a;">Hi ${model.displayName}, here is your ${escapeHtml(model.badgeLabel.toLowerCase())} update for TrueSpend.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td class="sec-b" style="padding:14px 16px 18px 16px;">
              <h1 class="e-h1" style="margin:0 0 8px 0;font-size:18px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;line-height:1.3;">${model.heading}</h1>
              <p class="e-p" style="margin:0 0 16px 0;font-size:13.5px;line-height:1.55;color:#475569;">${model.bodyHtml}</p>
              ${ctaSectionHtml}
              ${tokenSectionHtml}
              <p style="margin:0;font-size:12px;line-height:1.5;color:#64748b;">${escapeHtml(model.expiryNotice)}</p>
            </td>
          </tr>
          <tr>
            <td class="sec-f" style="padding:14px 16px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <div style="font-size:11.5px;line-height:1.5;color:#64748b;">
                <strong style="color:#0f172a;">TrueSpend Security</strong> &middot; Ref #${escapeHtml(eventRef)}<br />
                Review active sessions anytime in <strong style="color:#334155;">Settings &rarr; Security</strong>.
              </div>
              ${fallbackLinkHtml}
              <div style="font-size:11px;color:#94a3b8;line-height:1.4;margin-top:10px;">&copy; 2026 TrueSpend. Automated security notice (${escapeHtml(eventRef)}).</div>
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

  private async sendViaSmtp(
    smtpConfig: SmtpConfig,
    fromAddress: string,
    recipientEmail: string,
    subject: string,
    html: string,
    textFallback: string,
    entityRefId: string = crypto.randomUUID()
  ): Promise<{ messageId: string; response: string }> {
    const transporter = smtpConfig.url
      ? nodemailer.createTransport(smtpConfig.url)
      : nodemailer.createTransport({
          host: smtpConfig.host,
          port: smtpConfig.port,
          secure: smtpConfig.secure,
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        });

    const smtpFrom =
      fromAddress.toLowerCase().includes('onboarding@resend.dev') && smtpConfig.user.includes('@')
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
          const smtpFrom =
            configuredFrom.toLowerCase().includes('onboarding@resend.dev') &&
            smtpConfig.user.includes('@')
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

    return {
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
