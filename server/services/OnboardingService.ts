import { eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  users,
  wallets,
  transactions,
  categoryBudgets,
  subscriptions,
  goals,
} from '../../src/db/schema.js';
import { normalizeExperienceTier } from '../../src/lib/entitlements.js';
import { invalidateAuthUserCache } from '../../src/middleware/auth.js';
import type { OnboardingChecklistItem, OnboardingState } from '../../src/types/index.js';

export interface OpeningAccountInput {
  name: string;
  type: 'Bank' | 'Cash' | 'Savings';
  openingBalance: number;
  isMain?: boolean;
  currency?: string;
}

export class OnboardingService {
  private parseStepsJson(raw?: string | null): string[] {
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }

  async getOnboardingState(userId: string): Promise<OnboardingState> {
    const [userRows, walletCnt, txCnt, budgetCnt, subCnt, goalCnt] = await Promise.all([
      db.select().from(users).where(eq(users.id, userId)).limit(1),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(wallets)
        .where(eq(wallets.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(transactions)
        .where(eq(transactions.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(categoryBudgets)
        .where(eq(categoryBudgets.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(subscriptions)
        .where(eq(subscriptions.userId, userId)),
      db
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(goals)
        .where(eq(goals.userId, userId)),
    ]);

    if (userRows.length === 0) {
      throw new Error('User not found.');
    }

    const user = userRows[0];
    const stepsCompleted = this.parseStepsJson(user.onboardingStepsJson);
    const hasWallets = Number(walletCnt[0]?.count || 0) > 0;
    const hasTx = Number(txCnt[0]?.count || 0) > 0;
    const hasBudgets = Number(budgetCnt[0]?.count || 0) > 0;
    const hasSubscriptions = Number(subCnt[0]?.count || 0) > 0;
    const hasGoals = Number(goalCnt[0]?.count || 0) > 0;

    const checklist: OnboardingChecklistItem[] = [
      {
        id: 'verify_email',
        label: 'Verify your email address',
        description: 'Confirms your identity for password recovery and account alerts.',
        completed: Boolean(user.emailVerifiedAt),
        actionType: 'verify_email',
      },
      {
        id: 'choose_experience',
        label: 'Choose Basic or Advanced experience',
        description: `Currently using the ${normalizeExperienceTier(user.experienceTier)} workspace (switch free anytime).`,
        completed: stepsCompleted.includes('choose_experience') || Boolean(user.onboardingCompletedAt),
        targetTab: 'settings',
        actionType: 'choose_experience',
      },
      {
        id: 'create_wallet',
        label: 'Add your main account & opening balance',
        description: 'Set your starting Bank, Cash, or Savings balances accurately.',
        completed: hasWallets,
        targetTab: 'accounts',
        actionType: 'create_wallet',
      },
      {
        id: 'log_transaction',
        label: 'Record your first real transaction',
        description: 'Log an everyday expense, income deposit, or transfer.',
        completed: hasTx,
        targetTab: 'transactions',
        actionType: 'log_transaction',
      },
      {
        id: 'create_budget',
        label: 'Set up your first budget or apply a starter template',
        description: 'Track monthly limits by category.',
        completed: hasBudgets,
        targetTab: 'budgets',
        actionType: 'create_budget',
      },
      {
        id: 'add_subscription',
        label: 'Add a recurring bill or subscription (optional)',
        description: 'Surface upcoming renewals on your cash flow calendar.',
        completed: hasSubscriptions || stepsCompleted.includes('skip_subscriptions'),
        targetTab: 'subscriptions',
        actionType: 'add_subscription',
      },
      {
        id: 'create_goal',
        label: 'Set your first savings goal (optional)',
        description: 'Give an emergency reserve or milestone a measurable target.',
        completed: hasGoals || stepsCompleted.includes('skip_goals'),
        targetTab: 'goals',
        actionType: 'create_goal',
      },
    ];

    const completedCount = checklist.filter((c) => c.completed).length;
    const totalCount = checklist.length;

    return {
      onboardingVersion: user.onboardingVersion ?? 1,
      onboardingStartedAt: user.onboardingStartedAt
        ? new Date(user.onboardingStartedAt).toISOString()
        : null,
      onboardingCompletedAt: user.onboardingCompletedAt
        ? new Date(user.onboardingCompletedAt).toISOString()
        : null,
      onboardingDismissedAt: user.onboardingDismissedAt
        ? new Date(user.onboardingDismissedAt).toISOString()
        : null,
      shouldShowWizard: !user.onboardingCompletedAt,
      shouldShowChecklist:
        Boolean(user.onboardingCompletedAt) &&
        !user.onboardingDismissedAt &&
        completedCount < totalCount,
      stepsCompleted,
      checklist,
      completedCount,
      totalCount,
    };
  }

  async updateOnboardingState(
    userId: string,
    payload: {
      action?: 'start' | 'save_step' | 'complete' | 'dismiss' | 'relaunch';
      stepId?: string;
      experienceTier?: string;
      displayName?: string;
      baseCurrency?: string;
      countryCode?: string;
      timezone?: string;
      locale?: string;
      payday?: number;
      salary?: number;
      emergencyBuffer?: number;
    }
  ) {
    const existingRows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    if (existingRows.length === 0) throw new Error('User not found.');
    const user = existingRows[0];

    const steps = new Set(this.parseStepsJson(user.onboardingStepsJson));
    if (payload.stepId) {
      steps.add(payload.stepId);
    }

    const now = new Date();
    const updates: Record<string, any> = {
      onboardingStepsJson: JSON.stringify(Array.from(steps)),
    };

    if (!user.onboardingStartedAt) {
      updates.onboardingStartedAt = now;
    }

    if (payload.action === 'complete') {
      updates.onboardingCompletedAt = now;
    } else if (payload.action === 'dismiss') {
      updates.onboardingDismissedAt = now;
    } else if (payload.action === 'relaunch') {
      updates.onboardingCompletedAt = null;
      updates.onboardingDismissedAt = null;
    }

    if (payload.experienceTier) {
      updates.experienceTier = normalizeExperienceTier(payload.experienceTier);
      steps.add('choose_experience');
      updates.onboardingStepsJson = JSON.stringify(Array.from(steps));
    }
    if (payload.displayName !== undefined && payload.displayName.trim()) {
      updates.displayName = payload.displayName.trim().slice(0, 80);
    }
    if (payload.baseCurrency !== undefined && payload.baseCurrency.trim()) {
      updates.baseCurrency = payload.baseCurrency.trim().toUpperCase().slice(0, 8);
    }
    if (payload.countryCode !== undefined && payload.countryCode.trim()) {
      updates.countryCode = payload.countryCode.trim().toUpperCase().slice(0, 4);
    }
    if (payload.timezone !== undefined && payload.timezone.trim()) {
      updates.timezone = payload.timezone.trim().slice(0, 64);
    }
    if (payload.locale !== undefined && payload.locale.trim()) {
      updates.locale = payload.locale.trim().slice(0, 12);
    }
    if (payload.payday !== undefined && Number.isFinite(Number(payload.payday))) {
      updates.payday = Math.max(1, Math.min(31, Math.round(Number(payload.payday))));
    }
    if (payload.salary !== undefined && Number.isFinite(Number(payload.salary))) {
      updates.salary = String(Math.max(0, Number(payload.salary)));
    }
    if (payload.emergencyBuffer !== undefined && Number.isFinite(Number(payload.emergencyBuffer))) {
      updates.emergencyBuffer = String(Math.max(0, Number(payload.emergencyBuffer)));
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
    invalidateAuthUserCache(userId);
    return await this.getOnboardingState(userId);
  }

  /**
   * Step 5 account setup: creates initial Bank / Cash / Savings accounts using opening balances.
   * Never creates fake Income transactions for opening balances.
   */
  async setupOpeningAccounts(userId: string, accounts: OpeningAccountInput[]) {
    if (!Array.isArray(accounts) || accounts.length === 0) {
      throw new Error('Add at least one account to continue setup.');
    }

    const sanitized = accounts
      .map((a) => ({
        name: (a.name || '').trim().slice(0, 64),
        type: (['Bank', 'Cash', 'Savings'].includes(a.type) ? a.type : 'Bank') as
          | 'Bank'
          | 'Cash'
          | 'Savings',
        openingBalance: Number.isFinite(Number(a.openingBalance))
          ? Number(a.openingBalance)
          : 0,
        isMain: Boolean(a.isMain),
        currency: (a.currency || 'MAD').trim().toUpperCase().slice(0, 8),
      }))
      .filter((a) => a.name.length > 0);

    if (sanitized.length === 0) {
      throw new Error('Please provide valid account names.');
    }

    return await db.transaction(async (txDb) => {
      const existing = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
      const existingByName = new Map(existing.map((w) => [w.name.toLowerCase(), w]));
      const hasMainAlready = existing.some((w) => w.isMain);

      let mainAssigned = hasMainAlready;
      const results = [];

      for (let i = 0; i < sanitized.length; i++) {
        const item = sanitized[i];
        const existingMatch = existingByName.get(item.name.toLowerCase());
        const shouldBeMain = !mainAssigned && (item.isMain || (i === 0 && item.type === 'Bank'));
        if (shouldBeMain) mainAssigned = true;

        if (existingMatch) {
          const [updated] = await txDb
            .update(wallets)
            .set({
              initialBalance: String(item.openingBalance),
              currentBalance: String(item.openingBalance),
              currency: item.currency,
              updatedAt: new Date(),
            })
            .where(eq(wallets.id, existingMatch.id))
            .returning();
          results.push(updated);
        } else {
          const [created] = await txDb
            .insert(wallets)
            .values({
              userId,
              name: item.name,
              type: item.type,
              accountSubtype: item.type === 'Bank' ? 'Checking' : item.type,
              currency: item.currency,
              isMain: shouldBeMain,
              initialBalance: String(item.openingBalance),
              currentBalance: String(item.openingBalance),
            })
            .returning();
          results.push(created);
        }
      }

      return { accounts: results };
    });
  }
}

export const onboardingService = new OnboardingService();
