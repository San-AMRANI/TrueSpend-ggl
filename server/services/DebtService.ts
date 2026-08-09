import { debtRepository } from '../repositories/DebtRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

export interface SettleDebtDTO {
  amount: number;
  contact?: string;
  type?: 'Receivable' | 'Payable';
  debt_id?: string;
}

export interface UpdateDebtDTO {
  amount: number;
  contact: string;
  type: 'Receivable' | 'Payable';
}

export class DebtService {
  async getDebtsWithSettlements(userId: string) {
    const allDebts = await debtRepository.findAllByUserId(userId);
    const allSplits = await debtRepository.findAllLinkedSplits();
    const allTxs = await transactionRepository.findAllByUserId(userId);

    return allDebts.map((debt) => {
      const debtSplits = allSplits.filter((s) => s.linkedContactId === debt.id);
      const settlements = debtSplits
        .map((s) => {
          const tx = allTxs.find((t) => t.id === s.transactionId);
          return {
            id: s.id,
            amount: s.reimbursableAmount,
            createdAt: tx ? tx.createdAt : debt.createdAt,
          };
        })
        .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());

      return {
        ...debt,
        settlements,
      };
    });
  }

  async processDebt(userId: string, dto: SettleDebtDTO) {
    if (dto.debt_id) {
      const debt = await debtRepository.findByIdAndUserId(dto.debt_id, userId);
      if (!debt) {
        throw new Error('Debt not found');
      }

      const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
      const newRemaining = currentRemaining - dto.amount;

      await debtRepository.update(dto.debt_id, userId, {
        remainingBalance: String(newRemaining),
        status: newRemaining <= 0 ? 'Cleared' : 'Pending',
      });

      const txType = debt.type === 'Receivable' ? 'Income' : 'Expense';
      const txCategory = debt.type === 'Receivable' ? 'Reimbursement' : 'Debt Repayment';

      const newTx = await transactionRepository.create({
        userId,
        amount: String(dto.amount),
        type: txType,
        sourceWallet: 'Bank',
        category: txCategory,
        notes: `Settlement for ${debt.contactName}`,
      });

      await transactionRepository.createSplit({
        transactionId: newTx.id,
        reimbursableAmount: String(dto.amount),
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
    let newRemaining = newOriginal - settledAmount;

    await debtRepository.update(debtId, userId, {
      contactName: dto.contact,
      type: dto.type,
      originalAmount: String(newOriginal),
      remainingBalance: String(newRemaining),
      status: newRemaining <= 0 ? 'Cleared' : 'Pending',
    });

    return { message: 'Debt updated' };
  }

  async deleteDebt(userId: string, debtId: string) {
    await debtRepository.deleteByIdAndUserId(debtId, userId);
    return { message: 'Debt deleted' };
  }
}

export const debtService = new DebtService();
