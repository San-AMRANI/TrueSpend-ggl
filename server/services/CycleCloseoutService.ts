import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  cycleAutomationSettings,
  cycleCloseoutRuns,
  financialContexts,
  financialPositionSnapshots,
  goalContributionEvents,
  goals,
  users,
} from '../../src/db/schema.js';
import {
  computeCashRecoveryTimestamp,
  computeClosingSweepTimestamp,
  computeNextPayrollDate,
  computeYearlyAuditMetrics,
  planMonthlyPocketSweep,
  resolveClosingPeriodInfo,
  VALID_POCKET_SWEEP_MODES,
  type ClosingPeriodInfo,
  type MonthlyPocketSweepPlan,
  type PocketSweepMode,
} from '../../src/lib/cycleCloseout.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { coreAuditService } from './CoreAuditService.js';
import { PushService } from './PushService.js';
import { decryptSecret } from './SecurityCrypto.js';
import { settingsService } from './SettingsService.js';
import { transactionService } from './TransactionService.js';
import { walletService } from './WalletService.js';

const pushService = new PushService();

export interface CycleAutomationSettingsDTO {
  autoDepositPayroll?: boolean;
  sweepMode?: PocketSweepMode;
  targetSavingsWalletId?: string | null;
  targetGoalId?: string | null;
  autoRolloverBudgets?: boolean;
  autoScheduleNextPayroll?: boolean;
  autoYearlyCloseout?: boolean;
  yearlyDriveBackup?: boolean;
}

export interface MonthlyPrePayrollCloseoutResult {
  alreadyRan: boolean;
  existingRunId?: string;
  settings: Awaited<ReturnType<CycleCloseoutService['getSettings']>>;
  closingPeriodInfo: ClosingPeriodInfo;
  destinationWallet: any | null;
  plan: MonthlyPocketSweepPlan;
  sweepTransactionIds: string[];
}

const DEFAULT_SETTINGS = {
  autoDepositPayroll: true,
  sweepMode: 'bank_and_cash_recover' as PocketSweepMode,
  targetSavingsWalletId: null as string | null,
  targetGoalId: null as string | null,
  autoRolloverBudgets: true,
  autoScheduleNextPayroll: true,
  autoYearlyCloseout: true,
  yearlyDriveBackup: true,
};

const monthBoundsUtc = (date: Date) => ({
  start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
});

function serializeRunRow(row: typeof cycleCloseoutRuns.$inferSelect) {
  let summary: Record<string, any> = {};
  try {
    summary = row.summaryJson ? JSON.parse(row.summaryJson) : {};
  } catch {
    summary = {};
  }
  return {
    id: row.id,
    runType: row.runType as 'monthly' | 'yearly',
    cycleKey: row.cycleKey,
    payrollId: row.payrollId || null,
    triggerSource: row.triggerSource,
    status: row.status,
    sweepMode: row.sweepMode,
    sweptBankAmountMad: Number(row.sweptBankAmountMad || 0),
    sweptCashAmountMad: Number(row.sweptCashAmountMad || 0),
    totalSweptAmountMad: Number(row.totalSweptAmountMad || 0),
    recoveredCashAmountMad: Number(row.recoveredCashAmountMad || 0),
    salaryDepositedMad: Number(row.salaryDepositedMad || 0),
    destinationWalletId: row.destinationWalletId || null,
    budgetsRolledCount: Number(row.budgetsRolledCount || 0),
    nextPayrollId: row.nextPayrollId || null,
    snapshotId: row.snapshotId || null,
    summary,
    executedAt: row.executedAt instanceof Date ? row.executedAt.toISOString() : String(row.executedAt),
  };
}

export class CycleCloseoutService {
  async getSettings(userId: string) {
    const [existing] = await db
      .select()
      .from(cycleAutomationSettings)
      .where(eq(cycleAutomationSettings.userId, userId))
      .limit(1);

    if (!existing) {
      return { ...DEFAULT_SETTINGS };
    }

    const sweepMode = (VALID_POCKET_SWEEP_MODES as readonly string[]).includes(existing.sweepMode)
      ? (existing.sweepMode as PocketSweepMode)
      : DEFAULT_SETTINGS.sweepMode;

    return {
      autoDepositPayroll: Boolean(existing.autoDepositPayroll),
      sweepMode,
      targetSavingsWalletId: existing.targetSavingsWalletId || null,
      targetGoalId: existing.targetGoalId || null,
      autoRolloverBudgets: Boolean(existing.autoRolloverBudgets),
      autoScheduleNextPayroll: Boolean(existing.autoScheduleNextPayroll),
      autoYearlyCloseout: Boolean(existing.autoYearlyCloseout),
      yearlyDriveBackup: Boolean(existing.yearlyDriveBackup),
      updatedAt: existing.updatedAt instanceof Date ? existing.updatedAt.toISOString() : undefined,
    };
  }

  async updateSettings(userId: string, dto: CycleAutomationSettingsDTO) {
    const current = await this.getSettings(userId);

    const sweepMode: PocketSweepMode =
      dto.sweepMode !== undefined
        ? (VALID_POCKET_SWEEP_MODES as readonly string[]).includes(dto.sweepMode)
          ? dto.sweepMode
          : (() => {
              throw new Error('Invalid pocket sweep mode');
            })()
        : current.sweepMode;

    let targetSavingsWalletId =
      dto.targetSavingsWalletId !== undefined ? dto.targetSavingsWalletId || null : current.targetSavingsWalletId;
    if (targetSavingsWalletId) {
      const userWallets = await walletService.getWallets(userId);
      const matched = userWallets.find((w) => w.id === targetSavingsWalletId);
      if (!matched) {
        throw new Error('Selected target savings wallet was not found');
      }
      if (matched.accountSubtype === 'CreditCard' || matched.accountSubtype === 'Overdraft') {
        throw new Error('Credit or overdraft accounts cannot be used as a savings sweep destination');
      }
    }

    let targetGoalId =
      dto.targetGoalId !== undefined ? dto.targetGoalId || null : current.targetGoalId;
    if (targetGoalId) {
      const matchedGoal = await goalRepository.findByIdAndUserId(targetGoalId, userId);
      if (!matchedGoal) {
        throw new Error('Selected target savings goal was not found');
      }
    }

    const nextValues = {
      autoDepositPayroll:
        dto.autoDepositPayroll !== undefined ? Boolean(dto.autoDepositPayroll) : current.autoDepositPayroll,
      sweepMode,
      targetSavingsWalletId,
      targetGoalId,
      autoRolloverBudgets:
        dto.autoRolloverBudgets !== undefined ? Boolean(dto.autoRolloverBudgets) : current.autoRolloverBudgets,
      autoScheduleNextPayroll:
        dto.autoScheduleNextPayroll !== undefined
          ? Boolean(dto.autoScheduleNextPayroll)
          : current.autoScheduleNextPayroll,
      autoYearlyCloseout:
        dto.autoYearlyCloseout !== undefined ? Boolean(dto.autoYearlyCloseout) : current.autoYearlyCloseout,
      yearlyDriveBackup:
        dto.yearlyDriveBackup !== undefined ? Boolean(dto.yearlyDriveBackup) : current.yearlyDriveBackup,
      updatedAt: new Date(),
    };

    const [existing] = await db
      .select()
      .from(cycleAutomationSettings)
      .where(eq(cycleAutomationSettings.userId, userId))
      .limit(1);

    if (existing) {
      await db
        .update(cycleAutomationSettings)
        .set(nextValues)
        .where(eq(cycleAutomationSettings.userId, userId));
    } else {
      await db.insert(cycleAutomationSettings).values({
        userId,
        ...nextValues,
      });
    }

    return this.getSettings(userId);
  }

  async getRuns(userId: string, options?: { runType?: 'monthly' | 'yearly'; limit?: number }) {
    const limit = Math.min(100, Math.max(1, Number(options?.limit || 50)));
    const rows = options?.runType
      ? await db
          .select()
          .from(cycleCloseoutRuns)
          .where(
            and(
              eq(cycleCloseoutRuns.userId, userId),
              eq(cycleCloseoutRuns.runType, options.runType)
            )
          )
          .orderBy(desc(cycleCloseoutRuns.executedAt))
          .limit(limit)
      : await db
          .select()
          .from(cycleCloseoutRuns)
          .where(eq(cycleCloseoutRuns.userId, userId))
          .orderBy(desc(cycleCloseoutRuns.executedAt))
          .limit(limit);

    return rows.map(serializeRunRow);
  }

  private async resolveOrCreateSavingsWallet(userId: string, preferredWalletId?: string | null) {
    const userWallets = await walletService.getWallets(userId);

    if (preferredWalletId) {
      const matched = userWallets.find((w) => w.id === preferredWalletId);
      if (matched) return matched;
    }

    const existingSavings =
      userWallets.find(
        (w) =>
          w.type === 'Savings' &&
          !w.isMain &&
          w.accountSubtype !== 'CreditCard' &&
          w.accountSubtype !== 'Overdraft'
      ) ||
      userWallets.find(
        (w) =>
          w.type === 'Savings' &&
          w.accountSubtype !== 'CreditCard' &&
          w.accountSubtype !== 'Overdraft'
      );

    if (existingSavings) return existingSavings;

    return walletService.createWallet(userId, {
      name: 'Savings Reserve',
      type: 'Savings',
      isMain: false,
      initialBalance: 0,
    });
  }

  private async computeLiveWalletSnapshot(userId: string, dbUser: any) {
    const [userWallets, allTx, allDebts, allPayrolls, allBudgets] = await Promise.all([
      walletService.getWallets(userId),
      transactionService.getTransactionsForUser(userId),
      debtRepository.findAllByUserId(userId),
      payrollRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
    ]);

    const mainBank =
      userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w) => w.type === 'Bank') ||
      userWallets[0];
    const defaultCash = userWallets.find((w) => w.type === 'Cash') || mainBank;

    const normalizedTransactions = allTx.map((tx: any) => {
      let wid = tx.walletId as any;
      if (!wid || wid === 'Bank') {
        wid = (tx as any).sourceWallet === 'Cash' ? defaultCash?.id : mainBank?.id;
      } else if (wid === 'Cash') {
        wid = defaultCash?.id;
      }
      return { ...tx, walletId: wid };
    });

    const engineState = computeFinancialState({
      transactions: normalizedTransactions as any,
      payrolls: allPayrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      wallets: userWallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
        accountSubtype: w.accountSubtype,
        creditLimit: w.creditLimit,
        liabilityBalance: w.liabilityBalance,
      })),
      userSettings: {
        emergencyBuffer: Number(dbUser?.emergencyBuffer || 0),
        salary: Number(dbUser?.salary || 0),
        payday: dbUser?.payday ?? undefined,
      },
    });

    return { userWallets, engineState };
  }

  /**
   * Phase 1 (Pre-Deposit): Runs strictly BEFORE the incoming payroll Income transaction is created.
   * Sweeps leftover Main Bank (and Cash pocket in `bank_and_cash_recover` / `all_pocket_no_recover` modes)
   * into the target Savings wallet, timestamped at the end of the closing financial period
   * so closing-cycle saved analytics are 100% accurate and leftover balances never bleed into the new month.
   */
  async executeMonthlyPrePayrollCloseout(
    userId: string,
    payroll: { id: string; scheduledFor: Date | string; amount: string | number; walletId?: string | null },
    receivedDate: Date,
    actualSalaryAmt: number,
    depositWallet: { id: string; name: string; type: string } | null
  ): Promise<MonthlyPrePayrollCloseoutResult> {
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const settings = await this.getSettings(userId);
    const closingPeriodInfo = resolveClosingPeriodInfo(payroll.scheduledFor, dbUser?.payday ?? null);

    // Strict idempotency guard: if this cycle or payroll already closed out, never double-sweep
    const [existingRun] = await db
      .select()
      .from(cycleCloseoutRuns)
      .where(
        and(
          eq(cycleCloseoutRuns.userId, userId),
          eq(cycleCloseoutRuns.runType, 'monthly'),
          eq(cycleCloseoutRuns.cycleKey, closingPeriodInfo.closingCycleKey)
        )
      )
      .limit(1);

    if (existingRun) {
      return {
        alreadyRan: true,
        existingRunId: existingRun.id,
        settings,
        closingPeriodInfo,
        destinationWallet: null,
        plan: {
          sweepMode: settings.sweepMode,
          sweeps: [],
          cashRecoveries: [],
          sweptBankAmountMad: 0,
          sweptCashAmountMad: 0,
          totalSweptAmountMad: 0,
          recoveredCashAmountMad: 0,
        },
        sweepTransactionIds: [],
      };
    }

    const { userWallets, engineState } = await this.computeLiveWalletSnapshot(userId, dbUser);

    let destinationWallet: any | null = null;
    if (settings.sweepMode !== 'disabled') {
      destinationWallet = await this.resolveOrCreateSavingsWallet(
        userId,
        settings.targetSavingsWalletId
      );
    }

    const refreshedWallets = destinationWallet && !userWallets.some((w) => w.id === destinationWallet.id)
      ? [...userWallets, destinationWallet]
      : userWallets;

    const pendingPayablesMad = Math.max(
      0,
      Number(engineState.totalLiquidity || 0) -
        Number(engineState.emergencyBuffer || 0) -
        Number(engineState.investmentReserve || 0) -
        Number(engineState.safeToSpend || 0)
    );

    const plan = planMonthlyPocketSweep({
      wallets: refreshedWallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        accountSubtype: w.accountSubtype,
      })),
      walletBalances: engineState.walletBalances,
      pendingPayablesMad,
      sweepMode: settings.sweepMode,
      depositWalletId: depositWallet?.id || payroll.walletId || null,
      destinationSavingsWalletId: destinationWallet?.id || null,
      incomingSalaryMad: actualSalaryAmt,
    });

    const sweepTransactionIds: string[] = [];

    if (destinationWallet && plan.sweeps.length > 0) {
      await db.transaction(async (txDb) => {
        for (let idx = 0; idx < plan.sweeps.length; idx += 1) {
          const item = plan.sweeps[idx];
          const sweepTs = computeClosingSweepTimestamp(receivedDate, idx * 10);
          const idempotencyKey = `monthly-closeout-${item.kind}-${payroll.id}-${item.sourceWalletId}`;

          // Check existing tx by idempotency key for extra defense
          const existingByKey = await transactionRepository.findByIdempotencyKey(
            userId,
            idempotencyKey,
            txDb
          );
          if (existingByKey) {
            sweepTransactionIds.push(existingByKey.id);
            continue;
          }

          const createdSweepTx = await transactionRepository.create(
            {
              userId,
              amount: String(item.amountMad),
              type: 'Transfer',
              walletId: item.sourceWalletId as any,
              destinationWalletId: destinationWallet.id as any,
              category: '💰 Savings & Goals',
              idempotencyKey,
              notes:
                item.kind === 'cash_sweep'
                  ? `End-of-cycle pocket cash sweep (${closingPeriodInfo.closingCycleKey}): ${item.sourceWalletName} → ${destinationWallet.name} (recovered from incoming payroll)`
                  : `End-of-cycle bank sweep (${closingPeriodInfo.closingCycleKey}): ${item.sourceWalletName} → ${destinationWallet.name}`,
              createdAt: sweepTs,
            },
            txDb
          );

          await coreAuditService.postJournalEntryForTransaction(
            userId,
            createdSweepTx,
            {
              idempotencyKey: `journal-${idempotencyKey}`,
              memo: `Monthly Closeout Sweep (${closingPeriodInfo.closingCycleKey}): ${item.sourceWalletName} -> ${destinationWallet.name}`,
            },
            txDb
          );

          sweepTransactionIds.push(createdSweepTx.id);
        }
      });
    }

    return {
      alreadyRan: false,
      settings,
      closingPeriodInfo,
      destinationWallet,
      plan,
      sweepTransactionIds,
    };
  }

  /**
   * Phase 2 (Post-Deposit): Runs immediately AFTER the incoming payroll Income transaction is posted.
   * 1. Recovers swept Cash pocket balance from Main Bank -> Cash (dated inside the incoming period)
   *    so physical Cash stays intact and is accounted against the incoming payroll.
   * 2. Optionally credits target Savings Goal with the swept amount.
   * 3. Captures closing/post-closeout Financial Position Snapshot.
   * 4. Auto-schedules next month's expected payroll (so the new period bounds are immediately active).
   * 5. Rolls over previous month's category budgets into the incoming period.
   * 6. Logs permanent `cycle_closeout_runs` audit record & sends summary notification.
   * 7. If closing December (year-end), automatically executes `runYearlyCloseout`.
   */
  async completeMonthlyPostPayrollCloseout(
    userId: string,
    payroll: { id: string; scheduledFor: Date | string; amount: string | number; walletId?: string | null },
    receivedDate: Date,
    actualSalaryAmt: number,
    depositWallet: { id: string; name: string; type: string } | null,
    preResult: MonthlyPrePayrollCloseoutResult,
    triggerSource: 'auto_payroll' | 'manual_confirm' = 'manual_confirm'
  ) {
    if (preResult.alreadyRan) {
      return { alreadyRan: true, runId: preResult.existingRunId || null };
    }

    const { settings, closingPeriodInfo, destinationWallet, plan, sweepTransactionIds } = preResult;
    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    // 1. Recover Cash pocket from incoming payroll (Main Bank -> Cash, timestamped inside incoming cycle!)
    const recoveryTransactionIds: string[] = [];
    if (plan.cashRecoveries.length > 0) {
      await db.transaction(async (txDb) => {
        for (let idx = 0; idx < plan.cashRecoveries.length; idx += 1) {
          const rec = plan.cashRecoveries[idx];
          const recoveryTs = computeCashRecoveryTimestamp(receivedDate, idx);
          const idempotencyKey = `monthly-closeout-cash-recover-${payroll.id}-${rec.destinationCashWalletId}`;

          const existingByKey = await transactionRepository.findByIdempotencyKey(
            userId,
            idempotencyKey,
            txDb
          );
          if (existingByKey) {
            recoveryTransactionIds.push(existingByKey.id);
            continue;
          }

          const createdRecoveryTx = await transactionRepository.create(
            {
              userId,
              amount: String(rec.amountMad),
              type: 'Transfer',
              walletId: rec.sourceBankWalletId as any,
              destinationWalletId: rec.destinationCashWalletId as any,
              category: '🔄 Transfer',
              idempotencyKey,
              notes: `Incoming cycle pocket cash recovery (${closingPeriodInfo.incomingYear}-${String(closingPeriodInfo.incomingMonth).padStart(2, '0')}): ${rec.amountMad.toFixed(2)} MAD allocated from new payroll to ${rec.destinationCashWalletName}`,
              createdAt: recoveryTs,
            },
            txDb
          );

          await coreAuditService.postJournalEntryForTransaction(
            userId,
            createdRecoveryTx,
            {
              idempotencyKey: `journal-${idempotencyKey}`,
              memo: `Incoming Cycle Cash Pocket Recovery: ${rec.sourceBankWalletName} -> ${rec.destinationCashWalletName}`,
            },
            txDb
          );

          recoveryTransactionIds.push(createdRecoveryTx.id);
        }
      });
    }

    // 2. Optional target Savings Goal credit
    let creditedGoalName: string | null = null;
    if (settings.targetGoalId && plan.totalSweptAmountMad >= 0.01) {
      try {
        const goal = await goalRepository.findByIdAndUserId(settings.targetGoalId, userId);
        if (goal) {
          const nextAmount = Number(goal.currentAmount || 0) + plan.totalSweptAmountMad;
          await db
            .update(goals)
            .set({ currentAmount: String(Number(nextAmount.toFixed(2))) })
            .where(and(eq(goals.id, goal.id), eq(goals.userId, userId)));

          await db.insert(goalContributionEvents).values({
            userId,
            goalId: goal.id,
            transactionId: sweepTransactionIds[0] || null,
            sourceWalletId: depositWallet?.id || null,
            destinationWalletId: destinationWallet?.id || null,
            eventType: 'contribution',
            amount: String(plan.totalSweptAmountMad),
            eventDate: receivedDate.toISOString().slice(0, 10),
            notes: `Automated Monthly Closeout sweep (${closingPeriodInfo.closingCycleKey})`,
          });
          creditedGoalName = goal.name;
        }
      } catch (err) {
        console.warn('[CycleCloseout] Optional goal credit skipped:', err);
      }
    }

    // 3. Auto-schedule next month's expected payroll (ensures incoming period bounds exist immediately)
    let nextPayrollId: string | null = null;
    let nextPayrollDateStr: string | null = null;
    if (settings.autoScheduleNextPayroll) {
      try {
        nextPayrollDateStr = computeNextPayrollDate(payroll.scheduledFor, dbUser?.payday ?? null);
        const nextDate = new Date(`${nextPayrollDateStr}T12:00:00.000Z`);
        const { start, end } = monthBoundsUtc(nextDate);
        const existingNext = await payrollRepository.findForMonth(userId, start, end);
        if (existingNext) {
          nextPayrollId = existingNext.id;
        } else {
          const createdNext = await payrollRepository.create({
            userId,
            scheduledFor: nextDate,
            amount: String(Number(payroll.amount || actualSalaryAmt)),
            walletId: depositWallet?.id || payroll.walletId || null,
          });
          nextPayrollId = createdNext.id;
        }
      } catch (err) {
        console.warn('[CycleCloseout] Auto-schedule next payroll skipped:', err);
      }
    }

    // 4. Auto-rollover monthly category budgets to incoming period
    let budgetsRolledCount = 0;
    if (settings.autoRolloverBudgets) {
      try {
        const res = await categoryBudgetService.copyPreviousMonth(
          userId,
          closingPeriodInfo.incomingYear,
          closingPeriodInfo.incomingMonth
        );
        budgetsRolledCount = res.copied || 0;
      } catch (err) {
        console.warn('[CycleCloseout] Budget rollover skipped:', err);
      }
    }

    // 5. Capture Financial Position Snapshot
    let snapshotId: string | null = null;
    try {
      const snap = await coreAuditService.captureFinancialPositionSnapshot(
        userId,
        'monthly_closeout'
      );
      snapshotId = snap?.id || null;
    } catch (err) {
      console.warn('[CycleCloseout] Financial position snapshot skipped:', err);
    }

    // 6. Persist permanent Monthly Closeout run record
    const summaryPayload = {
      closingCycleKey: closingPeriodInfo.closingCycleKey,
      incomingCycleKey: `${closingPeriodInfo.incomingYear}-${String(closingPeriodInfo.incomingMonth).padStart(2, '0')}`,
      destinationWalletName: destinationWallet?.name || null,
      depositWalletName: depositWallet?.name || null,
      creditedGoalName,
      nextPayrollDate: nextPayrollDateStr,
      sweeps: plan.sweeps,
      cashRecoveries: plan.cashRecoveries,
      sweepTransactionIds,
      recoveryTransactionIds,
      isYearEnd: closingPeriodInfo.isYearEnd,
    };

    const [insertedRun] = await db
      .insert(cycleCloseoutRuns)
      .values({
        userId,
        runType: 'monthly',
        cycleKey: closingPeriodInfo.closingCycleKey,
        payrollId: payroll.id,
        triggerSource,
        status: 'completed',
        sweepMode: settings.sweepMode,
        sweptBankAmountMad: String(plan.sweptBankAmountMad),
        sweptCashAmountMad: String(plan.sweptCashAmountMad),
        totalSweptAmountMad: String(plan.totalSweptAmountMad),
        recoveredCashAmountMad: String(plan.recoveredCashAmountMad),
        salaryDepositedMad: String(actualSalaryAmt),
        destinationWalletId: destinationWallet?.id || null,
        budgetsRolledCount,
        nextPayrollId,
        snapshotId,
        summaryJson: JSON.stringify(summaryPayload),
        executedAt: new Date(),
      })
      .onConflictDoNothing()
      .returning();

    // 7. Send 1 concise smart push notification
    try {
      const todayKey = new Date().toISOString().slice(0, 10);
      const recoverText =
        plan.recoveredCashAmountMad > 0
          ? ` · Recovered ${plan.recoveredCashAmountMad.toFixed(0)} MAD pocket cash from new payroll`
          : '';
      await pushService.sendNotification(
        userId,
        `MONTHLY_CLOSEOUT_${closingPeriodInfo.closingCycleKey}`,
        todayKey,
        {
          title: `Monthly Closeout Complete (${closingPeriodInfo.closingCycleKey})`,
          body: `Swept ${plan.totalSweptAmountMad.toFixed(0)} MAD to ${destinationWallet?.name || 'Savings'}${recoverText}. Deposited +${actualSalaryAmt.toFixed(0)} MAD salary${budgetsRolledCount > 0 ? ` and rolled over ${budgetsRolledCount} budgets` : ''}.`,
          url: '/dashboard',
        }
      );
    } catch {
      // Non-fatal
    }

    // 8. If closing December, automatically run Yearly Closeout for the closing calendar year
    let yearlyRun: ReturnType<typeof serializeRunRow> | null = null;
    if (closingPeriodInfo.isYearEnd && settings.autoYearlyCloseout) {
      try {
        yearlyRun = await this.runYearlyCloseout(userId, closingPeriodInfo.closingCalendarYear, {
          triggerSource,
          forceRefresh: false,
        });
      } catch (err) {
        console.warn('[CycleCloseout] Automatic yearly closeout notice:', err);
      }
    }

    return {
      alreadyRan: false,
      run: insertedRun ? serializeRunRow(insertedRun) : null,
      yearlyRun,
      sweptBankAmountMad: plan.sweptBankAmountMad,
      sweptCashAmountMad: plan.sweptCashAmountMad,
      totalSweptAmountMad: plan.totalSweptAmountMad,
      recoveredCashAmountMad: plan.recoveredCashAmountMad,
      budgetsRolledCount,
      nextPayrollId,
      nextPayrollDate: nextPayrollDateStr,
    };
  }

  /**
   * Executes (or refreshes) the full Yearly Closeout & Annual Financial Audit for a target calendar year.
   */
  async runYearlyCloseout(
    userId: string,
    year: number,
    options: { triggerSource?: 'auto_payroll' | 'manual_confirm' | 'manual_run'; forceRefresh?: boolean } = {}
  ) {
    if (!Number.isInteger(year) || year < 2000 || year > 2200) {
      throw new Error('Invalid year for annual closeout');
    }

    const cycleKey = String(year);
    const triggerSource = options.triggerSource || 'manual_run';

    const [existing] = await db
      .select()
      .from(cycleCloseoutRuns)
      .where(
        and(
          eq(cycleCloseoutRuns.userId, userId),
          eq(cycleCloseoutRuns.runType, 'yearly'),
          eq(cycleCloseoutRuns.cycleKey, cycleKey)
        )
      )
      .limit(1);

    if (existing && !options.forceRefresh) {
      return serializeRunRow(existing);
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
    const settings = await this.getSettings(userId);

    // Capture a fresh year_end snapshot first so end-of-year Net Worth is up to date
    let snapshotId: string | null = null;
    let liveNetWorthMad: number | null = null;
    try {
      const snap = await coreAuditService.captureFinancialPositionSnapshot(userId, 'year_end');
      snapshotId = snap?.id || null;
      if (snap?.totalNetWorthMad !== undefined) {
        liveNetWorthMad = Number(snap.totalNetWorthMad);
      }
    } catch (err) {
      console.warn('[YearlyCloseout] Snapshot capture notice:', err);
    }

    const [
      userWallets,
      allTransactions,
      allPayrolls,
      allSubscriptions,
      allDebts,
      allGoals,
      allContexts,
      allSnapshots,
    ] = await Promise.all([
      walletService.getWallets(userId),
      transactionService.getTransactionsForUser(userId),
      payrollRepository.findAllByUserId(userId),
      subscriptionRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      goalRepository.findAllByUserId(userId),
      db.select().from(financialContexts).where(eq(financialContexts.userId, userId)),
      db
        .select()
        .from(financialPositionSnapshots)
        .where(eq(financialPositionSnapshots.userId, userId)),
    ]);

    const auditSummary = computeYearlyAuditMetrics({
      year,
      transactions: allTransactions,
      wallets: userWallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        accountSubtype: w.accountSubtype,
      })),
      payrolls: allPayrolls,
      subscriptions: allSubscriptions,
      debts: allDebts,
      goals: allGoals,
      contexts: allContexts,
      snapshots: allSnapshots.map((s) => ({
        snapshotDate: s.snapshotDate,
        totalNetWorthMad: s.totalNetWorthMad,
      })),
      liveNetWorthMad,
    });

    // Optional Year-End Google Drive archive backup (non-blocking)
    let driveArchivedAt: string | null = null;
    if (
      settings.yearlyDriveBackup &&
      dbUser?.googleDriveToken &&
      (!dbUser.googleDriveTokenExpiry ||
        new Date(dbUser.googleDriveTokenExpiry).getTime() > Date.now())
    ) {
      try {
        const decryptedToken = decryptSecret(dbUser.googleDriveToken);
        if (decryptedToken) {
          const backupRes = await settingsService.backupToGoogleDrive(userId, decryptedToken);
          driveArchivedAt = backupRes?.lastDriveBackupDate
            ? new Date(backupRes.lastDriveBackupDate).toISOString()
            : new Date().toISOString();
        }
      } catch (err) {
        console.warn('[YearlyCloseout] Optional Drive archive skipped:', err);
      }
    }

    const fullPayload = {
      ...auditSummary,
      driveArchivedAt,
    };

    const executedAt = new Date();
    let savedRow: typeof cycleCloseoutRuns.$inferSelect;

    if (existing) {
      const [updated] = await db
        .update(cycleCloseoutRuns)
        .set({
          triggerSource,
          status: 'completed',
          totalSweptAmountMad: String(auditSummary.totalSavedAndSweptMad),
          salaryDepositedMad: String(auditSummary.earnedIncomeMad),
          snapshotId: snapshotId || existing.snapshotId,
          summaryJson: JSON.stringify(fullPayload),
          executedAt,
        })
        .where(and(eq(cycleCloseoutRuns.id, existing.id), eq(cycleCloseoutRuns.userId, userId)))
        .returning();
      savedRow = updated;
    } else {
      const [inserted] = await db
        .insert(cycleCloseoutRuns)
        .values({
          userId,
          runType: 'yearly',
          cycleKey,
          payrollId: null,
          triggerSource,
          status: 'completed',
          sweepMode: settings.sweepMode,
          sweptBankAmountMad: '0',
          sweptCashAmountMad: '0',
          totalSweptAmountMad: String(auditSummary.totalSavedAndSweptMad),
          recoveredCashAmountMad: '0',
          salaryDepositedMad: String(auditSummary.earnedIncomeMad),
          destinationWalletId: settings.targetSavingsWalletId || null,
          budgetsRolledCount: 0,
          nextPayrollId: null,
          snapshotId,
          summaryJson: JSON.stringify(fullPayload),
          executedAt,
        })
        .returning();
      savedRow = inserted;
    }

    if (triggerSource !== 'manual_run') {
      try {
        await pushService.sendNotification(
          userId,
          `YEARLY_CLOSEOUT_${year}`,
          executedAt.toISOString().slice(0, 10),
          {
            title: `${year} Annual Financial Closeout Ready`,
            body: `Earned ${auditSummary.earnedIncomeMad.toFixed(0)} MAD · Net spend ${auditSummary.netLivingSpendMad.toFixed(0)} MAD · ${auditSummary.annualSavingsRatePercent.toFixed(1)}% annual savings rate. View your full report in Reports.`,
            url: '/dashboard',
          }
        );
      } catch {
        // Non-fatal
      }
    }

    return serializeRunRow(savedRow);
  }
}

export const cycleCloseoutService = new CycleCloseoutService();
