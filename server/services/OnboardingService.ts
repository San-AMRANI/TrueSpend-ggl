import { and, eq, inArray, isNotNull, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  users,
  wallets,
  transactions,
  categoryBudgets,
  subscriptions,
  goals,
  payrolls,
} from '../../src/db/schema.js';
import { normalizeExperienceTier } from '../../src/lib/entitlements.js';
import { getCurrentFinancialMonth } from '../../src/lib/financialMonth.js';
import {
  computeOnboardingPeriodDates,
  validateOnboardingSetup,
  type EmploymentType,
  type FinancialCycleMode,
  type OnboardingStartingPoint,
} from '../../src/lib/onboardingPeriod.js';
import { coreAuditService } from './CoreAuditService.js';
import type { OnboardingChecklistItem, OnboardingState } from '../../src/types/index.js';

export interface OpeningAccountInput {
  name: string;
  type: 'Bank' | 'Cash' | 'Savings';
  openingBalance: number;
  isMain?: boolean;
  currency?: string;
}

export interface SetupFinancialPeriodInput {
  employmentType: EmploymentType;
  financialCycleMode: FinancialCycleMode;
  startingPoint: OnboardingStartingPoint;
  paydayDay: number;
  salary: number;
  periodStartDate?: string;
  nextPaydayDate?: string;
  emergencyBuffer?: number;
  targetWalletId?: string | null;
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
    const [userRows, userWallets, txCnt, budgetCnt, subCnt, goalCnt, userPayrolls] =
      await Promise.all([
        db.select().from(users).where(eq(users.id, userId)).limit(1),
        db.select().from(wallets).where(eq(wallets.userId, userId)),
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
        db.select().from(payrolls).where(eq(payrolls.userId, userId)),
      ]);

    if (userRows.length === 0) {
      throw new Error('User not found.');
    }

    const user = userRows[0];
    const stepsCompleted = this.parseStepsJson(user.onboardingStepsJson);
    const hasWallets = userWallets.length > 0;
    const hasTx = Number(txCnt[0]?.count || 0) > 0;
    const hasBudgets = Number(budgetCnt[0]?.count || 0) > 0;
    const hasSubscriptions = Number(subCnt[0]?.count || 0) > 0;
    const hasGoals = Number(goalCnt[0]?.count || 0) > 0;
    const currentFm = getCurrentFinancialMonth(userPayrolls);
    const hasActivePeriod = Boolean(currentFm);
    const hasPayrollSetup =
      stepsCompleted.includes('employment_payroll') ||
      (userPayrolls.length > 0 && (user.employmentType === 'non_employee' || Number(user.salary || 0) > 0));

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
        id: 'configure_payroll',
        label: 'Configure employment & payday cycle',
        description:
          user.employmentType === 'non_employee'
            ? `Non-employee monthly anchor on day ${user.payday ?? 1}.`
            : `Employee salary cycle anchored to day ${user.payday ?? 25} of each month.`,
        completed: hasPayrollSetup,
        targetTab: 'calendar',
        actionType: 'configure_payroll',
      },
      {
        id: 'define_period',
        label: 'Define your active financial period',
        description: currentFm
          ? `Active period covers ${currentFm.start.toISOString().slice(0, 10)} → ${currentFm.end.toISOString().slice(0, 10)}.`
          : 'Sets exact cycle boundaries for Safe-to-Spend, budgets, and daily allowance.',
        completed: hasActivePeriod,
        targetTab: 'calendar',
        actionType: 'define_period',
      },
      {
        id: 'create_wallet',
        label: 'Add your Bank & Cash accounts with current balances',
        description: 'Set your exact current Bank, Cash, or Savings balances.',
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
        description: 'Track cycle limits by category.',
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

    const employmentType: EmploymentType =
      user.employmentType === 'non_employee' ? 'non_employee' : 'employee';
    const financialCycleMode: FinancialCycleMode =
      user.financialCycleMode === 'calendar_month' || user.financialCycleMode === 'custom_period'
        ? user.financialCycleMode
        : 'payday_to_payday';
    const startingPoint: OnboardingStartingPoint =
      user.onboardingStartingPoint === 'first_day' ? 'first_day' : 'mid_cycle';

    return {
      onboardingVersion: user.onboardingVersion ?? 2,
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
      profileSnapshot: {
        employmentType,
        financialCycleMode,
        startingPoint,
        payday: user.payday ?? 25,
        salary: Number(user.salary || 0),
        emergencyBuffer: Number(user.emergencyBuffer || 0),
        periodStartDate:
          user.periodStartDate ||
          (currentFm ? currentFm.start.toISOString().slice(0, 10) : null),
        nextPaydayDate:
          user.nextPaydayDate ||
          (currentFm
            ? new Date(currentFm.endPayroll.scheduledFor).toISOString().slice(0, 10)
            : null),
        hasActivePeriod,
        hasWallets,
        accounts: userWallets
          .filter((w) => w.type === 'Bank' || w.type === 'Cash' || w.type === 'Savings')
          .map((w) => ({
            id: w.id,
            name: w.name,
            type: w.type as 'Bank' | 'Cash' | 'Savings',
            openingBalance: Number(w.initialBalance || 0),
            isMain: Boolean(w.isMain),
          })),
      },
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
      employmentType?: EmploymentType;
      financialCycleMode?: FinancialCycleMode;
      onboardingStartingPoint?: OnboardingStartingPoint;
      periodStartDate?: string | null;
      nextPaydayDate?: string | null;
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
      onboardingVersion: 2,
      onboardingStepsJson: JSON.stringify(Array.from(steps)),
    };

    if (!user.onboardingStartedAt) {
      updates.onboardingStartedAt = now;
    }

    if (payload.action === 'complete') {
      const [userWallets, userPayrolls] = await Promise.all([
        db.select().from(wallets).where(eq(wallets.userId, userId)),
        db.select().from(payrolls).where(eq(payrolls.userId, userId)),
      ]);
      const currentFm = getCurrentFinancialMonth(userPayrolls);
      if (!currentFm || userWallets.length === 0) {
        throw new Error(
          'Please complete your mandatory payday, financial period, and account balance setup before finishing.'
        );
      }
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
    if (payload.employmentType === 'employee' || payload.employmentType === 'non_employee') {
      updates.employmentType = payload.employmentType;
    }
    if (
      payload.financialCycleMode === 'payday_to_payday' ||
      payload.financialCycleMode === 'calendar_month' ||
      payload.financialCycleMode === 'custom_period'
    ) {
      updates.financialCycleMode = payload.financialCycleMode;
    }
    if (
      payload.onboardingStartingPoint === 'first_day' ||
      payload.onboardingStartingPoint === 'mid_cycle'
    ) {
      updates.onboardingStartingPoint = payload.onboardingStartingPoint;
    }
    if (payload.periodStartDate !== undefined) {
      updates.periodStartDate = payload.periodStartDate;
    }
    if (payload.nextPaydayDate !== undefined) {
      updates.nextPaydayDate = payload.nextPaydayDate;
    }

    await db.update(users).set(updates).where(eq(users.id, userId));
    return await this.getOnboardingState(userId);
  }

  /**
   * Mandatory Financial Period & Payroll Configuration step.
   * Saves user's employment status, starting point (Day 1 vs Mid-Cycle), payday, salary,
   * and defines the exact start & closing payroll boundaries in `payrolls` so
   * Safe-to-Spend, Daily Allowance, Budgets, and Forecast work immediately without fake income tx.
   */
  async setupFinancialPeriod(userId: string, input: SetupFinancialPeriodInput) {
    const employmentType: EmploymentType =
      input.employmentType === 'non_employee' ? 'non_employee' : 'employee';
    const financialCycleMode: FinancialCycleMode =
      input.financialCycleMode === 'calendar_month' || input.financialCycleMode === 'custom_period'
        ? input.financialCycleMode
        : 'payday_to_payday';
    const startingPoint: OnboardingStartingPoint =
      input.startingPoint === 'first_day' ? 'first_day' : 'mid_cycle';
    const paydayDay = Math.max(1, Math.min(31, Math.round(Number(input.paydayDay || 25))));
    const salary = Number(input.salary ?? 0);
    const emergencyBuffer =
      input.emergencyBuffer !== undefined ? Math.max(0, Number(input.emergencyBuffer) || 0) : undefined;

    const computed = computeOnboardingPeriodDates({
      employmentType,
      financialCycleMode,
      startingPoint,
      paydayDay,
      customStartDate: input.periodStartDate,
      customNextPaydayDate: input.nextPaydayDate,
    });

    const periodStartDate =
      input.periodStartDate && financialCycleMode === 'custom_period'
        ? input.periodStartDate
        : input.periodStartDate && /^\d{4}-\d{2}-\d{2}$/.test(input.periodStartDate)
        ? input.periodStartDate
        : computed.periodStartDate;
    const nextPaydayDate =
      input.nextPaydayDate && financialCycleMode === 'custom_period'
        ? input.nextPaydayDate
        : input.nextPaydayDate && /^\d{4}-\d{2}-\d{2}$/.test(input.nextPaydayDate)
        ? input.nextPaydayDate
        : computed.nextPaydayDate;

    const validation = validateOnboardingSetup({
      employmentType,
      financialCycleMode,
      startingPoint,
      paydayDay: computed.effectivePaydayDay,
      salary,
      periodStartDate,
      nextPaydayDate,
      emergencyBuffer,
    });

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid financial period configuration.');
    }

    const startScheduledFor = new Date(`${periodStartDate}T12:00:00.000Z`);
    const nextScheduledFor = new Date(`${nextPaydayDate}T12:00:00.000Z`);

    const result = await db.transaction(async (txDb) => {
      const existingUsers = await txDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (existingUsers.length === 0) throw new Error('User not found.');
      const user = existingUsers[0];

      const steps = new Set(this.parseStepsJson(user.onboardingStepsJson));
      steps.add('employment_payroll');
      steps.add('financial_period');

      const userUpdates: Record<string, any> = {
        onboardingVersion: 2,
        onboardingStartedAt: user.onboardingStartedAt || new Date(),
        onboardingStepsJson: JSON.stringify(Array.from(steps)),
        employmentType,
        financialCycleMode,
        onboardingStartingPoint: startingPoint,
        payday: computed.effectivePaydayDay,
        salary: String(Math.max(0, salary)),
        periodStartDate,
        nextPaydayDate,
      };
      if (emergencyBuffer !== undefined) {
        userUpdates.emergencyBuffer = String(emergencyBuffer);
      }

      await txDb.update(users).set(userUpdates).where(eq(users.id, userId));

      const userWallets = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
      const targetWallet =
        (input.targetWalletId && userWallets.find((w) => w.id === input.targetWalletId)) ||
        userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
        userWallets.find((w) => w.type === 'Bank') ||
        userWallets.find((w) => w.isMain) ||
        userWallets[0] ||
        null;

      const existingPayrolls = await txDb.select().from(payrolls).where(eq(payrolls.userId, userId));
      const linkedTxRows = await txDb
        .select({ payrollId: transactions.payrollId })
        .from(transactions)
        .where(and(eq(transactions.userId, userId), isNotNull(transactions.payrollId)));
      const protectedPayrollIds = new Set(
        linkedTxRows.map((r) => r.payrollId).filter((id): id is string => Boolean(id))
      );

      // Remove unposted onboarding/expected boundary payrolls without linked transactions
      // so re-configuring the period cleanly updates the boundaries without duplicates.
      const removableIds = existingPayrolls
        .filter((p) => !protectedPayrollIds.has(p.id))
        .map((p) => p.id);
      if (removableIds.length > 0) {
        await txDb
          .delete(payrolls)
          .where(and(eq(payrolls.userId, userId), inArray(payrolls.id, removableIds)));
      }

      const [startPayroll] = await txDb
        .insert(payrolls)
        .values({
          userId,
          walletId: targetWallet?.id || null,
          scheduledFor: startScheduledFor,
          amount: String(Math.max(0, salary)),
          status: 'confirmed',
          confirmedAmount: String(Math.max(0, salary)),
          confirmedAt: startScheduledFor,
          varianceAmount: '0',
          varianceNotes:
            startingPoint === 'first_day'
              ? 'Active cycle start (Day 1 onboarding)'
              : 'Active cycle start (Mid-cycle onboarding)',
        })
        .returning();

      const [nextPayroll] = await txDb
        .insert(payrolls)
        .values({
          userId,
          walletId: targetWallet?.id || null,
          scheduledFor: nextScheduledFor,
          amount: String(Math.max(0, salary)),
          status: 'expected',
          varianceAmount: '0',
          varianceNotes:
            employmentType === 'employee'
              ? 'Next scheduled payday (Onboarding)'
              : 'Next cycle reset anchor (Onboarding)',
        })
        .returning();

      const allUserPayrolls = await txDb
        .select()
        .from(payrolls)
        .where(eq(payrolls.userId, userId));

      return {
        startPayroll,
        nextPayroll,
        payrolls: allUserPayrolls,
      };
    });

    await coreAuditService
      .syncAndGetCommitmentOccurrences(userId, 90, { forceSync: true })
      .catch(() => undefined);

    const onboarding = await this.getOnboardingState(userId);
    return {
      ...result,
      periodStartDate,
      nextPaydayDate,
      onboarding,
    };
  }

  /**
   * Account setup step: creates initial Bank / Cash / Savings accounts using exact current balances.
   * Never creates fake Income transactions for opening balances.
   */
  async setupOpeningAccounts(
    userId: string,
    accounts: OpeningAccountInput[],
    options?: { emergencyBuffer?: number }
  ) {
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

    const savedAccounts = await db.transaction(async (txDb) => {
      const existing = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
      const txCountRow = await txDb
        .select({ count: sql<number>`COUNT(*)::int` })
        .from(transactions)
        .where(eq(transactions.userId, userId));
      const hasTransactions = Number(txCountRow[0]?.count || 0) > 0;

      const requestedNamesLower = new Set(sanitized.map((s) => s.name.toLowerCase()));

      // If WalletService.getWallets() auto-seeded empty default "Bank Account" / "Cash Wallet"
      // before Step 5 ran, repurpose the empty "Bank Account" for the primary incoming Bank wallet
      // and clean up unreferenced auto-seeded empty wallets so no ghost 0.00 accounts appear.
      const existingByName = new Map(existing.map((w) => [w.name.toLowerCase(), w]));
      const consumedExistingIds = new Set<string>();

      const emptyDefaultBank = existing.find(
        (w) =>
          w.name.toLowerCase() === 'bank account' &&
          !requestedNamesLower.has('bank account') &&
          Number(w.initialBalance || 0) === 0 &&
          Number(w.currentBalance || 0) === 0 &&
          !hasTransactions
      );

      const hasMainOutsideAutoDefault = existing.some(
        (w) => w.isMain && w.id !== emptyDefaultBank?.id
      );

      let mainAssigned = hasMainOutsideAutoDefault;
      const results = [];
      let repurposedBankDone = false;

      for (let i = 0; i < sanitized.length; i++) {
        const item = sanitized[i];
        let existingMatch = existingByName.get(item.name.toLowerCase());
        if (!existingMatch && emptyDefaultBank && !repurposedBankDone && item.type === 'Bank') {
          existingMatch = emptyDefaultBank;
          repurposedBankDone = true;
        }

        const shouldBeMain = !mainAssigned && (item.isMain || (i === 0 && item.type === 'Bank'));
        if (shouldBeMain) mainAssigned = true;

        if (existingMatch) {
          consumedExistingIds.add(existingMatch.id);
          const updateFields: Record<string, any> = {
            name: item.name,
            type: item.type,
            accountSubtype: item.type === 'Bank' ? 'Checking' : item.type,
            initialBalance: String(item.openingBalance),
            currency: item.currency,
            updatedAt: new Date(),
          };
          if (shouldBeMain) {
            updateFields.isMain = true;
          }
          if (!hasTransactions) {
            updateFields.currentBalance = String(item.openingBalance);
          }
          const [updated] = await txDb
            .update(wallets)
            .set(updateFields)
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

      if (!hasTransactions) {
        for (const w of existing) {
          if (consumedExistingIds.has(w.id)) continue;
          const isAutoDefaultName =
            w.name.toLowerCase() === 'bank account' || w.name.toLowerCase() === 'cash wallet';
          if (
            isAutoDefaultName &&
            Number(w.initialBalance || 0) === 0 &&
            Number(w.currentBalance || 0) === 0
          ) {
            await txDb
              .delete(wallets)
              .where(and(eq(wallets.id, w.id), eq(wallets.userId, userId)))
              .catch(() => undefined);
          }
        }
      }

      const mainDepositWallet =
        results.find((w) => w.type === 'Bank' && w.isMain) ||
        results.find((w) => w.type === 'Bank') ||
        results[0];

      if (mainDepositWallet) {
        await txDb
          .update(payrolls)
          .set({ walletId: mainDepositWallet.id })
          .where(and(eq(payrolls.userId, userId), sql`${payrolls.walletId} IS NULL`));
      }

      const existingUserRows = await txDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (existingUserRows.length > 0) {
        const userRow = existingUserRows[0];
        const steps = new Set(this.parseStepsJson(userRow.onboardingStepsJson));
        steps.add('setup_accounts');
        const userUpdates: Record<string, any> = {
          onboardingStepsJson: JSON.stringify(Array.from(steps)),
        };
        if (
          options?.emergencyBuffer !== undefined &&
          Number.isFinite(Number(options.emergencyBuffer))
        ) {
          userUpdates.emergencyBuffer = String(Math.max(0, Number(options.emergencyBuffer)));
        }
        await txDb.update(users).set(userUpdates).where(eq(users.id, userId));
      }

      return results;
    });

    const onboarding = await this.getOnboardingState(userId);
    return { accounts: savedAccounts, onboarding };
  }
}

export const onboardingService = new OnboardingService();
