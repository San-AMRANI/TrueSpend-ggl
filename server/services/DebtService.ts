import { debtRepository } from '../repositories/DebtRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { walletService } from './WalletService.js';

export interface SettleDebtDTO {
  amount: number;
  contact?: string;
  type?: 'Receivable' | 'Payable';
  debt_id?: string;
  due_date?: string;
  /** Wallet that sends or receives the settlement money. */
  walletId?: string;
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
}

export class DebtService {
  async getDebtsWithSettlements(userId: string) {
    const [allDebts, allSplits, allTxs, forgivenessLogs] = await Promise.all([
      debtRepository.findAllByUserId(userId),
      debtRepository.findAllLinkedSplits(),
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

      return {
        ...debt,
        remainingBalance: remainingNum <= 0.001 ? '0' : debt.remainingBalance,
        status: correctedStatus,
        settlements,
        forgivenAmount: totalForgivenNum > 0.001 ? totalForgivenNum.toFixed(2) : undefined,
        originTransactionId,
        originDescription,
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

  async processDebt(userId: string, dto: SettleDebtDTO) {
    if (dto.debt_id) {
      if (dto.isForgiven) {
        return await this.forgiveDebt(userId, dto.debt_id, {
          amount: dto.amount,
          reason: dto.reason,
          note: dto.note,
        });
      }

      const debt = await debtRepository.findByIdAndUserId(dto.debt_id, userId);
      if (!debt) {
        throw new Error('Debt not found');
      }

      const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
      const newRemaining = Math.max(0, Number((currentRemaining - dto.amount).toFixed(2)));

      await debtRepository.update(dto.debt_id, userId, {
        remainingBalance: newRemaining <= 0.001 ? '0' : String(newRemaining),
        status: newRemaining <= 0.001 ? 'Cleared' : 'Pending',
      });

      const txType = debt.type === 'Receivable' ? 'Income' : 'Expense';
      const txCategory = dto.category || (debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment');

      let targetWalletId: string;
      try {
        const wallets = await walletService.getWallets(userId);
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (dto.walletId && uuidRegex.test(dto.walletId)) {
          const found = wallets.find((w) => w.id === dto.walletId);
          targetWalletId = found ? found.id : wallets[0]?.id;
        } else if (dto.walletId === 'Bank') {
          const bankWallet =
            wallets.find((w) => w.type === 'Bank' && w.isMain) ||
            wallets.find((w) => w.type === 'Bank') ||
            wallets[0];
          targetWalletId = bankWallet?.id;
        } else {
          const cashWallet = wallets.find((w) => w.type === 'Cash') || wallets[0];
          targetWalletId = cashWallet?.id;
        }
      } catch {
        targetWalletId = dto.walletId as string;
      }

      const newTx = await transactionRepository.create({
        userId,
        amount: String(dto.amount),
        type: txType,
        walletId: targetWalletId,
        category: txCategory,
        notes: `Settlement for ${debt.contactName}`,
      });

      await transactionRepository.createSplit({
        transactionId: newTx.id,
        // Only Receivable settlements are reimbursable to the user; Payable settlements are bill/debt payments.
        reimbursableAmount: debt.type === 'Receivable' ? String(dto.amount) : '0',
        linkedContactId: dto.debt_id,
      });

      return { message: 'Debt settled' };
    } else {
      const newDebt = await debtRepository.create({
        userId,
        contactName: dto.contact || 'Unknown',
        type: dto.type || 'Receivable',
        originalAmount: String(dto.amount),
        remainingBalance: String(dto.amount),
        status: 'Pending',
        dueDate: this.parseDueDate(dto.due_date),
      });
      return { message: 'Debt created', id: newDebt.id };
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
