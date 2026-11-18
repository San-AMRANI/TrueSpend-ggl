import test from 'node:test';
import assert from 'node:assert/strict';
import nodemailer from 'nodemailer';
import {
  DEFAULT_RESEND_FROM,
  formatEmailDeliveryWarning,
  isResendSandboxRecipientRestriction,
  parseSmtpConfig,
  resolveActiveEmailSenderMode,
  resolveEmailFromAddress,
  selectEmailTransportOrder,
} from '../server/services/emailDeliveryHelpers.js';
import { emailService, resolveEmailThemePalette } from '../server/services/EmailService.js';

test.after(async () => {
  await (globalThis as any)._pgliteInstance?.close?.();
});

function snapshotMailEnv() {
  const keys = [
    'RESEND_API_KEY',
    'RESEND_KEY',
    'VITE_RESEND_API_KEY',
    'EMAIL_FROM',
    'SMTP_FROM',
    'EMAIL_PROVIDER',
    'SMTP_URL',
    'SMTP_HOST',
    'SMTP_PORT',
    'SMTP_SECURE',
    'SMTP_USER',
    'SMTP_PASS',
    'GMAIL_USER',
    'GMAIL_APP_PASSWORD',
    'APP_URL',
    'VERCEL',
  ];
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) {
    saved[k] = process.env[k];
  }
  return () => {
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  };
}

test('parseSmtpConfig detects explicit SMTP and Gmail App Password config', () => {
  const explicit = parseSmtpConfig({
    SMTP_HOST: 'smtp.example.org',
    SMTP_PORT: '587',
    SMTP_USER: 'mailer@example.org',
    SMTP_PASS: 'app-pass-123',
  } as any);
  assert.deepEqual(explicit, {
    host: 'smtp.example.org',
    port: 587,
    secure: false,
    user: 'mailer@example.org',
    pass: 'app-pass-123',
    providerLabel: 'smtp.example.org',
  });

  const gmail = parseSmtpConfig({
    GMAIL_USER: 'sender@gmail.com',
    GMAIL_APP_PASSWORD: 'abcd efgh ijkl mnop',
  } as any);
  assert.deepEqual(gmail, {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'sender@gmail.com',
    pass: 'abcdefghijklmnop',
    providerLabel: 'smtp.gmail.com',
  });

  assert.equal(parseSmtpConfig({} as any), null);
});

test('resolveEmailFromAddress preserves custom verified domain and defaults to SMTP user when available', () => {
  assert.equal(
    resolveEmailFromAddress({ EMAIL_FROM: 'Security <noreply@truespend.app>' } as any, null),
    'Security <noreply@truespend.app>',
  );
  assert.equal(
    resolveEmailFromAddress(
      {} as any,
      {
        host: 'smtp.gmail.com',
        port: 465,
        secure: true,
        user: 'custom-sender@gmail.com',
        pass: 'secret',
        providerLabel: 'smtp.gmail.com',
      },
    ),
    'TrueSpend Security <custom-sender@gmail.com>',
  );
  assert.equal(resolveEmailFromAddress({} as any, null), DEFAULT_RESEND_FROM);
});

test('selectEmailTransportOrder prefers SMTP over unverified Resend sandbox and Resend first when custom EMAIL_FROM is set', () => {
  const smtpCfg = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'sender@gmail.com',
    pass: 'secret',
    providerLabel: 'smtp.gmail.com',
  };

  // Both SMTP and Resend key present, but NO custom verified EMAIL_FROM -> SMTP must go first
  assert.deepEqual(selectEmailTransportOrder({} as any, smtpCfg, true), ['smtp', 'resend']);
  assert.equal(resolveActiveEmailSenderMode({} as any, smtpCfg, true), 'gmail_app_password');

  // Even if someone set EMAIL_FROM to a @gmail.com address, Resend cannot verify gmail.com -> Gmail SMTP must go first
  assert.deepEqual(
    selectEmailTransportOrder({ EMAIL_FROM: 'TrueSpend <sender@gmail.com>' } as any, smtpCfg, true),
    ['smtp', 'resend'],
  );

  // Explicit EMAIL_PROVIDER=gmail forces Gmail SMTP first even if EMAIL_FROM is set
  assert.deepEqual(
    selectEmailTransportOrder(
      { EMAIL_PROVIDER: 'gmail', EMAIL_FROM: 'TrueSpend <noreply@verified.com>' } as any,
      smtpCfg,
      true,
    ),
    ['smtp', 'resend'],
  );

  // Custom verified EMAIL_FROM + Resend key (without EMAIL_PROVIDER=gmail) -> Resend goes first, SMTP is backup
  assert.deepEqual(
    selectEmailTransportOrder({ EMAIL_FROM: 'TrueSpend <noreply@verified.com>' } as any, smtpCfg, true),
    ['resend', 'smtp'],
  );
});

test('isResendSandboxRecipientRestriction detects sandbox error cleanly', () => {
  assert.equal(
    isResendSandboxRecipientRestriction(
      403,
      '{"statusCode":403,"message":"You can only send testing emails to your own email address (amranihassan.am@gmail.com). To send emails to other recipients, please verify a domain at resend.com/domains."}',
    ),
    true,
  );
  assert.equal(isResendSandboxRecipientRestriction(200, '{"id":"ok"}'), false);
});

test('EmailService NEVER redirects external signup emails to owner email on Resend 403 sandbox block', async () => {
  const restoreEnv = snapshotMailEnv();
  const originalFetch = globalThis.fetch;
  const sentPayloads: Array<{ url: string; body: any }> = [];

  try {
    process.env.RESEND_API_KEY = 're_test_sandbox_key';
    delete process.env.EMAIL_FROM;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_URL;
    delete process.env.GMAIL_USER;

    globalThis.fetch = (async (url: any, init: any) => {
      sentPayloads.push({
        url: String(url),
        body: init?.body ? JSON.parse(String(init.body)) : null,
      });
      return new Response(
        JSON.stringify({
          statusCode: 403,
          message:
            'You can only send testing emails to your own email address (amranihassan.am@gmail.com).',
        }),
        { status: 403, headers: { 'content-type': 'application/json' } },
      );
    }) as any;

    const result = await emailService.enqueueAndSend({
      userId: null,
      recipientEmail: 'new.signup.user@example.com',
      templateName: 'email_verification',
      subject: 'Verify your TrueSpend email address',
      payload: { displayName: 'New User', token: 'secret-token-123' },
      skipOutboxDb: true,
    });

    assert.equal(sentPayloads.length, 1);
    assert.equal(sentPayloads[0].url, 'https://api.resend.com/emails');
    assert.deepEqual(sentPayloads[0].body.to, ['new.signup.user@example.com']);
    assert.equal(result.status, 'sandbox_blocked');
    assert.equal(result.errorCode, 'RESEND_DOMAIN_NOT_VERIFIED');
    assert.ok(result.warning?.includes('new.signup.user@example.com'));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('EmailService delivers strictly to recipientEmail via Resend when verified or via SMTP fallback', async () => {
  const restoreEnv = snapshotMailEnv();
  const originalFetch = globalThis.fetch;
  const origCreateTransport = nodemailer.createTransport;
  const smtpCalls: any[] = [];
  const fetchCalls: any[] = [];

  try {
    process.env.RESEND_API_KEY = 're_test_verified_key';
    process.env.EMAIL_FROM = 'TrueSpend <noreply@verified.truespend.test>';
    process.env.GMAIL_USER = 'smtp-fallback@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-xyz';

    // Case 1: Resend fails with 403 sandbox -> falls back to SMTP strictly for signup recipient
    globalThis.fetch = (async (url: any, init: any) => {
      fetchCalls.push({ url: String(url), body: JSON.parse(String(init.body)) });
      return new Response(
        JSON.stringify({
          message:
            'You can only send testing emails to your own email address (amranihassan.am@gmail.com).',
        }),
        { status: 403 },
      );
    }) as any;

    (nodemailer as any).createTransport = () => ({
      sendMail: async (mail: any) => {
        smtpCalls.push(mail);
        return { messageId: 'smtp-msg-1', response: '250 2.0.0 OK' };
      },
    });

    const res = await emailService.enqueueAndSend({
      userId: null,
      recipientEmail: 'alice.brandnew@gmail.com',
      templateName: 'email_verification',
      subject: 'Verify your TrueSpend email address',
      payload: { displayName: 'Alice', token: 'tok-alice' },
      skipOutboxDb: true,
    });

    assert.equal(fetchCalls.length, 1);
    assert.deepEqual(fetchCalls[0].body.to, ['alice.brandnew@gmail.com']);
    assert.equal(smtpCalls.length, 1);
    assert.equal(smtpCalls[0].to, 'alice.brandnew@gmail.com');
    assert.equal(res.status, 'sent');
    assert.equal(res.transportUsed, 'smtp');
  } finally {
    globalThis.fetch = originalFetch;
    (nodemailer as any).createTransport = origCreateTransport;
    restoreEnv();
  }
});

test('EmailService never relays emails cross-origin to Vercel when unconfigured', async () => {
  const restoreEnv = snapshotMailEnv();
  const originalFetch = globalThis.fetch;
  let fetchCalled = false;

  try {
    delete process.env.RESEND_API_KEY;
    delete process.env.RESEND_KEY;
    delete process.env.VITE_RESEND_API_KEY;
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_URL;
    delete process.env.GMAIL_USER;

    globalThis.fetch = (async () => {
      fetchCalled = true;
      return new Response('{}', { status: 200 });
    }) as any;

    const res = await emailService.enqueueAndSend({
      userId: null,
      recipientEmail: 'bob@example.com',
      templateName: 'email_verification',
      subject: 'Verify your TrueSpend email address',
      payload: { displayName: 'Bob', token: 'tok-bob' },
      skipOutboxDb: true,
    });

    assert.equal(fetchCalled, false);
    assert.equal(res.status, 'queued_no_api_key');
    assert.equal(res.errorCode, 'NO_EMAIL_PROVIDER');
    assert.ok(formatEmailDeliveryWarning('NO_EMAIL_PROVIDER', 'bob@example.com').includes('bob@example.com'));
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv();
  }
});

test('parseSmtpConfig infers free SMTP host automatically from EMAIL_USER/SMTP_USER domain without SMTP_HOST', () => {
  const gmailAlias = parseSmtpConfig({
    EMAIL_USER: 'free.sender@gmail.com',
    EMAIL_PASS: '16char-app-pass',
  } as any);
  assert.deepEqual(gmailAlias, {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    user: 'free.sender@gmail.com',
    pass: '16char-app-pass',
    providerLabel: 'smtp.gmail.com',
  });

  const outlookAlias = parseSmtpConfig({
    SMTP_USER: 'free.sender@outlook.com',
    SMTP_PASS: 'outlook-pass',
  } as any);
  assert.deepEqual(outlookAlias, {
    host: 'smtp-mail.outlook.com',
    port: 587,
    secure: false,
    user: 'free.sender@outlook.com',
    pass: 'outlook-pass',
    providerLabel: 'smtp-mail.outlook.com',
  });
});

test('EmailService prioritizes Gmail App Password over Resend sandbox and formats From cleanly', async () => {
  const restoreEnv = snapshotMailEnv();
  const originalFetch = globalThis.fetch;
  const origCreateTransport = nodemailer.createTransport;
  const smtpCalls: any[] = [];
  let resendCalled = false;

  try {
    process.env.GMAIL_USER = 'my.truespend.sender@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'qwer tyui opas dfgh';
    process.env.RESEND_API_KEY = 're_sandbox_key';
    process.env.EMAIL_FROM = 'TrueSpend <onboarding@resend.dev>';

    globalThis.fetch = (async () => {
      resendCalled = true;
      return new Response('{}', { status: 403 });
    }) as any;

    (nodemailer as any).createTransport = () => ({
      sendMail: async (mail: any) => {
        smtpCalls.push(mail);
        return { messageId: 'gmail-msg-1', response: '250 2.0.0 OK' };
      },
    });

    const result = await emailService.enqueueAndSend({
      userId: null,
      recipientEmail: 'frank.ctl35@gmail.com',
      templateName: 'email_verification',
      subject: 'Verify your TrueSpend email address',
      payload: { displayName: 'Frank', token: 'verify-token-999' },
      skipOutboxDb: true,
    });

    assert.equal(resendCalled, false);
    assert.equal(smtpCalls.length, 1);
    assert.equal(smtpCalls[0].from, 'TrueSpend Security <my.truespend.sender@gmail.com>');
    assert.equal(smtpCalls[0].to, 'frank.ctl35@gmail.com');
    assert.equal(result.status, 'sent');
    assert.equal(result.transportUsed, 'smtp');
    assert.equal(result.fromUsed, 'TrueSpend Security <my.truespend.sender@gmail.com>');
  } finally {
    globalThis.fetch = originalFetch;
    (nodemailer as any).createTransport = origCreateTransport;
    restoreEnv();
  }
});

test('EmailService renders responsive, theme-matched HTML templates with dark-mode adaptation', () => {
  const defaultHtml = emailService.renderHtml('email_verification', {
    displayName: 'Frank',
    token: 'TS-998877',
  });

  // Matches Swiss Alabaster defaults + Midnight Obsidian dark mode media query
  assert.ok(defaultHtml.includes('#f8fafc'));
  assert.ok(defaultHtml.includes('#4f46e5'));
  assert.ok(defaultHtml.includes('#0d9488'));
  assert.ok(defaultHtml.includes('@media (prefers-color-scheme: dark)'));
  assert.ok(defaultHtml.includes('@media only screen and (max-width: 560px)'));
  assert.ok(defaultHtml.includes('@media only screen and (max-width: 480px)'));
  assert.ok(defaultHtml.includes('TS-998877'));
  assert.ok(defaultHtml.includes('Spex Security Guardian'));

  // Supports all TrueSpend themes (e.g., Tokyo Night, Vintage Ledger)
  const vintageHtml = emailService.renderHtml('password_reset', {
    displayName: 'Frank',
    token: 'RESET-123',
    theme: 'vintage',
  });
  const vintagePalette = resolveEmailThemePalette('vintage');
  assert.ok(vintageHtml.includes(vintagePalette.canvas));
  assert.ok(vintageHtml.includes(vintagePalette.accent));

  const tokyoHtml = emailService.renderHtml('new_signin_alert', {
    displayName: 'Frank',
    deviceLabel: 'Chrome on macOS',
    theme: 'tokyo-night',
  });
  assert.ok(tokyoHtml.includes('#0a0d17'));
  assert.ok(tokyoHtml.includes('#06b6d4'));
  assert.ok(tokyoHtml.includes('color-scheme" content="dark"'));
});


