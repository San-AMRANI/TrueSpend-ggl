import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { eq, and, desc, or, sql, isNull } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  users,
  authSessions,
  emailVerificationTokens,
  passwordResetTokens,
  accountSecurityEvents,
  invitations,
  invitationRedemptions,
} from '../../src/db/schema.js';
import { resolveUserPermissions } from './UserManagementService.js';
import {
  getJwtSecret,
  getJwtKeyId,
  hashPasswordAsync,
  verifyPasswordAsync,
  needsPasswordRehash,
  validatePasswordStrength,
  generateOpaqueToken,
  hashOpaqueToken,
} from './SecurityCrypto.js';
import {
  checkLoginThrottle,
  recordLoginFailure,
  clearLoginFailures,
} from '../middleware/rateLimit.js';
import { emailService } from './EmailService.js';
import { normalizeExperienceTier } from '../../src/lib/entitlements.js';
import type {
  ExperienceTier,
  User,
  UserRole,
  UserStatus,
  AuthSessionInfo,
  AccountSecurityEventInfo,
} from '../../src/types/index.js';

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60; // 15 minutes
export const REFRESH_SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
export const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PASSWORD_RESET_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const REFRESH_COOKIE_NAME = 'truespend_refresh';

const DEFAULT_DUMMY_PASSWORD_HASH =
  'scrypt2$16384$8$1$00112233445566778899aabbccddeeff$00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff';

export class AuthError extends Error {
  status: number;
  code: string;
  extra?: Record<string, any>;

  constructor(message: string, status = 400, code = 'AUTH_ERROR', extra?: Record<string, any>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export interface RequestClientContext {
  ipAddress: string;
  userAgent: string;
  deviceLabel: string;
  isCapacitorNative: boolean;
}

export function deriveDeviceLabel(userAgent?: string | null): string {
  const ua = (userAgent || '').trim();
  if (!ua) return 'Unknown Device';
  if (/capacitor|android.*wv/i.test(ua)) return 'TrueSpend Android App';
  if (/iphone|ipad|ios/i.test(ua)) return 'iPhone / iPad';
  if (/android/i.test(ua)) return 'Android Browser';
  if (/edg\//i.test(ua)) return 'Microsoft Edge';
  if (/chrome\//i.test(ua) && !/edg\//i.test(ua)) return 'Chrome Browser';
  if (/firefox\//i.test(ua)) return 'Firefox Browser';
  if (/safari\//i.test(ua) && !/chrome\//i.test(ua)) return 'Safari Browser';
  return 'Web Browser';
}

export class AuthService {
  formatAuthUser(dbRow: typeof users.$inferSelect): User {
    const role = (dbRow.role || 'member') as UserRole;
    const isVerified = Boolean(dbRow.emailVerifiedAt) && dbRow.status !== 'pending_verification';

    return {
      id: dbRow.id,
      uid: dbRow.uid,
      username: dbRow.username || dbRow.email.split('@')[0] || 'user',
      displayName: dbRow.displayName || dbRow.username || dbRow.email.split('@')[0] || 'User',
      email: dbRow.email,
      pendingEmail: dbRow.pendingEmail || null,
      role,
      status: (dbRow.status || 'active') as UserStatus,
      workspaceMode: 'isolated',
      experienceTier: normalizeExperienceTier(dbRow.experienceTier),
      emailVerified: isVerified,
      emailVerifiedAt: dbRow.emailVerifiedAt ? new Date(dbRow.emailVerifiedAt).toISOString() : null,
      locale: dbRow.locale || 'en',
      countryCode: dbRow.countryCode || 'MA',
      timezone: dbRow.timezone || 'Africa/Casablanca',
      baseCurrency: dbRow.baseCurrency || 'MAD',
      payday: dbRow.payday ?? 25,
      salary: Number(dbRow.salary || 0),
      emergencyBuffer: Number(dbRow.emergencyBuffer || 0),
      onboardingVersion: dbRow.onboardingVersion ?? 1,
      onboardingStartedAt: dbRow.onboardingStartedAt
        ? new Date(dbRow.onboardingStartedAt).toISOString()
        : null,
      onboardingCompletedAt: dbRow.onboardingCompletedAt
        ? new Date(dbRow.onboardingCompletedAt).toISOString()
        : null,
      onboardingDismissedAt: dbRow.onboardingDismissedAt
        ? new Date(dbRow.onboardingDismissedAt).toISOString()
        : null,
      createdAt: dbRow.createdAt ? new Date(dbRow.createdAt).toISOString() : null,
      lastLoginAt: dbRow.lastLoginAt ? new Date(dbRow.lastLoginAt).toISOString() : null,
      deletionRequestedAt: dbRow.deletionRequestedAt
        ? new Date(dbRow.deletionRequestedAt).toISOString()
        : null,
      permissions: resolveUserPermissions(role, dbRow.permissions),
      avatarColor: dbRow.avatarColor || 'indigo',
      impersonatedBy: null,
    };
  }

  signAccessToken(user: typeof users.$inferSelect, sessionId: string): string {
    const role = (user.role || 'member') as UserRole;
    const experienceTier = normalizeExperienceTier(user.experienceTier);

    return jwt.sign(
      {
        userId: user.id,
        sessionId,
        role,
        experienceTier,
        tokenType: 'access',
        kid: getJwtKeyId(),
      },
      getJwtSecret(),
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );
  }

  async logSecurityEvent(params: {
    userId: string;
    eventType: string;
    outcome?: 'success' | 'failure' | 'blocked';
    ipAddress?: string | null;
    deviceSummary?: string | null;
    metadata?: Record<string, any>;
  }) {
    try {
      await db.insert(accountSecurityEvents).values({
        userId: params.userId,
        eventType: params.eventType,
        outcome: params.outcome || 'success',
        ipAddress: params.ipAddress || null,
        deviceSummary: params.deviceSummary || null,
        metadataJson: params.metadata ? JSON.stringify(params.metadata) : null,
      });
    } catch (err) {
      console.warn('[AuthService] Failed to log security event:', (err as any)?.message || err);
    }
  }

  private async issueSessionPair(
    user: typeof users.$inferSelect,
    ctx: RequestClientContext,
    existingFamilyId?: string
  ): Promise<{
    accessToken: string;
    refreshCookieValue: string;
    sessionId: string;
    familyId: string;
  }> {
    const rawSecret = generateOpaqueToken(32);
    const refreshTokenHash = hashOpaqueToken(rawSecret);
    const familyId = existingFamilyId || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + REFRESH_SESSION_TTL_MS);

    const [sessionRow] = await db
      .insert(authSessions)
      .values({
        userId: user.id,
        refreshTokenHash,
        familyId,
        deviceLabel: ctx.deviceLabel || 'Web Browser',
        userAgent: ctx.userAgent || null,
        ipAddress: ctx.ipAddress || null,
        expiresAt,
      })
      .returning();

    const accessToken = this.signAccessToken(user, sessionRow.id);
    const refreshCookieValue = `${sessionRow.id}.${rawSecret}`;

    return {
      accessToken,
      refreshCookieValue,
      sessionId: sessionRow.id,
      familyId,
    };
  }

  async validateInvitation(rawCode?: string | null): Promise<{
    valid: boolean;
    campaign?: string;
    reason?: string;
  }> {
    const code = (rawCode || '').trim();
    if (!code) {
      return { valid: false, reason: 'No invitation code supplied.' };
    }
    const tokenHash = hashOpaqueToken(code);
    const rows = await db
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) {
      return { valid: false, reason: 'Invitation code is invalid.' };
    }

    const inv = rows[0];
    if (inv.revokedAt) {
      return { valid: false, reason: 'This invitation code has been revoked.' };
    }
    if (inv.expiresAt && new Date(inv.expiresAt).getTime() <= Date.now()) {
      return { valid: false, reason: 'This invitation code has expired.' };
    }
    if (inv.useCount >= inv.maxUses) {
      return { valid: false, reason: 'This invitation code has reached its usage limit.' };
    }

    return { valid: true, campaign: inv.campaign };
  }

  async createInvitation(
    actorId: string,
    payload: { campaign?: string; maxUses?: number; expiresInDays?: number }
  ) {
    const rawCode = `TS-${generateOpaqueToken(12)}`;
    const tokenHash = hashOpaqueToken(rawCode);
    const maxUses = Math.max(1, Math.min(500, Number(payload.maxUses || 1)));
    const expiresAt = payload.expiresInDays
      ? new Date(Date.now() + Math.max(1, Number(payload.expiresInDays)) * 86400000)
      : new Date(Date.now() + 30 * 86400000);

    const [created] = await db
      .insert(invitations)
      .values({
        tokenHash,
        createdByUserId: actorId,
        campaign: (payload.campaign || 'beta_invite').trim().slice(0, 64),
        maxUses,
        expiresAt,
      })
      .returning();

    return {
      id: created.id,
      inviteCode: rawCode,
      campaign: created.campaign,
      maxUses: created.maxUses,
      expiresAt: created.expiresAt?.toISOString() || null,
    };
  }

  async register(
    payload: {
      email?: string;
      username?: string;
      displayName?: string;
      password?: string;
      experienceTier?: string;
      inviteCode?: string;
      locale?: string;
      countryCode?: string;
      timezone?: string;
      baseCurrency?: string;
    },
    ctx: RequestClientContext
  ) {
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    const cleanUsernameRaw = (payload.username || cleanEmail.split('@')[0] || '').trim();
    const cleanUsername = cleanUsernameRaw.replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 32);
    const cleanDisplayName = (payload.displayName || cleanUsername || 'TrueSpend Member').trim();
    const password = payload.password || '';
    const experienceTier: ExperienceTier = normalizeExperienceTier(payload.experienceTier);

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new AuthError('Please enter a valid email address.', 400, 'INVALID_EMAIL');
    }
    if (!cleanUsername || cleanUsername.length < 2) {
      throw new AuthError('Username must be at least 2 valid characters.', 400, 'INVALID_USERNAME');
    }

    const strength = validatePasswordStrength(password, {
      email: cleanEmail,
      username: cleanUsername,
    });
    if (!strength.valid) {
      throw new AuthError(
        strength.error || 'Password does not meet security requirements.',
        400,
        'WEAK_PASSWORD'
      );
    }

    // Check active conflict (never fail differently on duplicate email to avoid enumeration)
    const conflicts = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`LOWER(${users.email}) = ${cleanEmail}`,
            sql`LOWER(${users.username}) = ${cleanUsername.toLowerCase()}`
          ),
          sql`${users.status} NOT IN ('legacy_hidden', 'deleted')`
        )
      );

    if (conflicts.length > 0) {
      // Equalize scrypt work against email enumeration timing
      await verifyPasswordAsync(password, DEFAULT_DUMMY_PASSWORD_HASH);
      const emailConflict = conflicts.find((c) => c.email.toLowerCase() === cleanEmail);
      if (emailConflict) {
        await this.logSecurityEvent({
          userId: emailConflict.id,
          eventType: 'DUPLICATE_REGISTRATION_ATTEMPT',
          outcome: 'blocked',
          ipAddress: ctx.ipAddress,
          deviceSummary: ctx.deviceLabel,
        });
      }
      return {
        registrationAccepted: true,
        requiresVerification: true,
        message:
          'Account setup initiated. Please check your email for verification instructions.',
      };
    }

    const passwordHash = await hashPasswordAsync(password);
    const rawVerifyToken = generateOpaqueToken(32);
    const verifyTokenHash = hashOpaqueToken(rawVerifyToken);
    const verifyExpiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    const now = new Date();
    const trimmedInvite = (payload.inviteCode || '').trim();

    let invitationAccepted = false;
    let invitationWarning: string | undefined;

    const createdUser = await db.transaction(async (txDb) => {
      const [inserted] = await txDb
        .insert(users)
        .values({
          uid: `user_${crypto.randomUUID()}`,
          username: cleanUsername,
          displayName: cleanDisplayName,
          email: cleanEmail,
          passwordHash,
          passwordUpdatedAt: now,
          role: 'member',
          status: 'pending_verification',
          workspaceMode: 'isolated',
          experienceTier,
          onboardingVersion: 1,
          locale: (payload.locale || 'en').trim().slice(0, 12),
          countryCode: (payload.countryCode || 'MA').trim().toUpperCase().slice(0, 4),
          timezone: (payload.timezone || 'Africa/Casablanca').trim().slice(0, 64),
          baseCurrency: (payload.baseCurrency || 'MAD').trim().toUpperCase().slice(0, 8),
          avatarColor: 'indigo',
        })
        .returning();

      await txDb.insert(emailVerificationTokens).values({
        userId: inserted.id,
        targetEmail: cleanEmail,
        tokenHash: verifyTokenHash,
        expiresAt: verifyExpiresAt,
      });

      if (trimmedInvite) {
        const invHash = hashOpaqueToken(trimmedInvite);
        const invRows = await txDb
          .select()
          .from(invitations)
          .where(eq(invitations.tokenHash, invHash))
          .limit(1);

        if (invRows.length > 0) {
          const inv = invRows[0];
          const notExpired = !inv.expiresAt || new Date(inv.expiresAt).getTime() > Date.now();
          if (!inv.revokedAt && notExpired && inv.useCount < inv.maxUses) {
            const [updatedInv] = await txDb
              .update(invitations)
              .set({ useCount: sql`${invitations.useCount} + 1` })
              .where(
                and(
                  eq(invitations.id, inv.id),
                  isNull(invitations.revokedAt),
                  sql`${invitations.useCount} < ${invitations.maxUses}`
                )
              )
              .returning();

            if (updatedInv) {
              await txDb.insert(invitationRedemptions).values({
                invitationId: inv.id,
                redeemedByUserId: inserted.id,
              });
              invitationAccepted = true;
            }
          }
        }
        if (!invitationAccepted) {
          invitationWarning =
            'The optional invitation code was invalid or expired, so your account was registered without an invitation credit.';
        }
      }

      return inserted;
    });

    await this.logSecurityEvent({
      userId: createdUser.id,
      eventType: 'ACCOUNT_REGISTERED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
      metadata: {
        experienceTier,
        invitationAccepted,
      },
    });

    await emailService.enqueueAndSend({
      userId: createdUser.id,
      recipientEmail: cleanEmail,
      templateName: 'email_verification',
      subject: 'Verify your TrueSpend email address',
      payload: {
        displayName: cleanDisplayName,
        token: rawVerifyToken,
      },
    });

    const isDevPreview = process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY;

    return {
      registrationAccepted: true,
      requiresVerification: true,
      message:
        'Account setup initiated. Please check your email for verification instructions.',
      invitationAccepted,
      ...(invitationWarning ? { invitationWarning } : {}),
      ...(isDevPreview ? { devVerificationToken: rawVerifyToken } : {}),
    };
  }

  async login(
    usernameOrEmail: string | undefined,
    password: string | undefined,
    ctx: RequestClientContext
  ) {
    const identifier = (usernameOrEmail || '').trim();
    const rawPassword = password || '';

    if (!identifier || !rawPassword) {
      throw new AuthError('Email or username and password are required.', 400, 'MISSING_CREDENTIALS');
    }

    const throttle = checkLoginThrottle(identifier, ctx.ipAddress);
    if (!throttle.allowed) {
      throw new AuthError(
        `Too many failed sign-in attempts. Please try again in ${throttle.retryAfterSeconds} seconds.`,
        429,
        'LOGIN_THROTTLED',
        { retryAfterSeconds: throttle.retryAfterSeconds }
      );
    }

    const matchedRows = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`LOWER(${users.email}) = ${identifier.toLowerCase()}`,
            sql`LOWER(${users.username}) = ${identifier.toLowerCase()}`
          ),
          sql`${users.status} NOT IN ('legacy_hidden', 'deleted')`
        )
      )
      .limit(1);

    const userRow = matchedRows[0];
    if (!userRow) {
      await verifyPasswordAsync(rawPassword, DEFAULT_DUMMY_PASSWORD_HASH);
      recordLoginFailure(identifier, ctx.ipAddress);
      throw new AuthError('Invalid email/username or password.', 401, 'INVALID_CREDENTIALS');
    }

    const passwordMatches = await verifyPasswordAsync(rawPassword, userRow.passwordHash);
    if (!passwordMatches) {
      recordLoginFailure(identifier, ctx.ipAddress);
      await this.logSecurityEvent({
        userId: userRow.id,
        eventType: 'LOGIN_FAILED',
        outcome: 'failure',
        ipAddress: ctx.ipAddress,
        deviceSummary: ctx.deviceLabel,
      });
      throw new AuthError('Invalid email/username or password.', 401, 'INVALID_CREDENTIALS');
    }

    if (userRow.status === 'suspended') {
      throw new AuthError(
        'Your account has been suspended. Contact support if you need assistance.',
        403,
        'ACCOUNT_SUSPENDED'
      );
    }

    if (userRow.status === 'deletion_pending') {
      throw new AuthError(
        'Your account deletion request is pending processing.',
        403,
        'ACCOUNT_DELETION_PENDING'
      );
    }

    if (!userRow.emailVerifiedAt || userRow.status === 'pending_verification') {
      throw new AuthError(
        'Please verify your email address before signing in. You can resend the verification link below.',
        403,
        'EMAIL_VERIFICATION_REQUIRED',
        { email: userRow.email, requiresVerification: true }
      );
    }

    clearLoginFailures(identifier, ctx.ipAddress);

    // Opportunistic transparent hash upgrade on legacy scrypt$ accounts
    const userUpdates: Record<string, any> = {
      lastLoginAt: new Date(),
      workspaceMode: 'isolated',
    };
    if (needsPasswordRehash(userRow.passwordHash)) {
      userUpdates.passwordHash = await hashPasswordAsync(rawPassword);
      userUpdates.passwordUpdatedAt = new Date();
    }

    const [updatedUser] = await db
      .update(users)
      .set(userUpdates)
      .where(eq(users.id, userRow.id))
      .returning();

    const pair = await this.issueSessionPair(updatedUser, ctx);

    await this.logSecurityEvent({
      userId: updatedUser.id,
      eventType: 'LOGIN_SUCCEEDED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
      metadata: { sessionId: pair.sessionId },
    });

    if (updatedUser.email && updatedUser.email.includes('@')) {
      await emailService.enqueueAndSend({
        userId: updatedUser.id,
        recipientEmail: updatedUser.email,
        templateName: 'new_signin_alert',
        subject: 'New sign-in to your TrueSpend account',
        payload: {
          displayName: updatedUser.displayName || updatedUser.username,
          deviceLabel: ctx.deviceLabel,
        },
      });
    }

    return {
      token: pair.accessToken,
      accessToken: pair.accessToken,
      refreshCookieValue: pair.refreshCookieValue,
      ...(ctx.isCapacitorNative ? { refreshToken: pair.refreshCookieValue } : {}),
      sessionId: pair.sessionId,
      user: this.formatAuthUser(updatedUser),
    };
  }

  async refreshSession(rawCookieOrToken: string | undefined, ctx: RequestClientContext) {
    const raw = (rawCookieOrToken || '').trim();
    const dotIndex = raw.indexOf('.');
    if (!raw || dotIndex <= 0) {
      throw new AuthError('Missing or malformed refresh session.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const sessionId = raw.slice(0, dotIndex);
    const rawSecret = raw.slice(dotIndex + 1);
    if (!rawSecret || !/^[0-9a-f-]{36}$/i.test(sessionId)) {
      throw new AuthError('Invalid refresh session format.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const existingRows = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .limit(1);

    if (existingRows.length === 0) {
      throw new AuthError('Refresh session not found.', 401, 'INVALID_REFRESH_TOKEN');
    }

    const session = existingRows[0];
    const incomingHash = hashOpaqueToken(rawSecret);

    // Check constant-time hash match
    const storedBuf = Buffer.from(session.refreshTokenHash, 'utf8');
    const incomingBuf = Buffer.from(incomingHash, 'utf8');
    const hashesMatch =
      storedBuf.length === incomingBuf.length && crypto.timingSafeEqual(storedBuf, incomingBuf);

    if (!hashesMatch) {
      throw new AuthError('Invalid refresh credentials.', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Reuse detection: token already rotated or revoked -> revoke ENTIRE family!
    if (session.revokedAt || session.replacedBySessionId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(and(eq(authSessions.familyId, session.familyId), isNull(authSessions.revokedAt)));

      await this.logSecurityEvent({
        userId: session.userId,
        eventType: 'REFRESH_REUSE_DETECTED',
        outcome: 'blocked',
        ipAddress: ctx.ipAddress,
        deviceSummary: ctx.deviceLabel,
        metadata: { sessionId: session.id, familyId: session.familyId },
      });

      throw new AuthError(
        'Session reuse detected. All related sessions have been signed out for security.',
        401,
        'REFRESH_TOKEN_REUSED'
      );
    }

    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(eq(authSessions.id, session.id));
      throw new AuthError('Session expired. Please sign in again.', 401, 'REFRESH_TOKEN_EXPIRED');
    }

    const userRows = await db.select().from(users).where(eq(users.id, session.userId)).limit(1);
    if (userRows.length === 0) {
      throw new AuthError('Account not found.', 401, 'ACCOUNT_NOT_FOUND');
    }
    const userRow = userRows[0];
    if (
      userRow.status === 'deleted' ||
      userRow.status === 'legacy_hidden' ||
      userRow.status === 'suspended' ||
      userRow.status === 'deletion_pending'
    ) {
      throw new AuthError('Account is not active.', 403, 'ACCOUNT_INACTIVE');
    }

    const newRawSecret = generateOpaqueToken(32);
    const newHash = hashOpaqueToken(newRawSecret);
    const newExpiresAt = new Date(Date.now() + REFRESH_SESSION_TTL_MS);

    const rotatedSession = await db.transaction(async (txDb) => {
      const [created] = await txDb
        .insert(authSessions)
        .values({
          userId: userRow.id,
          refreshTokenHash: newHash,
          familyId: session.familyId,
          deviceLabel: ctx.deviceLabel || session.deviceLabel || 'Web Browser',
          userAgent: ctx.userAgent || session.userAgent,
          ipAddress: ctx.ipAddress || session.ipAddress,
          expiresAt: newExpiresAt,
        })
        .returning();

      const updatedOld = await txDb
        .update(authSessions)
        .set({
          revokedAt: new Date(),
          lastUsedAt: new Date(),
          replacedBySessionId: created.id,
        })
        .where(and(eq(authSessions.id, session.id), isNull(authSessions.revokedAt)))
        .returning();

      if (updatedOld.length === 0) {
        // Concurrent race condition -> revoke entire family
        await txDb
          .update(authSessions)
          .set({ revokedAt: new Date() })
          .where(eq(authSessions.familyId, session.familyId));
        throw new AuthError(
          'Concurrent session refresh conflict. Please sign in again.',
          401,
          'REFRESH_TOKEN_REUSED'
        );
      }

      return created;
    });

    const accessToken = this.signAccessToken(userRow, rotatedSession.id);
    const refreshCookieValue = `${rotatedSession.id}.${newRawSecret}`;

    return {
      token: accessToken,
      accessToken,
      refreshCookieValue,
      ...(ctx.isCapacitorNative ? { refreshToken: refreshCookieValue } : {}),
      sessionId: rotatedSession.id,
      user: this.formatAuthUser(userRow),
    };
  }

  async logout(rawCookieOrToken: string | undefined, sessionIdHint?: string | null, userId?: string) {
    const raw = (rawCookieOrToken || '').trim();
    const dotIndex = raw.indexOf('.');
    const parsedSessionId = dotIndex > 0 ? raw.slice(0, dotIndex) : null;
    const targetSessionId =
      (parsedSessionId && /^[0-9a-f-]{36}$/i.test(parsedSessionId) && parsedSessionId) ||
      sessionIdHint;

    if (targetSessionId) {
      await db
        .update(authSessions)
        .set({ revokedAt: new Date() })
        .where(
          userId
            ? and(eq(authSessions.id, targetSessionId), eq(authSessions.userId, userId))
            : eq(authSessions.id, targetSessionId)
        );
    }
    return { success: true };
  }

  async logoutAll(userId: string, ctx: RequestClientContext) {
    await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));

    await this.logSecurityEvent({
      userId,
      eventType: 'LOGOUT_ALL_SESSIONS',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
    });

    return { success: true };
  }

  async verifyEmail(rawToken: string, ctx: RequestClientContext) {
    const token = (rawToken || '').trim();
    if (!token) {
      throw new AuthError('Verification token is required.', 400, 'INVALID_TOKEN');
    }

    const tokenHash = hashOpaqueToken(token);
    const rows = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) {
      throw new AuthError('Invalid or unrecognized verification link.', 400, 'INVALID_TOKEN');
    }

    const record = rows[0];
    if (record.usedAt) {
      throw new AuthError('This verification link has already been used.', 400, 'TOKEN_ALREADY_USED');
    }
    if (new Date(record.expiresAt).getTime() <= Date.now()) {
      throw new AuthError(
        'This verification link has expired. Please request a new one.',
        400,
        'TOKEN_EXPIRED'
      );
    }

    const userRows = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
    if (userRows.length === 0) {
      throw new AuthError('Account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }
    const targetUser = userRows[0];

    const now = new Date();
    const isEmailChange =
      Boolean(targetUser.pendingEmail) &&
      targetUser.pendingEmail?.toLowerCase() === record.targetEmail.toLowerCase();

    const updatedUser = await db.transaction(async (txDb) => {
      await txDb
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(
          and(
            eq(emailVerificationTokens.userId, targetUser.id),
            isNull(emailVerificationTokens.usedAt)
          )
        );

      const updateFields: Record<string, any> = {
        emailVerifiedAt: now,
      };
      if (isEmailChange) {
        updateFields.email = record.targetEmail.toLowerCase();
        updateFields.pendingEmail = null;
      } else if (targetUser.status === 'pending_verification') {
        updateFields.status = 'active';
      }

      const [u] = await txDb
        .update(users)
        .set(updateFields)
        .where(eq(users.id, targetUser.id))
        .returning();
      return u;
    });

    await this.logSecurityEvent({
      userId: updatedUser.id,
      eventType: isEmailChange ? 'EMAIL_CHANGE_COMPLETED' : 'EMAIL_VERIFIED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
      metadata: { email: updatedUser.email },
    });

    const pair = await this.issueSessionPair(updatedUser, ctx);

    return {
      verified: true,
      isEmailChange,
      token: pair.accessToken,
      accessToken: pair.accessToken,
      refreshCookieValue: pair.refreshCookieValue,
      ...(ctx.isCapacitorNative ? { refreshToken: pair.refreshCookieValue } : {}),
      user: this.formatAuthUser(updatedUser),
    };
  }

  async resendVerification(email: string, ctx: RequestClientContext) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const genericResponse = {
      sent: true,
      message: 'If an eligible account matches that email, a fresh verification link has been sent.',
    };

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return genericResponse;
    }

    const found = await db
      .select()
      .from(users)
      .where(
        and(
          or(
            sql`LOWER(${users.email}) = ${cleanEmail}`,
            sql`LOWER(${users.pendingEmail}) = ${cleanEmail}`
          ),
          sql`${users.status} NOT IN ('legacy_hidden', 'deleted', 'suspended')`
        )
      )
      .limit(1);

    if (found.length === 0) {
      const fallbackToken = generateOpaqueToken(16);
      const delivery = await emailService.enqueueAndSend({
        userId: null,
        recipientEmail: cleanEmail,
        templateName: 'email_verification',
        subject: 'Verify your TrueSpend email address',
        payload: {
          displayName: cleanEmail.split('@')[0] || 'there',
          token: fallbackToken,
        },
      });
      return {
        ...genericResponse,
        deliveryStatus: delivery.status,
      };
    }

    const userRow = found[0];
    const isPendingChange = userRow.pendingEmail?.toLowerCase() === cleanEmail;

    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await db.transaction(async (txDb) => {
      await txDb
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, userRow.id),
            isNull(emailVerificationTokens.usedAt)
          )
        );

      await txDb.insert(emailVerificationTokens).values({
        userId: userRow.id,
        targetEmail: cleanEmail,
        tokenHash,
        expiresAt,
      });
    });

    const delivery = await emailService.enqueueAndSend({
      userId: userRow.id,
      recipientEmail: cleanEmail,
      templateName: isPendingChange ? 'email_change_verification' : 'email_verification',
      subject: isPendingChange
        ? 'Confirm your new TrueSpend email'
        : 'Verify your TrueSpend email address',
      payload: {
        displayName: userRow.displayName || userRow.username,
        token: rawToken,
      },
    });

    await this.logSecurityEvent({
      userId: userRow.id,
      eventType: 'VERIFICATION_EMAIL_RESENT',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
    });

    const isDevPreview = process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY;
    return {
      ...genericResponse,
      deliveryStatus: delivery.status,
      ...(isDevPreview ? { devVerificationToken: rawToken } : {}),
    };
  }

  async forgotPassword(email: string, ctx: RequestClientContext) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const genericResponse = {
      sent: true,
      message: 'If an account exists for that email address, a password reset link has been sent.',
    };

    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return genericResponse;
    }

    const found = await db
      .select()
      .from(users)
      .where(
        and(
          sql`LOWER(${users.email}) = ${cleanEmail}`,
          sql`${users.status} NOT IN ('legacy_hidden', 'deleted', 'suspended')`
        )
      )
      .limit(1);

    if (found.length === 0) {
      const fallbackToken = generateOpaqueToken(16);
      const delivery = await emailService.enqueueAndSend({
        userId: null,
        recipientEmail: cleanEmail,
        templateName: 'password_reset',
        subject: 'Reset your TrueSpend password',
        payload: {
          displayName: cleanEmail.split('@')[0] || 'there',
          token: fallbackToken,
        },
      });
      return {
        ...genericResponse,
        deliveryStatus: delivery.status,
      };
    }

    const userRow = found[0];
    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

    await db.transaction(async (txDb) => {
      await txDb
        .update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(and(eq(passwordResetTokens.userId, userRow.id), isNull(passwordResetTokens.usedAt)));

      await txDb.insert(passwordResetTokens).values({
        userId: userRow.id,
        tokenHash,
        expiresAt,
      });
    });

    const delivery = await emailService.enqueueAndSend({
      userId: userRow.id,
      recipientEmail: userRow.email,
      templateName: 'password_reset',
      subject: 'Reset your TrueSpend password',
      payload: {
        displayName: userRow.displayName || userRow.username,
        token: rawToken,
      },
    });

    await this.logSecurityEvent({
      userId: userRow.id,
      eventType: 'PASSWORD_RESET_REQUESTED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
    });

    const isDevPreview = process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY;
    return {
      ...genericResponse,
      deliveryStatus: delivery.status,
      ...(isDevPreview ? { devResetToken: rawToken } : {}),
    };
  }

  async resetPassword(token: string, newPassword: string, ctx: RequestClientContext) {
    const cleanToken = (token || '').trim();
    if (!cleanToken) {
      throw new AuthError('Reset token is required.', 400, 'INVALID_TOKEN');
    }

    const tokenHash = hashOpaqueToken(cleanToken);
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    if (rows.length === 0) {
      throw new AuthError('Invalid or expired password reset link.', 400, 'INVALID_TOKEN');
    }

    const resetRow = rows[0];
    if (resetRow.usedAt) {
      throw new AuthError('This password reset link has already been used.', 400, 'TOKEN_ALREADY_USED');
    }
    if (new Date(resetRow.expiresAt).getTime() <= Date.now()) {
      throw new AuthError('This password reset link has expired. Request a new one.', 400, 'TOKEN_EXPIRED');
    }

    const userRows = await db.select().from(users).where(eq(users.id, resetRow.userId)).limit(1);
    if (userRows.length === 0) {
      throw new AuthError('Account not found.', 404, 'ACCOUNT_NOT_FOUND');
    }
    const targetUser = userRows[0];

    const strength = validatePasswordStrength(newPassword, {
      email: targetUser.email,
      username: targetUser.username || undefined,
    });
    if (!strength.valid) {
      throw new AuthError(
        strength.error || 'New password does not meet security requirements.',
        400,
        'WEAK_PASSWORD'
      );
    }

    const newHash = await hashPasswordAsync(newPassword);
    const now = new Date();

    await db.transaction(async (txDb) => {
      await txDb
        .update(users)
        .set({
          passwordHash: newHash,
          passwordUpdatedAt: now,
          ...(targetUser.status === 'pending_verification' && !targetUser.emailVerifiedAt
            ? {}
            : {}),
        })
        .where(eq(users.id, targetUser.id));

      await txDb
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(and(eq(passwordResetTokens.userId, targetUser.id), isNull(passwordResetTokens.usedAt)));

      await txDb
        .update(authSessions)
        .set({ revokedAt: now })
        .where(and(eq(authSessions.userId, targetUser.id), isNull(authSessions.revokedAt)));
    });

    await this.logSecurityEvent({
      userId: targetUser.id,
      eventType: 'PASSWORD_RESET_COMPLETED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
    });

    await emailService.enqueueAndSend({
      userId: targetUser.id,
      recipientEmail: targetUser.email,
      templateName: 'password_changed',
      subject: 'Your TrueSpend password was updated',
      payload: { displayName: targetUser.displayName || targetUser.username },
    });

    return {
      reset: true,
      message: 'Password updated. All previous sessions have been signed out; please sign in.',
    };
  }

  async changePassword(
    user: typeof users.$inferSelect,
    currentPassword: string,
    newPassword: string,
    currentSessionId: string | null | undefined,
    ctx: RequestClientContext
  ) {
    if (!currentPassword || !newPassword) {
      throw new AuthError('Current password and new password are required.', 400, 'MISSING_FIELDS');
    }

    const matches = await verifyPasswordAsync(currentPassword, user.passwordHash);
    if (!matches) {
      await this.logSecurityEvent({
        userId: user.id,
        eventType: 'PASSWORD_CHANGE_FAILED',
        outcome: 'failure',
        ipAddress: ctx.ipAddress,
        deviceSummary: ctx.deviceLabel,
      });
      throw new AuthError('Current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }

    const strength = validatePasswordStrength(newPassword, {
      email: user.email,
      username: user.username || undefined,
    });
    if (!strength.valid) {
      throw new AuthError(
        strength.error || 'New password does not meet security requirements.',
        400,
        'WEAK_PASSWORD'
      );
    }

    const newHash = await hashPasswordAsync(newPassword);
    const now = new Date();

    await db.transaction(async (txDb) => {
      await txDb
        .update(users)
        .set({ passwordHash: newHash, passwordUpdatedAt: now })
        .where(eq(users.id, user.id));

      // Revoke all other sessions while preserving the active current session
      await txDb
        .update(authSessions)
        .set({ revokedAt: now })
        .where(
          currentSessionId
            ? and(
                eq(authSessions.userId, user.id),
                isNull(authSessions.revokedAt),
                sql`${authSessions.id} <> ${currentSessionId}`
              )
            : and(eq(authSessions.userId, user.id), isNull(authSessions.revokedAt))
        );
    });

    await this.logSecurityEvent({
      userId: user.id,
      eventType: 'PASSWORD_CHANGED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
    });

    await emailService.enqueueAndSend({
      userId: user.id,
      recipientEmail: user.email,
      templateName: 'password_changed',
      subject: 'Your TrueSpend password was changed',
      payload: { displayName: user.displayName || user.username },
    });

    return {
      changed: true,
      message: 'Password updated and other active sessions signed out.',
    };
  }

  async changeEmail(
    user: typeof users.$inferSelect,
    currentPassword: string,
    newEmail: string,
    ctx: RequestClientContext
  ) {
    const cleanNewEmail = (newEmail || '').trim().toLowerCase();
    if (!cleanNewEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanNewEmail)) {
      throw new AuthError('Please enter a valid new email address.', 400, 'INVALID_EMAIL');
    }
    if (cleanNewEmail === user.email.toLowerCase()) {
      throw new AuthError('This is already your current verified email address.', 400, 'SAME_EMAIL');
    }

    const matches = await verifyPasswordAsync(currentPassword, user.passwordHash);
    if (!matches) {
      throw new AuthError('Current password is incorrect.', 401, 'INVALID_CURRENT_PASSWORD');
    }

    const conflicts = await db
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          sql`LOWER(${users.email}) = ${cleanNewEmail}`,
          sql`${users.status} NOT IN ('legacy_hidden', 'deleted')`,
          sql`${users.id} <> ${user.id}`
        )
      )
      .limit(1);

    if (conflicts.length > 0) {
      throw new AuthError('That email address is unavailable.', 400, 'EMAIL_UNAVAILABLE');
    }

    const rawToken = generateOpaqueToken(32);
    const tokenHash = hashOpaqueToken(rawToken);
    const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);

    await db.transaction(async (txDb) => {
      await txDb
        .update(users)
        .set({ pendingEmail: cleanNewEmail })
        .where(eq(users.id, user.id));

      await txDb
        .update(emailVerificationTokens)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(emailVerificationTokens.userId, user.id),
            isNull(emailVerificationTokens.usedAt)
          )
        );

      await txDb.insert(emailVerificationTokens).values({
        userId: user.id,
        targetEmail: cleanNewEmail,
        tokenHash,
        expiresAt,
      });
    });

    await Promise.all([
      emailService.enqueueAndSend({
        userId: user.id,
        recipientEmail: cleanNewEmail,
        templateName: 'email_change_verification',
        subject: 'Confirm your new TrueSpend email address',
        payload: {
          displayName: user.displayName || user.username,
          token: rawToken,
        },
      }),
      emailService.enqueueAndSend({
        userId: user.id,
        recipientEmail: user.email,
        templateName: 'email_change_notice',
        subject: 'Notice of email change request on TrueSpend',
        payload: {
          displayName: user.displayName || user.username,
          pendingEmail: cleanNewEmail,
        },
      }),
    ]);

    await this.logSecurityEvent({
      userId: user.id,
      eventType: 'EMAIL_CHANGE_REQUESTED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
      metadata: { pendingEmail: cleanNewEmail },
    });

    const isDevPreview = process.env.NODE_ENV !== 'production' && !process.env.RESEND_API_KEY;
    return {
      pendingEmail: cleanNewEmail,
      message: 'Confirmation link sent to your new email address. Your current email stays active until confirmed.',
      ...(isDevPreview ? { devVerificationToken: rawToken } : {}),
    };
  }

  async listSessions(userId: string, currentSessionId?: string | null): Promise<AuthSessionInfo[]> {
    const rows = await db
      .select()
      .from(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          isNull(authSessions.revokedAt),
          sql`${authSessions.expiresAt} > NOW()`
        )
      )
      .orderBy(desc(authSessions.lastUsedAt));

    return rows.map((s) => ({
      id: s.id,
      deviceLabel: s.deviceLabel || 'Web Browser',
      userAgent: s.userAgent || null,
      ipAddress: s.ipAddress || null,
      createdAt: new Date(s.createdAt).toISOString(),
      lastUsedAt: new Date(s.lastUsedAt).toISOString(),
      expiresAt: new Date(s.expiresAt).toISOString(),
      isCurrent: Boolean(currentSessionId && s.id === currentSessionId),
    }));
  }

  async revokeSession(userId: string, sessionId: string, ctx: RequestClientContext) {
    const updated = await db
      .update(authSessions)
      .set({ revokedAt: new Date() })
      .where(and(eq(authSessions.id, sessionId), eq(authSessions.userId, userId)))
      .returning();

    if (updated.length === 0) {
      throw new AuthError('Session not found.', 404, 'SESSION_NOT_FOUND');
    }

    await this.logSecurityEvent({
      userId,
      eventType: 'SESSION_REVOKED',
      outcome: 'success',
      ipAddress: ctx.ipAddress,
      deviceSummary: ctx.deviceLabel,
      metadata: { revokedSessionId: sessionId },
    });

    return { revokedId: sessionId };
  }

  async listSecurityEvents(userId: string): Promise<AccountSecurityEventInfo[]> {
    const rows = await db
      .select()
      .from(accountSecurityEvents)
      .where(eq(accountSecurityEvents.userId, userId))
      .orderBy(desc(accountSecurityEvents.createdAt))
      .limit(30);

    return rows.map((e) => {
      let parsedMeta: Record<string, any> | null = null;
      if (e.metadataJson) {
        try {
          parsedMeta = JSON.parse(e.metadataJson);
        } catch {
          parsedMeta = null;
        }
      }
      return {
        id: e.id,
        eventType: e.eventType,
        outcome: e.outcome,
        ipAddress: e.ipAddress,
        deviceSummary: e.deviceSummary,
        metadata: parsedMeta,
        createdAt: new Date(e.createdAt).toISOString(),
      };
    });
  }
}

export const authService = new AuthService();
