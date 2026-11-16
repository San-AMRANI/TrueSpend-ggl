import { db } from '../../src/db/index.js';
import { emailOutbox } from '../../src/db/schema.js';
import { eq } from 'drizzle-orm';

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

const DEFAULT_RESEND_FROM = 'TrueSpend Security <onboarding@resend.dev>';
const SPEX_AVATAR_URL =
  'https://raw.githubusercontent.com/San-AMRANI/TrueSpend-ggl/main/public/spex-avatar.png';
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

  private resolveFromAddress(): string {
    const configured = (process.env.EMAIL_FROM || '').trim();
    if (!configured || configured.toLowerCase().includes('@truespend.app')) {
      return DEFAULT_RESEND_FROM;
    }
    return configured;
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
    subject = 'TrueSpend Security Notification'
  ): string {
    const model = this.buildTemplateModel(templateName, subject, payload);

    const ctaSectionHtml =
      model.actionUrl && model.actionLabel
        ? `
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;">
            <tr>
              <td align="center" style="border-radius:12px;background:linear-gradient(135deg,#4f46e5 0%,#4338ca 100%);box-shadow:0 4px 12px rgba(79,70,229,0.24);">
                <a href="${model.actionUrl}" target="_blank" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px;letter-spacing:0.01em;">
                  ${model.actionLabel} &rarr;
                </a>
              </td>
            </tr>
          </table>
        `
        : '';

    const tokenSectionHtml = model.token
      ? `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px dashed #cbd5e1;border-radius:12px;margin:0 0 22px 0;">
            <tr>
              <td style="padding:14px 18px;">
                <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;margin-bottom:6px;">
                  Verification / Recovery Code
                </div>
                <div style="font-family:'JetBrains Mono','SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace;font-size:16px;font-weight:700;color:#0f172a;letter-spacing:0.06em;word-break:break-all;">
                  ${model.token}
                </div>
              </td>
            </tr>
          </table>
        `
      : '';

    const fallbackLinkHtml = model.actionUrl
      ? `
          <div style="font-size:12px;line-height:1.6;color:#94a3b8;word-break:break-all;">
            Button not working? Paste this URL into your browser:<br />
            <a href="${model.actionUrl}" style="color:#4f46e5;text-decoration:underline;">${model.actionUrl}</a>
          </div>
        `
      : '';

    return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(model.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:'Plus Jakarta Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#0f172a;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #e2e8f0;border-radius:20px;overflow:hidden;box-shadow:0 12px 32px -8px rgba(15,23,42,0.06);">
          <tr>
            <td style="height:5px;background:linear-gradient(90deg,#4f46e5 0%,#0d9488 100%);font-size:0;line-height:0;">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 20px 32px;border-bottom:1px solid #f1f5f9;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td valign="middle">
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td valign="middle" style="padding-right:10px;">
                          <img src="${APP_ICON_URL}" alt="TrueSpend" width="32" height="32" style="display:block;width:32px;height:32px;border-radius:8px;border:1px solid #e2e8f0;" />
                        </td>
                        <td valign="middle">
                          <span style="font-size:17px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;display:block;line-height:1.1;">TrueSpend</span>
                          <span style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;color:#64748b;display:block;margin-top:2px;">Private Financial Intelligence</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                  <td align="right" valign="middle">
                    <span style="display:inline-block;padding:5px 10px;border-radius:999px;background-color:#eef2ff;border:1px solid #c7d2fe;color:#4f46e5;font-size:11px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">
                      ${escapeHtml(model.badgeLabel)}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:24px 32px 8px 32px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:16px;padding:16px;">
                <tr>
                  <td width="60" valign="middle" style="padding-right:14px;">
                    <img src="${SPEX_AVATAR_URL}" alt="Spex Companion" width="54" height="54" style="display:block;width:54px;height:54px;border-radius:14px;background-color:#ffffff;border:1px solid #cbd5e1;object-fit:cover;" />
                  </td>
                  <td valign="middle">
                    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:#0d9488;margin-bottom:3px;">
                      Spex Security Guardian
                    </div>
                    <div style="font-size:14px;font-weight:600;color:#0f172a;line-height:1.4;">
                      Hi ${model.displayName}, here is an important update for your TrueSpend workspace.
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px 32px;">
              <h1 style="margin:0 0 12px 0;font-size:21px;font-weight:800;letter-spacing:-0.02em;color:#0f172a;line-height:1.3;">
                ${model.heading}
              </h1>
              <p style="margin:0 0 22px 0;font-size:15px;line-height:1.65;color:#475569;">
                ${model.bodyHtml}
              </p>
              ${ctaSectionHtml}
              ${tokenSectionHtml}
              <p style="margin:0;font-size:13px;line-height:1.6;color:#64748b;">
                ${escapeHtml(model.expiryNotice)}
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 26px 32px;background-color:#f8fafc;border-top:1px solid #e2e8f0;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="font-size:12px;line-height:1.6;color:#64748b;">
                    <strong style="color:#0f172a;">TrueSpend Security</strong> &middot; Zero-Trust Personal Finance Ledger<br />
                    You can review active devices and sessions anytime in <strong style="color:#334155;">Settings &rarr; Security</strong>.
                  </td>
                </tr>
                <tr>
                  <td style="padding-top:12px;">
                    ${fallbackLinkHtml}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;margin-top:16px;">
          <tr>
            <td align="center" style="font-size:11px;color:#94a3b8;line-height:1.5;">
              &copy; 2026 TrueSpend. Automated security message &mdash; please do not reply directly to this email.
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
   * Transactional outbox write + asynchronous delivery attempt.
   * Email delivery failure never rolls back database state and remains retryable.
   */
  async enqueueAndSend(params: EnqueueEmailParams): Promise<{ outboxId: string; status: string }> {
    let outboxId = '';
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
        '[EmailService] Outbox DB insert warning (proceeding with direct Resend delivery):',
        (err as any)?.message || err
      );
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
    textFallback: string
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
      }),
    });
  }

  private async deliverOutboxEntry(
    outboxId: string,
    recipientEmail: string,
    subject: string,
    templateName: EmailTemplateName,
    payload: Record<string, any>
  ): Promise<{ outboxId: string; status: string }> {
    const rawKey = (
      process.env.RESEND_API_KEY ||
      process.env.RESEND_KEY ||
      process.env.VITE_RESEND_API_KEY ||
      ''
    )
      .trim()
      .replace(/^["']|["']$/g, '');
    const emailFrom = this.resolveFromAddress().replace(/^["']|["']$/g, '');
    const model = this.buildTemplateModel(templateName, subject, payload);
    const html = this.renderHtml(templateName, payload, subject);

    try {
      if (rawKey) {
        let res = await this.sendViaResend(
          rawKey,
          emailFrom,
          recipientEmail,
          subject,
          html,
          model.textFallback
        );

        // If custom EMAIL_FROM fails with 403 or 422 (domain not verified / invalid from),
        // automatically retry with Resend's default verified sender.
        if (!res.ok && (res.status === 403 || res.status === 422)) {
          const firstErrText = await res.text().catch(() => '');
          console.warn(
            `[EmailService] Primary sender "${emailFrom}" returned ${res.status} (${firstErrText.slice(0, 120)}); retrying with "${DEFAULT_RESEND_FROM}".`
          );
          if (emailFrom !== DEFAULT_RESEND_FROM) {
            res = await this.sendViaResend(
              rawKey,
              DEFAULT_RESEND_FROM,
              recipientEmail,
              subject,
              html,
              model.textFallback
            );
          }
          if (!res.ok && (res.status === 403 || res.status === 422)) {
            res = await this.sendViaResend(
              rawKey,
              'onboarding@resend.dev',
              recipientEmail,
              subject,
              html,
              model.textFallback
            );
          }
        }

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`Email provider error (${res.status}): ${text.slice(0, 160)}`);
        }
      } else {
        // Without external email credentials configured (local/dev preview), outbox records remain persisted and inspectable
        console.info(
          `[EmailService] Outbox queued (${templateName}) -> ${recipientEmail} (no RESEND_API_KEY configured).`
        );
      }

      if (outboxId) {
        await db
          .update(emailOutbox)
          .set({
            status: 'sent',
            attempts: 1,
            sentAt: new Date(),
            lastError: null,
          })
          .where(eq(emailOutbox.id, outboxId));
      }
      return { outboxId, status: 'sent' };
    } catch (err: any) {
      console.error('[EmailService] Delivery error:', err?.message || err);
      if (outboxId) {
        await db
          .update(emailOutbox)
          .set({
            status: 'failed',
            attempts: 1,
            lastError: String(err?.message || 'Send failed').slice(0, 240),
          })
          .where(eq(emailOutbox.id, outboxId))
          .catch(() => undefined);
      }
      return { outboxId, status: 'failed' };
    }
  }
}

export const emailService = new EmailService();
