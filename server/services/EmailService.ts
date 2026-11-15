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

export type EmailDeliveryStatus = 'sent' | 'not_configured' | 'failed' | 'skipped';

export interface EmailSendResult {
  outboxId: string;
  status: EmailDeliveryStatus;
  delivered: boolean;
  configured: boolean;
  error?: string;
}

export class EmailService {
  isEmailDeliveryConfigured(): boolean {
    return Boolean((process.env.RESEND_API_KEY || '').trim());
  }

  private getAppBaseUrl(): string {
    return (process.env.APP_URL || process.env.FRONTEND_URL || 'http://localhost:3000').replace(
      /\/$/,
      ''
    );
  }

  private renderHtml(templateName: EmailTemplateName, payload: Record<string, any>): string {
    const baseUrl = this.getAppBaseUrl();
    const safeName = String(payload.displayName || 'there').replace(/[<>&]/g, '');

    switch (templateName) {
      case 'email_verification': {
        const link = `${baseUrl}/?verifyToken=${encodeURIComponent(payload.token || '')}`;
        return `
          <h2>Welcome to TrueSpend, ${safeName}</h2>
          <p>Confirm your email address to activate your private financial workspace.</p>
          <p><a href="${link}">Verify Email Address</a></p>
          <p>Or enter this verification code in the app: <code>${payload.token}</code></p>
          <p>This link expires in 24 hours. If you did not register for TrueSpend, you can ignore this message.</p>
        `.trim();
      }
      case 'email_change_verification': {
        const link = `${baseUrl}/?verifyToken=${encodeURIComponent(payload.token || '')}`;
        return `
          <h2>Confirm your new TrueSpend email</h2>
          <p>Hi ${safeName}, confirm this email change to complete updating your account email.</p>
          <p><a href="${link}">Confirm New Email</a></p>
          <p>Verification code: <code>${payload.token}</code></p>
          <p>Your previous email remains active until you confirm.</p>
        `.trim();
      }
      case 'email_change_notice':
        return `
          <h2>Email Change Requested</h2>
          <p>Hi ${safeName}, a request was made to change your TrueSpend account email to ${String(payload.pendingEmail || '')}.</p>
          <p>If this wasn't you, change your password immediately and sign out all sessions in Settings → Security.</p>
        `.trim();
      case 'password_reset': {
        const link = `${baseUrl}/?resetToken=${encodeURIComponent(payload.token || '')}`;
        return `
          <h2>Reset your TrueSpend password</h2>
          <p>We received a request to reset the password for your TrueSpend account.</p>
          <p><a href="${link}">Choose a New Password</a></p>
          <p>Or enter this reset code: <code>${payload.token}</code></p>
          <p>This link expires in 30 minutes and can only be used once. If you didn't request this, ignore this email.</p>
        `.trim();
      }
      case 'password_changed':
        return `
          <h2>Your TrueSpend password was changed</h2>
          <p>Hi ${safeName}, your TrueSpend password was recently updated and other active sessions were signed out.</p>
          <p>If you did not make this change, use Forgot Password immediately to recover your account.</p>
        `.trim();
      case 'new_signin_alert':
        return `
          <h2>New sign-in to your TrueSpend account</h2>
          <p>Hi ${safeName}, we noticed a sign-in from <strong>${String(payload.deviceLabel || 'a device')}</strong>.</p>
          <p>You can review or revoke active sessions at any time in Settings → Security.</p>
        `.trim();
      case 'account_deleted':
        return `
          <h2>Your TrueSpend account has been removed</h2>
          <p>Your TrueSpend account and active sessions have been closed. Backups expire automatically according to our retention schedule.</p>
        `.trim();
      default:
        return `<p>Notification from TrueSpend.</p>`;
    }
  }

  /**
   * Transactional outbox write + asynchronous delivery attempt.
   * Email delivery failure never rolls back database state and remains retryable.
   */
  async enqueueAndSend(params: EnqueueEmailParams): Promise<EmailSendResult> {
    const configured = this.isEmailDeliveryConfigured();
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
      console.warn('[EmailService] Failed to insert outbox row:', (err as any)?.message || err);
      return { outboxId: '', status: 'skipped', delivered: false, configured };
    }

    return await this.deliverOutboxEntry(
      outboxId,
      params.recipientEmail,
      params.subject,
      params.templateName,
      params.payload
    );
  }

  private async deliverOutboxEntry(
    outboxId: string,
    recipientEmail: string,
    subject: string,
    templateName: EmailTemplateName,
    payload: Record<string, any>
  ): Promise<EmailSendResult> {
    const resendApiKey = (process.env.RESEND_API_KEY || '').trim();
    const emailFrom = (process.env.EMAIL_FROM || 'TrueSpend Security <no-reply@truespend.app>').trim();
    const html = this.renderHtml(templateName, payload);

    if (!resendApiKey) {
      console.info(
        `[EmailService] Outbox queued (${templateName}) -> ${recipientEmail} (RESEND_API_KEY is not configured; email was not transmitted).`
      );
      if (outboxId) {
        await db
          .update(emailOutbox)
          .set({
            status: 'not_configured',
            attempts: 0,
            lastError: 'RESEND_API_KEY is not configured on the server.',
          })
          .where(eq(emailOutbox.id, outboxId))
          .catch(() => undefined);
      }
      return {
        outboxId,
        status: 'not_configured',
        delivered: false,
        configured: false,
        error: 'RESEND_API_KEY is not configured on the server.',
      };
    }

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: emailFrom,
          to: [recipientEmail],
          subject,
          html,
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Resend API error (${res.status}): ${text.slice(0, 180)}`);
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
      return { outboxId, status: 'sent', delivered: true, configured: true };
    } catch (err: any) {
      const errMsg = String(err?.message || 'Send failed').slice(0, 240);
      console.error(`[EmailService] Failed sending ${templateName} to ${recipientEmail}:`, errMsg);
      if (outboxId) {
        await db
          .update(emailOutbox)
          .set({
            status: 'failed',
            attempts: 1,
            lastError: errMsg,
          })
          .where(eq(emailOutbox.id, outboxId))
          .catch(() => undefined);
      }
      return {
        outboxId,
        status: 'failed',
        delivered: false,
        configured: true,
        error: errMsg,
      };
    }
  }
}

export const emailService = new EmailService();

