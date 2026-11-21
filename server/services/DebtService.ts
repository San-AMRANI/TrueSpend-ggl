import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { debts } from '../../src/db/schema.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { walletService } from './WalletService.js';
import { coreAuditService } from './CoreAuditService.js';

export interface SettleDebtDTO {
  amount: number;
  contact?: string;
  counterpartyType?: 'Person' | 'Institution' | 'Merchant' | 'person' | 'institution' | 'merchant' | 'employer';
  type?: 'Receivable' | 'Payable';
  debt_id?: string;
  due_date?: string;
  /** Optional YYYY-MM-DD date when the loan was given or received. */
  loanDate?: string;
  interestRateApr?: number;
  rateType?: 'none' | 'zero' | 'fixed' | 'variable';
  installmentAmount?: number;
  installmentFrequency?: 'one_time' | 'monthly' | 'biweekly' | 'weekly';
  feesAmount?: number;
  currency?: string;
  /** Wallet that sends or receives the settlement or loan disbursement money. */
  walletId?: string;
  /** If true when creating a new debt, deducts from wallet (Receivable / Loan Given) or deposits into wallet (Payable / Loan Received). */
  recordWalletMovement?: boolean;
  category?: string;
  /** If true, waives/forgives the debt without creating a wallet reimbursement/repayment transaction. */
  isForgiven?: boolean;
  reason?: string;
  note?: string;
}

export interface ForgiveDebtDTO {
  amount?: number;
  reason?: string;
  note?: string;
}

export interface UpdateDebtDTO {
  amount: number;
  contact: string;
  type: 'Receivable' | 'Payable';
  due_date?: string;
  counterpartyType?: 'Person' | 'Institution' | 'Merchant';
  interestRateApr?: number;
  rateType?: 'none' | 'fixed' | 'variable';
  installmentAmount?: number;
  installmentFrequency?: 'one_time' | 'monthly' | 'biweekly' | 'weekly';
  feesAmount?: number;
}

export class DebtService {
  async getDebtsWithSettlements(userId: string) {
    const [allDebts, allSplits, allTxs, forgivenessLogs] = await Promise.all([
      debtRepository.findAllByUserId(userId),
      debtRepository.findAllLinkedSplits(userId),
      transactionRepository.findAllByUserId(userId),
      debtRepository.findForgivenessLogsByUserId(userId),
    ]);

    return allDebts.map((debt) => {
      const debtSplits = allSplits.filter((s) => s.linkedContactId === debt.id);

      // Separate origin transaction split from settlement splits:
      // - For Receivable debts: origin is Expense, settlement is Income.
      // - For Payable debts: origin is Income (Loan) OR Expense with split.reimbursableAmount > 0 (Uncompleted Bill),
      //   while settlement is Expense with split.reimbursableAmount == 0.
      let originTransactionId: string | null = null;
      let originDescription: string | null = null;

      const cashSettlements = debtSplits
        .map((s) => {
          const tx = allTxs.find((t) => t.id === s.transactionId);
          if (!tx) return null;
          const splitAmountNum = parseFloat(s.reimbursableAmount || '0');

          const isOrigin =
            (debt.type === 'Receivable' && tx.type === 'Expense') ||
            (debt.type === 'Payable' && tx.type === 'Income') ||
            (debt.type === 'Payable' && tx.type === 'Expense' && splitAmountNum > 0);

          if (isOrigin) {
            originTransactionId = tx.id;
            if (debt.type === 'Payable' && tx.type === 'Expense') {
              const paidNow = parseFloat(tx.amount as unknown as string) || 0;
              const origDebt = parseFloat(debt.originalAmount as unknown as string) || splitAmountNum;
              originDescription = `Uncompleted Transaction: ${tx.notes || tx.category || 'Expense'} (Paid ${paidNow.toFixed(2)} / ${(paidNow + origDebt).toFixed(2)} MAD)`;
            } else {
              originDescription = `${tx.notes || tx.category || tx.type} (${parseFloat(tx.amount as unknown as string).toFixed(2)} MAD)`;
            }
            return null;
          }

          return {
            id: s.id,
            amount: splitAmountNum > 0 ? s.reimbursableAmount : (tx.amount || '0'),
            createdAt: tx.createdAt || debt.createdAt,
            isForgiven: false,
          };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);

      // Parse forgiveness logs for this debt
      const forgivenEntries = forgivenessLogs
        .filter((log) => log.targetUserName === debt.id)
        .map((log) => {
          let parsed: { amount?: number; reason?: string; note?: string } = {};
          try {
            parsed = JSON.parse(log.details || '{}');
          } catch {}
          return {
            id: log.id,
            amount: String(Number(parsed.amount || 0).toFixed(2)),
            createdAt: log.createdAt,
            isForgiven: true,
            reason: parsed.reason || 'Forgiven / Waived',
            note: parsed.note || '',
          };
        });

      const originalNum = parseFloat(debt.originalAmount as unknown as string) || 0;
      const remainingNum = parseFloat(debt.remainingBalance as unknown as string) || 0;
      const cashSettledSum = cashSettlements.reduce(
        (sum, s) => sum + (parseFloat(s.amount as unknown as string) || 0),
        0
      );
      const loggedForgivenSum = forgivenEntries.reduce(
        (sum, f) => sum + (parseFloat(f.amount) || 0),
        0
      );

      // If a debt was forgiven and there is any unlogged discrepancy between (original - remaining) and cashSettledSum, surface it cleanly
      const totalSettledOrForgiven = Math.max(0, originalNum - remainingNum);
      const unloggedForgiven = Math.max(
        0,
        totalSettledOrForgiven - cashSettledSum - loggedForgivenSum
      );
      if (unloggedForgiven > 0.01 && forgivenEntries.length === 0 && cashSettlements.length === 0 && remainingNum <= 0.001) {
        forgivenEntries.push({
          id: `forgiven-${debt.id}`,
          amount: unloggedForgiven.toFixed(2),
          createdAt: debt.createdAt,
          isForgiven: true,
          reason: 'Forgiven / Waived',
          note: '',
        });
      }

      const settlements = [...cashSettlements, ...forgivenEntries].sort(
        (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
      );

      const totalForgivenNum = forgivenEntries.reduce(
        (sum, f) => sum + (parseFloat(f.amount) || 0),
        0
      );

      // Auto-correct any floating point remaining balance artifacts
      let correctedStatus = debt.status;
      if (remainingNum <= 0.001 && debt.status === 'Pending') {
        correctedStatus = 'Cleared';
        debtRepository
          .update(debt.id, userId, { status: 'Cleared', remainingBalance: '0' })
          .catch(() => {});
      }

      const apr = parseFloat((debt as any).interestRateApr || '0') || 0;
      const instAmt = parseFloat((debt as any).installmentAmount || '0') || 0;
      const feesAmt = parseFloat((debt as any).feesAmount || '0') || 0;
      const monthsRemaining =
        instAmt > 0 && remainingNum > 0 ? Math.ceil(remainingNum / instAmt) : 0;
      const projectedRemainingInterest =
        apr > 0 && remainingNum > 0
          ? Number(((remainingNum * (apr / 100) * Math.max(1, monthsRemaining)) / 12).toFixed(2))
          : 0;

      const amortizationSchedule = coreAuditService.generateDebtInstallmentSchedule({
        id: debt.id,
        contactName: debt.contactName,
        type: debt.type,
        remainingBalance: remainingNum,
        installmentAmount: instAmt > 0 ? instAmt : null,
        installmentFrequency: (debt as any).installmentFrequency || 'one_time',
        interestRateApr: apr,
        feesAmount: feesAmt,
        dueDate: debt.dueDate,
        currency: (debt as any).currency || 'MAD',
      });

      return {
        ...debt,
        remainingBalance: remainingNum <= 0.001 ? '0' : debt.remainingBalance,
        status: correctedStatus,
        settlements,
        forgivenAmount: totalForgivenNum > 0.001 ? totalForgivenNum.toFixed(2) : undefined,
        originTransactionId,
        originDescription,
        earlySettlementSavingsMad: projectedRemainingInterest,
        estimatedMonthsRemaining: monthsRemaining,
        totalPayoffWithFeesMad: Number((remainingNum + feesAmt + projectedRemainingInterest).toFixed(2)),
        amortizationSchedule,
      };
    });
  }

  /**
   * Forgives / Frees all or part of a debt without creating a wallet reimbursement or expense transaction.
   * Wallet balances and income/reimbursement ledgers remain untouched.
   */
  async forgiveDebt(userId: string, debtId: string, dto: ForgiveDebtDTO) {
    const debt = await debtRepository.findByIdAndUserId(debtId, userId);
    if (!debt) {
      throw new Error('Debt not found');
    }

    const currentRemaining = parseFloat(debt.remainingBalance as unknown as string) || 0;
    if (currentRemaining <= 0.001) {
      throw new Error('This debt is already cleared');
    }

    const forgiveAmount =
      dto.amount !== undefined && Number.isFinite(Number(dto.amount)) && Number(dto.amount) > 0
        ? Math.min(currentRemaining, Number(dto.amount))
        : currentRemaining;

    const newRemaining = Math.max(0, Number((currentRemaining - forgiveAmount).toFixed(2)));

    await debtRepository.update(debtId, userId, {
      remainingBalance: newRemaining <= 0.001 ? '0' : String(newRemaining),
      status: newRemaining <= 0.001 ? 'Cleared' : 'Pending',
    });

    // If this is a Receivable debt linked to an original Expense split, reduce the split's reimbursableAmount
    // so the forgiven portion is no longer treated as a pending reimbursement.
    if (debt.type === 'Receivable') {
      try {
        const linkedSplits = await transactionRepository.findSplitsByDebtId(debtId);
        const allTxs = await transactionRepository.findAllByUserId(userId);
        for (const s of linkedSplits) {
          const tx = allTxs.find((t) => t.id === s.transactionId);
          if (tx && tx.type === 'Expense') {
            const currentReimb = parseFloat(s.reimbursableAmount as unknown as string) || 0;
            const nextReimb = Math.max(0, Number((currentReimb - forgiveAmount).toFixed(2)));
            await transactionRepository.updateSplit(s.id, {
              reimbursableAmount: String(nextReimb),
            });
          }
        }
      } catch (e) {
        console.warn('Could not adjust original expense split on debt forgiveness:', e);
      }
    }

    await debtRepository.recordDebtForgiveness({
      userId,
      debtId,
      contactName: debt.contactName,
      amount: forgiveAmount,
      reason: dto.reason || 'Forgiven / Favor',
      note: dto.note,
    });

    return {
      message: 'Debt forgiven without wallet reimbursement',
      forgivenAmount: forgiveAmount,
      remainingBalance: newRemaining,
      status: newRemaining <= 0.001 ? 'Cleared' : 'Pending',
    };
  }

  private async resolveOwnedWalletId(userId: string, requestedWalletId?: string): Promise<string | null> {
    const userWallets = await walletService.getWallets(userId);
    if (requestedWalletId) {
      const match =
        userWallets.find((w) => w.id === requestedWalletId) ||
        userWallets.find((w) => w.name.toLowerCase() === requestedWalletId.trim().toLowerCase());
      if (!match) {
        throw new Error('Selected wallet does not belong to your account.');
      }
      return match.id;
    }
    return userWallets.find((w) => w.isMain)?.id || userWallets[0]?.id || null;
  }

  async processDebt(userId: string, dto: SettleDebtDTO) {
    if (dto.debt_id) {
      if (dto.isForgiven) {
        return await this.forgiveDebt(userId, dto.debt_id, {
          amount: dto.amount,
          reason: dto.reason,
          note: dto.note,
        });
      }

      const settleAmount = Number(dto.amount);
      if (!Number.isFinite(settleAmount) || settleAmount <= 0) {
        throw new Error('Settlement amount must be greater than zero.');
      }

      const debt = await debtRepository.findByIdAndUserId(dto.debt_id, userId);
      if (!debt) {
        throw new Error('Debt not found');
      }

      const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
      const newRemaining = Math.max(0, Number((currentRemaining - settleAmount).toFixed(2)));
      const txType: 'Income' | 'Expense' = debt.type === 'Receivable' ? 'Income' : 'Expense';
      const txCategory = dto.category || (debt.type === 'Receivable' ? '🔙 Reimbursement' : '💳 Debt & Obligations');
      const targetWalletId = await this.resolveOwnedWalletId(userId, dto.walletId);

      await db.transaction(async (txDb) => {
        await debtRepository.update(
          dto.debt_id!,
          userId,
          {
            remainingBalance: newRemaining <= 0.001 ? '0' : String(newRemaining),
            status: newRemaining <= 0.001 ? 'Cleared' : 'Pending',
          },
          txDb
        );

        const newTx = await transactionRepository.create(
          {
            userId,
            amount: String(settleAmount),
            type: txType,
            walletId: targetWalletId,
            category: txCategory,
            notes: `Settlement for ${debt.contactName}`,
          },
          txDb
        );

        await transactionRepository.createSplit(
          {
            transactionId: newTx.id,
            reimbursableAmount: debt.type === 'Receivable' ? String(settleAmount) : '0',
            linkedContactId: dto.debt_id,
          },
          txDb
        );

        await coreAuditService.postJournalEntryForTransaction(
          userId,
          newTx,
          {
            idempotencyKey: `debt-settle-${newTx.id}`,
            memo: `Debt settlement for ${debt.contactName}`,
          },
          txDb
        );
      });

      return { message: 'Debt settled' };
    } else {
      const principalAmount = Number(dto.amount);
      if (!Number.isFinite(principalAmount) || principalAmount <= 0) {
        throw new Error('Loan or debt amount must be greater than zero.');
      }

      const contactName = (dto.contact || '').trim();
      if (!contactName) {
        throw new Error('Contact or counterparty name is required.');
      }

      const debtType: 'Receivable' | 'Payable' = dto.type === 'Payable' ? 'Payable' : 'Receivable';
      const parsedDueDate = this.parseDueDate(dto.due_date);
      const parsedLoanDate = this.parseDueDate(dto.loanDate);
      const recordWalletMovement = Boolean(dto.recordWalletMovement);

      let targetWalletId: string | null = null;
      if (recordWalletMovement) {
        targetWalletId = await this.resolveOwnedWalletId(userId, dto.walletId);
        if (!targetWalletId) {
          throw new Error('Select a wallet to record this loan cash movement.');
        }
      }

      const normalizedRateType =
        dto.rateType === 'zero' ? 'none' : dto.rateType || 'none';

      const createdResult = await db.transaction(async (txDb) => {
        const newDebt = await debtRepository.create(
          {
            userId,
            contactName,
            type: debtType,
            originalAmount: String(principalAmount),
            remainingBalance: String(principalAmount),
            status: 'Pending',
            dueDate: parsedDueDate,
            createdAt: parsedLoanDate,
          },
          txDb
        );

        await txDb
          .update(debts)
          .set({
            counterpartyType: dto.counterpartyType || 'person',
            principalBalance: String(principalAmount),
            interestRateApr: String(Number(dto.interestRateApr ?? 0) || 0),
            rateType: normalizedRateType,
            installmentAmount:
              dto.installmentAmount && Number(dto.installmentAmount) > 0
                ? String(dto.installmentAmount)
                : null,
            installmentFrequency: dto.installmentFrequency || 'one_time',
            feesAmount: String(Number(dto.feesAmount ?? 0) || 0),
            currency: (dto.currency || 'MAD').toUpperCase(),
          })
          .where(eq(debts.id, newDebt.id));

        let originTransactionId: string | null = null;

        if (recordWalletMovement && targetWalletId) {
          const isLoanGiven = debtType === 'Receivable';
          const originTxType: 'Expense' | 'Income' = isLoanGiven ? 'Expense' : 'Income';
          const originCategory = isLoanGiven ? '🤝 Loan Given' : '🤝 Loan Received';
          const customNote = dto.note?.trim();
          const originNotes = customNote
            ? `${isLoanGiven ? 'Loan given to' : 'Loan received from'} ${contactName} — ${customNote}`
            : `${isLoanGiven ? 'Loan given to' : 'Loan received from'} ${contactName}`;

          const originTx = await transactionRepository.create(
            {
              userId,
              amount: String(principalAmount),
              type: originTxType,
              walletId: targetWalletId,
              category: originCategory,
              notes: originNotes,
              createdAt: parsedLoanDate,
            },
            txDb
          );

          originTransactionId = originTx.id;

          await transactionRepository.createSplit(
            {
              transactionId: originTx.id,
              reimbursableAmount: String(principalAmount),
              linkedContactId: newDebt.id,
            },
            txDb
          );

          await coreAuditService.postJournalEntryForTransaction(
            userId,
            originTx,
            {
              idempotencyKey: `debt-origin-${originTx.id}`,
              memo: originNotes,
            },
            txDb
          );
        }

        return { debtId: newDebt.id, originTransactionId };
      });

      return {
        message: recordWalletMovement
          ? debtType === 'Receivable'
            ? 'Loan given recorded and deducted from wallet'
            : 'Loan received recorded and added to wallet'
          : 'Debt created',
        id: createdResult.debtId,
        originTransactionId: createdResult.originTransactionId,
      };
    }
  }

  async updateDebt(userId: string, debtId: string, dto: UpdateDebtDTO) {
    const debt = await debtRepository.findByIdAndUserId(debtId, userId);
    if (!debt) {
      throw new Error('Debt not found');
    }

    const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
    const currentOriginal = parseFloat(debt.originalAmount as unknown as string);
    const settledAmount = currentOriginal - currentRemaining;

    const newOriginal = dto.amount;
    if (!Number.isFinite(newOriginal) || newOriginal < settledAmount) {
      throw new Error('The original amount cannot be lower than the amount already settled.');
    }
    const newRemaining = newOriginal - settledAmount;

    await debtRepository.update(debtId, userId, {
      contactName: dto.contact,
      type: dto.type,
      originalAmount: String(newOriginal),
      remainingBalance: String(newRemaining),
      status: newRemaining <= 0.001 ? 'Cleared' : 'Pending',
      ...(dto.due_date !== undefined ? { dueDate: this.parseDueDate(dto.due_date) } : {}),
    });

    return { message: 'Debt updated' };
  }

  private parseDueDate(value?: string) {
    if (!value) return undefined;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid due date');
    const date = new Date(`${value}T12:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new Error('Invalid due date');
    }
    return date;
  }

  async deleteDebt(userId: string, debtId: string) {
    await debtRepository.deleteByIdAndUserId(debtId, userId);
    return { message: 'Debt deleted' };
  }
}

export const debtService = new DebtService();
