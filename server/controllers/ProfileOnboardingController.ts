import { Request, Response } from 'express';
import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  users,
  wallets,
  transactions,
  categoryBudgets,
  debts,
  goals,
  subscriptions,
  financialContexts,
  stockPositions,
  financialRules,
  statementImportBatches,
  authSessions,
  stockOrders,
  payrolls,
  financialReviewItems,
  journalEntries,
  exchangeRates,
  userAuditLogs,
} from '../../src/db/schema.js';
import { AuthRequest } from '../../src/middleware/auth.js';
import { authService, deriveDeviceLabel, REFRESH_COOKIE_NAME } from '../services/AuthService.js';
import { onboardingService } from '../services/OnboardingService.js';
import { templateService } from '../services/TemplateService.js';
import { settingsService } from '../services/SettingsService.js';
import { emailService } from '../services/EmailService.js';
import { verifyPasswordAsync, isProductionEnv } from '../services/SecurityCrypto.js';
import { getClientIp } from '../middleware/rateLimit.js';
import { normalizeExperienceTier, getAdvancedOnlySummaryList } from '../../src/lib/entitlements.js';

export class ProfileOnboardingController {
  async updateProfile(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId!;
      const body = req.body || {};

      const updates: Record<string, any> = {};
      if (body.displayName !== undefined && String(body.displayName).trim()) {
        updates.displayName = String(body.displayName).trim().slice(0, 80);
      }
      if (body.locale !== undefined && String(body.locale).trim()) {
        updates.locale = String(body.locale).trim().slice(0, 12);
      }
      if (body.countryCode !== undefined && String(body.countryCode).trim()) {
        updates.countryCode = String(body.countryCode).trim().toUpperCase().slice(0, 4);
      }
      if (body.timezone !== undefined && String(body.timezone).trim()) {
        updates.timezone = String(body.timezone).trim().slice(0, 64);
      }
      if (body.baseCurrency !== undefined && String(body.baseCurrency).trim()) {
        updates.baseCurrency = String(body.baseCurrency).trim().toUpperCase().slice(0, 8);
      }
      if (body.avatarColor !== undefined && String(body.avatarColor).trim()) {
        updates.avatarColor = String(body.avatarColor).trim().slice(0, 24);
      }
      if (body.payday !== undefined && Number.isFinite(Number(body.payday))) {
        updates.payday = Math.max(1, Math.min(31, Math.round(Number(body.payday))));
      }
      if (body.salary !== undefined && Number.isFinite(Number(body.salary))) {
        updates.salary = String(Math.max(0, Number(body.salary)));
      }
      if (body.emergencyBuffer !== undefined && Number.isFinite(Number(body.emergencyBuffer))) {
        updates.emergencyBuffer = String(Math.max(0, Number(body.emergencyBuffer)));
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, userId))
        .returning();

      res.json({ user: authService.formatAuthUser(updated) });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update profile' });
    }
  }

  async switchExperience(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId!;
      const requestedTier = req.body?.experienceTier;
      if (requestedTier !== 'basic' && requestedTier !== 'advanced') {
        return res.status(400).json({
          error: 'experienceTier must be either "basic" or "advanced".',
          code: 'INVALID_TIER',
        });
      }

      const targetTier = normalizeExperienceTier(requestedTier);
      const previousTier = normalizeExperienceTier(req.authUser?.experienceTier);

      const [positionsCount, contextsCount, rulesCount, batchesCount] = await Promise.all([
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(stockPositions)
          .where(eq(stockPositions.userId, userId)),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(financialContexts)
          .where(eq(financialContexts.userId, userId)),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(financialRules)
          .where(eq(financialRules.userId, userId)),
        db
          .select({ count: sql<number>`COUNT(*)::int` })
          .from(statementImportBatches)
          .where(eq(statementImportBatches.userId, userId)),
      ]);

      const [updated] = await db
        .update(users)
        .set({ experienceTier: targetTier })
        .where(eq(users.id, userId))
        .returning();

      await authService.logSecurityEvent({
        userId,
        eventType: 'EXPERIENCE_TIER_CHANGED',
        outcome: 'success',
        ipAddress: getClientIp(req),
        deviceSummary: deriveDeviceLabel(req.headers['user-agent'] as string),
        metadata: { from: previousTier, to: targetTier },
      });

      res.json({
        user: authService.formatAuthUser(updated),
        experienceTier: targetTier,
        preservedDataSummary: {
          investmentsCount: Number(positionsCount[0]?.count || 0),
          contextsCount: Number(contextsCount[0]?.count || 0),
          rulesCount: Number(rulesCount[0]?.count || 0),
          statementBatchesCount: Number(batchesCount[0]?.count || 0),
        },
        advancedOnlyFeatures: getAdvancedOnlySummaryList(),
        message:
          targetTier === 'basic'
            ? 'Switched to the Basic experience (free). All existing financial data remains preserved safely.'
            : 'Switched to the Advanced experience (free). All advanced modules are unlocked.',
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update experience tier' });
    }
  }

  async exportPersonalData(req: AuthRequest, res: Response) {
    try {
      const userId = req.userId!;
      const bundle = await settingsService.exportPersonalDataJson(userId);
      const format = String(req.query?.download || '') === '1';
      if (format) {
        const filename = `truespend-personal-export-${new Date().toISOString().slice(0, 10)}.json`;
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      }
      res.json(bundle);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to export personal data' });
    }
  }

  async deleteAccount(req: AuthRequest, res: Response) {
    try {
      const user = req.authUser;
      const password = String(req.body?.currentPassword || '');
      const confirmation = String(req.body?.confirmation || '').trim().toUpperCase();

      if (confirmation !== 'DELETE') {
        return res.status(400).json({
          error: 'Please type DELETE to permanently confirm account deletion.',
          code: 'CONFIRMATION_REQUIRED',
        });
      }

      if (user.passwordHash) {
        const valid = await verifyPasswordAsync(password, user.passwordHash);
        if (!valid) {
          return res.status(401).json({
            error: 'Current password is incorrect.',
            code: 'INVALID_CURRENT_PASSWORD',
          });
        }
      }

      const recipientEmail = user.email;
      const now = new Date();

      await db.transaction(async (txDb) => {
        await txDb.delete(authSessions).where(eq(authSessions.userId, user.id));
        await txDb.delete(financialReviewItems).where(eq(financialReviewItems.userId, user.id));
        await txDb.delete(stockOrders).where(eq(stockOrders.userId, user.id));
        await txDb.delete(stockPositions).where(eq(stockPositions.userId, user.id));
        await txDb.delete(transactions).where(eq(transactions.userId, user.id));
        await txDb.delete(journalEntries).where(eq(journalEntries.userId, user.id));
        await txDb.delete(categoryBudgets).where(eq(categoryBudgets.userId, user.id));
        await txDb.delete(payrolls).where(eq(payrolls.userId, user.id));
        await txDb.delete(debts).where(eq(debts.userId, user.id));
        await txDb.delete(goals).where(eq(goals.userId, user.id));
        await txDb.delete(subscriptions).where(eq(subscriptions.userId, user.id));
        await txDb.delete(financialContexts).where(eq(financialContexts.userId, user.id));
        await txDb.delete(exchangeRates).where(eq(exchangeRates.userId, user.id));
        await txDb.delete(wallets).where(eq(wallets.userId, user.id));

        await txDb
          .update(users)
          .set({
            status: 'deleted',
            deletedAt: now,
            deletionRequestedAt: now,
            email: `deleted-${user.id}@deleted.truespend.local`,
            pendingEmail: null,
            username: null,
            displayName: 'Deleted Account',
            passwordHash: null,
            googleDriveToken: null,
            googleDriveTokenExpiry: null,
            automatedDriveBackups: 0,
            notes: null,
            permissions: null,
          })
          .where(eq(users.id, user.id));

        await txDb.insert(userAuditLogs).values({
          actorId: null,
          actorName: 'Self-Service Privacy Control',
          targetUserId: null,
          targetUserName: `anonymized:${user.id.slice(0, 8)}`,
          action: 'ACCOUNT_SELF_DELETED',
          details: 'Account and financial ledger removed on user self-deletion request.',
        });
      });

      await emailService
        .enqueueAndSend({
          userId: null,
          recipientEmail,
          templateName: 'account_deleted',
          subject: 'Your TrueSpend account has been deleted',
          payload: {},
        })
        .catch(() => undefined);

      res.clearCookie(REFRESH_COOKIE_NAME, {
        httpOnly: true,
        secure: isProductionEnv() || Boolean(req.secure),
        sameSite: 'lax',
        path: '/api/auth',
      });

      res.json({
        deleted: true,
        message: 'Your account and financial records have been removed and active sessions closed.',
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to delete account' });
    }
  }

  async getOnboarding(req: AuthRequest, res: Response) {
    try {
      const state = await onboardingService.getOnboardingState(req.userId!);
      res.json(state);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load onboarding state' });
    }
  }

  async updateOnboarding(req: AuthRequest, res: Response) {
    try {
      const state = await onboardingService.updateOnboardingState(req.userId!, req.body || {});
      const [userRow] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
      res.json({
        onboarding: state,
        user: userRow ? authService.formatAuthUser(userRow) : undefined,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to update onboarding state' });
    }
  }

  async setupAccounts(req: AuthRequest, res: Response) {
    try {
      const result = await onboardingService.setupOpeningAccounts(
        req.userId!,
        req.body?.accounts || [],
        {
          emergencyBuffer:
            req.body?.emergencyBuffer !== undefined
              ? Number(req.body.emergencyBuffer)
              : undefined,
        }
      );
      const [userRow] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
      res.json({
        ...result,
        user: userRow ? authService.formatAuthUser(userRow) : undefined,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to configure accounts' });
    }
  }

  async setupFinancialPeriod(req: AuthRequest, res: Response) {
    try {
      const result = await onboardingService.setupFinancialPeriod(req.userId!, req.body || {});
      const [userRow] = await db.select().from(users).where(eq(users.id, req.userId!)).limit(1);
      res.json({
        ...result,
        user: userRow ? authService.formatAuthUser(userRow) : undefined,
      });
    } catch (error: any) {
      res.status(400).json({ error: error.message || 'Failed to configure financial period' });
    }
  }

  async listTemplates(req: AuthRequest, res: Response) {
    try {
      const tier = normalizeExperienceTier(req.experienceTier || req.authUser?.experienceTier);
      const templates = await templateService.listTemplates(req.userId!, tier);
      res.json({ templates, currentTier: tier });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to load starter templates' });
    }
  }

  async previewTemplate(req: AuthRequest, res: Response) {
    try {
      const tier = normalizeExperienceTier(req.experienceTier || req.authUser?.experienceTier);
      const template = await templateService.previewTemplate(req.params.id, req.userId!, tier);
      res.json({ template });
    } catch (error: any) {
      res.status(404).json({ error: error.message || 'Template not found' });
    }
  }

  async applyTemplate(req: AuthRequest, res: Response) {
    try {
      const tier = normalizeExperienceTier(req.experienceTier || req.authUser?.experienceTier);
      const result = await templateService.applyTemplate(req.userId!, tier, req.params.id);
      res.json(result);
    } catch (error: any) {
      const status = error?.status || 400;
      res.status(status).json({
        error: error.message || 'Failed to apply template',
        ...(error?.code ? { code: error.code } : {}),
      });
    }
  }
}

export const profileOnboardingController = new ProfileOnboardingController();
