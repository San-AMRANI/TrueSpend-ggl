import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { payrolls, commitmentOccurrences } from '../../src/db/schema.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { walletService } from './WalletService.js';
import { coreAuditService } from './CoreAuditService.js';
import { cycleCloseoutService } from './CycleCloseoutService.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const autoPayrollLocks = new Map<string, Promise<number>>();

const asCalendarDate = (value: string) => {
  if (!DATE_ONLY.test(value)) throw new Error('Invalid payroll date');
  const parsed = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error('Invalid payroll date');
  }
  return parsed;
};

const monthBounds = (date: Date) => ({
  start: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0)),
  end: new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1, 0, 0, 0, 0)),
});

export class PayrollService {
  private async resolveTargetWallet(userId: string, requestedWalletId?: string | null) {
    const userWallets = await walletService.getWallets(userId);
    if (requestedWalletId) {
      const matched = userWallets.find((w) => w.id === requestedWalletId);
      if (!matched) {
        throw new Error('Selected deposit bank account / wallet was not found');
      }
      return matched;
    }
    return (
      userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w) => w.type === 'Bank') ||
      userWallets.find((w) => w.isMain) ||
      userWallets[0] ||
      null
    );
  }

  async getPayrollsForUser(userId: string) {
    const [list, userWallets] = await Promise.all([
      payrollRepository.findAllByUserId(userId),
      walletService.getWallets(userId),
    ]);
    const walletMap = new Map(userWallets.map((w) => [w.id, w]));
    const defaultWallet =
      userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w) => w.type === 'Bank') ||
      userWallets.find((w) => w.isMain) ||
      userWallets[0] ||
      null;

    const enriched = [];
    for (const p of list) {
      const linkedTx = await transactionRepository.findByPayrollId(p.id);
      const effectiveStatus = linkedTx
        ? (p as any).status === 'matched'
          ? 'matched'
          : 'confirmed'
        : (p as any).status || 'expected';
      const resolvedWalletId = (p as any).walletId || linkedTx?.walletId || defaultWallet?.id || null;
      const resolvedWallet = resolvedWalletId ? walletMap.get(resolvedWalletId) || null : null;
      enriched.push({
        ...p,
        status: effectiveStatus,
        walletId: resolvedWalletId,
        walletName: resolvedWallet?.name || null,
        walletType: resolvedWallet?.type || null,
        linkedTransactionId: linkedTx?.id || null,
      });
    }
    return enriched;
  }

  async createPayroll(userId: string, dto: { scheduledFor?: string; amount?: number; walletId?: string | null }) {
    if (!dto.scheduledFor) throw new Error('A payroll date is required');
    if (!Number.isFinite(dto.amount) || (dto.amount || 0) <= 0) throw new Error('Payroll amount must be greater than zero');

    const scheduledFor = asCalendarDate(dto.scheduledFor);
    const { start, end } = monthBounds(scheduledFor);
    const existingForMonth = await payrollRepository.findForMonth(userId, start, end);
    if (existingForMonth) throw new Error('This calendar month already has a payroll. Edit the existing entry in Transactions after it is posted.');

    const targetWallet = await this.resolveTargetWallet(userId, dto.walletId);

    const created = await payrollRepository.create({
      userId,
      scheduledFor,
      amount: String(dto.amount),
      walletId: targetWallet?.id || null,
    });

    await coreAuditService.syncAndGetCommitmentOccurrences(userId, 90, { forceSync: true }).catch(() => undefined);
    return {
      ...created,
      walletId: created.walletId || targetWallet?.id || null,
      walletName: targetWallet?.name || null,
      walletType: targetWallet?.type || null,
    };
  }

  async updatePayroll(
    userId: string,
    payrollId: string,
    dto: { scheduledFor?: string; amount?: number; walletId?: string | null }
  ) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId);
    if (!payroll) throw new Error('Payroll not found');
    const existingTx = await transactionRepository.findByPayrollId(payrollId);
    if (existingTx || (payroll as any).status === 'confirmed' || (payroll as any).status === 'matched') {
      throw new Error('This payroll has already been confirmed and posted. Edit its transaction instead.');
    }

    const updates: Partial<{ scheduledFor: Date; amount: string; walletId: string | null }> = {};
    if (dto.amount !== undefined) {
      if (!Number.isFinite(Number(dto.amount)) || Number(dto.amount) <= 0) {
        throw new Error('Payroll amount must be greater than zero');
      }
      updates.amount = String(dto.amount);
    }
    if (dto.scheduledFor !== undefined) {
      const scheduledFor = asCalendarDate(dto.scheduledFor);
      const { start, end } = monthBounds(scheduledFor);
      const existingForMonth = await payrollRepository.findForMonth(userId, start, end, payrollId);
      if (existingForMonth) {
        throw new Error('This calendar month already has a different payroll.');
      }
      updates.scheduledFor = scheduledFor;
    }

    let targetWallet = null;
    if (dto.walletId !== undefined) {
      targetWallet = dto.walletId ? await this.resolveTargetWallet(userId, dto.walletId) : null;
      updates.walletId = targetWallet?.id || null;
    } else if ((payroll as any).walletId) {
      targetWallet = await this.resolveTargetWallet(userId, (payroll as any).walletId).catch(() => null);
    }

    const updated =
      Object.keys(updates).length > 0
        ? await payrollRepository.update(payrollId, userId, updates)
        : payroll;

    await coreAuditService.syncAndGetCommitmentOccurrences(userId, 90, { forceSync: true }).catch(() => undefined);
    return {
      ...updated,
      walletName: targetWallet?.name || null,
      walletType: targetWallet?.type || null,
    };
  }

  async deletePayroll(userId: string, payrollId: string) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId);
    if (!payroll) throw new Error('Payroll not found');
    if (await transactionRepository.findByPayrollId(payrollId)) {
      throw new Error('This payroll has already been confirmed and posted. Edit its transaction instead.');
    }
    await payrollRepository.deleteByIdAndUserId(payrollId, userId);
    await db
      .delete(commitmentOccurrences)
      .where(
        and(
          eq(commitmentOccurrences.userId, userId),
          eq(commitmentOccurrences.sourceType, 'payroll'),
          eq(commitmentOccurrences.sourceId, payrollId)
        )
      )
      .catch(() => undefined);
  }

  /**
   * Automatically executes due scheduled payrolls (Option A) when the user has
   * `autoDepositPayroll` enabled. Runs the full Monthly Pre-Payroll Closeout
   * (Bank + Cash sweep to Savings), posts the salary deposit, recovers pocket Cash
   * from the incoming payroll, rolls over budgets, schedules next month's payroll,
   * and triggers Yearly Closeout when closing December.
   *
   * Guarded per-user by an in-process lock + DB idempotency keys so concurrent requests
   * can never double-deposit or double-sweep.
   */
  async processDueAutoPayrolls(userId: string, now = new Date()): Promise<number> {
    const existingLock = autoPayrollLocks.get(userId);
    if (existingLock) {
      return existingLock;
    }

    const runPromise = (async () => {
      try {
        const settings = await cycleCloseoutService.getSettings(userId);
        if (!settings.autoDepositPayroll) {
          return 0;
        }

        const userPayrolls = await payrollRepository.findAllByUserId(userId);
        const todayStr = now.toISOString().slice(0, 10);
        const lookbackDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const minAutoDateStr = lookbackDate.toISOString().slice(0, 10);

        const dueExpected = userPayrolls
          .filter((p) => {
            if ((p as any).status && (p as any).status !== 'expected') return false;
            const sched = new Date(p.scheduledFor);
            if (Number.isNaN(sched.getTime())) return false;
            const schedStr = sched.toISOString().slice(0, 10);
            return schedStr <= todayStr && schedStr >= minAutoDateStr;
          })
          .sort(
            (a, b) =>
              new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime()
          );

        let depositedCount = 0;
        for (const duePayroll of dueExpected) {
          const existingTx = await transactionRepository.findByPayrollId(duePayroll.id);
          if (existingTx) continue;

          const scheduledDateStr = new Date(duePayroll.scheduledFor).toISOString().slice(0, 10);
          try {
            const res = await this.confirmPayrollReceipt(userId, duePayroll.id, {
              confirmedAmount: Number(duePayroll.amount || 0),
              confirmedDate: scheduledDateStr,
              walletId: (duePayroll as any).walletId || undefined,
              status: 'confirmed',
              triggerSource: 'auto_payroll',
            });
            if (!res.alreadyConfirmed) {
              depositedCount += 1;
            }
          } catch (err) {
            console.error(
              `[PayrollService] Auto-deposit failed for payroll ${duePayroll.id}:`,
              err
            );
          }
        }

        return depositedCount;
      } finally {
        autoPayrollLocks.delete(userId);
      }
    })();

    autoPayrollLocks.set(userId, runPromise);
    return runPromise;
  }

  /**
   * Synchronizes historical payrolls that already have a linked transaction,
   * and executes due scheduled payrolls when auto-deposit on payday is enabled.
   */
  async reconcileDuePayrolls(userId: string, now = new Date()) {
    const userPayrolls = await payrollRepository.findAllByUserId(userId);
    let synced = 0;

    for (const payroll of userPayrolls) {
      const existingTx = await transactionRepository.findByPayrollId(payroll.id);
      if (existingTx && (payroll as any).status === 'expected') {
        await db
          .update(payrolls)
          .set({
            status: 'confirmed',
            walletId: (payroll as any).walletId || existingTx.walletId || null,
            confirmedAmount: String(existingTx.amount),
            confirmedAt: existingTx.createdAt || new Date(),
            varianceAmount: String(
              (Number(existingTx.amount || 0) - Number(payroll.amount || 0)).toFixed(2)
            ),
          })
          .where(eq(payrolls.id, payroll.id));
        synced += 1;
      }
    }

    const autoDeposited = await this.processDueAutoPayrolls(userId, now).catch((err) => {
      console.warn('[PayrollService] Deferred auto-payroll check notice:', err);
      return 0;
    });

    return synced + autoDeposited;
  }

  /**
   * Confirms (or auto-deposits) a scheduled payroll receipt.
   * Orchestrates the full Monthly Closeout lifecycle around the salary deposit:
   *   1. Pre-Deposit Closeout: sweeps Bank + Cash pocket leftovers to Savings (dated end of closing cycle).
   *   2. Salary Deposit: posts the incoming payroll Income transaction at `receivedDate`.
   *   3. Post-Deposit Closeout: recovers pocket Cash from the new payroll (`Main Bank -> Cash` inside the
   *      incoming cycle), credits optional Savings Goal, auto-schedules next month's payroll, rolls over
   *      budgets, captures snapshot, logs audit run, and triggers Yearly Closeout if closing December.
   */
  async confirmPayrollReceipt(
    userId: string,
    payrollId: string,
    dto: {
      confirmedAmount?: number;
      confirmedDate?: string;
      walletId?: string;
      varianceNotes?: string;
      status?: 'confirmed' | 'matched';
      triggerSource?: 'auto_payroll' | 'manual_confirm';
      skipCloseout?: boolean;
    } = {}
  ) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId);
    if (!payroll) throw new Error('Payroll not found');

    const existingTx = await transactionRepository.findByPayrollId(payrollId);
    if (existingTx) {
      return { payroll, transaction: existingTx, alreadyConfirmed: true };
    }

    const expectedAmt = Number(payroll.amount || 0);
    const actualAmt =
      dto.confirmedAmount !== undefined && Number.isFinite(Number(dto.confirmedAmount))
        ? Number(dto.confirmedAmount)
        : expectedAmt;
    if (actualAmt <= 0) throw new Error('Confirmed payroll amount must be greater than zero');

    const variance = Number((actualAmt - expectedAmt).toFixed(2));
    const receivedDate = dto.confirmedDate ? asCalendarDate(dto.confirmedDate) : new Date();
    const triggerSource = dto.triggerSource || 'manual_confirm';

    const targetWallet = await this.resolveTargetWallet(
      userId,
      dto.walletId || (payroll as any).walletId || undefined
    ).catch(async () => this.resolveTargetWallet(userId, undefined));
    const targetWalletId: string | null = targetWallet?.id || null;

    // PHASE 1: Run Monthly Pre-Payroll Closeout strictly BEFORE salary deposit
    let preCloseoutResult = null;
    if (!dto.skipCloseout) {
      try {
        preCloseoutResult = await cycleCloseoutService.executeMonthlyPrePayrollCloseout(
          userId,
          payroll,
          receivedDate,
          actualAmt,
          targetWallet
            ? { id: targetWallet.id, name: targetWallet.name, type: targetWallet.type }
            : null
        );
      } catch (err) {
        console.error('[PayrollService] Pre-payroll monthly closeout error (proceeding safely with deposit):', err);
      }
    }

    // PHASE 2: Deposit incoming salary transaction + double-entry journal
    const depositLabel = triggerSource === 'auto_payroll' ? 'Auto-deposited salary' : 'Confirmed salary deposit';
    const { updatedPayroll, createdTx } = await db.transaction(async (txDb) => {
      const createdTx = await transactionRepository.create(
        {
          userId,
          payrollId: payroll.id,
          amount: String(actualAmt),
          type: 'Income',
          walletId: targetWalletId as any,
          category: '📥 Income',
          idempotencyKey: `payroll-deposit-${payroll.id}`,
          notes:
            variance === 0
              ? `${depositLabel} (${actualAmt.toFixed(0)} MAD${targetWallet ? ` · ${targetWallet.name}` : ''})`
              : `${depositLabel} (${actualAmt.toFixed(0)} MAD vs ${expectedAmt.toFixed(0)} MAD expected · variance ${variance >= 0 ? '+' : ''}${variance.toFixed(0)} MAD${targetWallet ? ` · ${targetWallet.name}` : ''})`,
          createdAt: receivedDate,
        },
        txDb
      );

      await coreAuditService.postJournalEntryForTransaction(
        userId,
        createdTx,
        {
          idempotencyKey: `payroll-confirm-${payroll.id}`,
          memo: `${depositLabel} (${actualAmt.toFixed(2)} MAD${targetWallet ? ` -> ${targetWallet.name}` : ''})`,
        },
        txDb
      );

      const [updatedPayroll] = await txDb
        .update(payrolls)
        .set({
          status: dto.status || 'confirmed',
          walletId: targetWalletId,
          confirmedAmount: String(actualAmt),
          confirmedAt: receivedDate,
          varianceAmount: String(variance),
          varianceNotes:
            dto.varianceNotes ||
            (variance < 0 ? 'Short-paid vs expected' : variance > 0 ? 'Overpaid / bonus included' : 'Matched expected amount'),
        })
        .where(and(eq(payrolls.id, payroll.id), eq(payrolls.userId, userId)))
        .returning();

      await coreAuditService.enqueueDomainEvent(
        userId,
        'salary_confirmed',
        payroll.id,
        {
          amount: actualAmt,
          category: '📥 Income',
          walletId: targetWalletId || undefined,
          description: `Salary Confirmed${targetWallet ? ` (${targetWallet.name})` : ''}`,
          eventId: payroll.id,
        },
        txDb
      );

      return { updatedPayroll, createdTx };
    });

    // PHASE 3: Run Post-Deposit Monthly Closeout (Cash Pocket Recovery from incoming payroll,
    // Budget Rollover, Next Payroll Auto-Schedule, Snapshot, Audit Log & optional Yearly Closeout)
    let closeoutSummary: any = null;
    if (!dto.skipCloseout && preCloseoutResult) {
      try {
        closeoutSummary = await cycleCloseoutService.completeMonthlyPostPayrollCloseout(
          userId,
          payroll,
          receivedDate,
          actualAmt,
          targetWallet
            ? { id: targetWallet.id, name: targetWallet.name, type: targetWallet.type }
            : null,
          preCloseoutResult,
          triggerSource
        );
      } catch (err) {
        console.error('[PayrollService] Post-payroll monthly closeout notice:', err);
      }
    }

    await Promise.all([
      coreAuditService.processPendingOutboxEvents(userId).catch(() => undefined),
      coreAuditService.syncAndGetCommitmentOccurrences(userId, 90, { forceSync: true }).catch(() => undefined),
    ]);

    return {
      payroll: {
        ...updatedPayroll,
        walletId: targetWalletId,
        walletName: targetWallet?.name || null,
        walletType: targetWallet?.type || null,
      },
      transaction: createdTx,
      variance,
      closeoutSummary,
    };
  }
}

export const payrollService = new PayrollService();


