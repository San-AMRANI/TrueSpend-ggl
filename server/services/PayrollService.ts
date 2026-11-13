import { eq, and } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { payrolls } from '../../src/db/schema.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { walletService } from './WalletService.js';
import { coreAuditService } from './CoreAuditService.js';

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

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

    await coreAuditService.syncAndGetCommitmentOccurrences(userId).catch(() => undefined);
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

    await coreAuditService.syncAndGetCommitmentOccurrences(userId).catch(() => undefined);
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
  }

  /**
   * Audit Fix G: Scheduled payrolls represent EXPECTED income only.
   * Do NOT automatically fabricate received cash on the scheduled date unless confirmed by the user or matched to a statement row.
   * For existing historical payrolls that already have a linked transaction, mark their status as 'confirmed'.
   */
  async reconcileDuePayrolls(userId: string, _now = new Date()) {
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

    return synced;
  }

  /**
   * Explicitly confirm a scheduled payroll receipt (with actual received amount, date, wallet, and variance).
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

    const targetWallet = await this.resolveTargetWallet(
      userId,
      dto.walletId || (payroll as any).walletId || undefined
    ).catch(async () => this.resolveTargetWallet(userId, undefined));
    const targetWalletId: string | null = targetWallet?.id || null;

    const { updatedPayroll, createdTx } = await db.transaction(async (txDb) => {
      const createdTx = await transactionRepository.create(
        {
          userId,
          payrollId: payroll.id,
          amount: String(actualAmt),
          type: 'Income',
          walletId: targetWalletId as any,
          category: '📥 Income',
          notes:
            variance === 0
              ? `Confirmed salary deposit (${actualAmt.toFixed(0)} MAD${targetWallet ? ` · ${targetWallet.name}` : ''})`
              : `Confirmed salary deposit (${actualAmt.toFixed(0)} MAD vs ${expectedAmt.toFixed(0)} MAD expected · variance ${variance >= 0 ? '+' : ''}${variance.toFixed(0)} MAD${targetWallet ? ` · ${targetWallet.name}` : ''})`,
          createdAt: receivedDate,
        },
        txDb
      );

      await coreAuditService.postJournalEntryForTransaction(
        userId,
        createdTx,
        {
          idempotencyKey: `payroll-confirm-${payroll.id}`,
          memo: `Confirmed Payroll Receipt (${actualAmt.toFixed(2)} MAD${targetWallet ? ` -> ${targetWallet.name}` : ''})`,
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

    await Promise.all([
      coreAuditService.processPendingOutboxEvents(userId).catch(() => undefined),
      coreAuditService.syncAndGetCommitmentOccurrences(userId).catch(() => undefined),
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
    };
  }
}

export const payrollService = new PayrollService();

