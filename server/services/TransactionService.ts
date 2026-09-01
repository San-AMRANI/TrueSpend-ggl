import { transactionRepository } from '../repositories/TransactionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { normalizeCategory } from '../../src/lib/categories.js';

export interface CreateTransactionDTO {
  amount: number;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  source_wallet: 'Bank' | 'Cash';
  category?: string;
  notes?: string;
  transaction_date?: string;
  reimbursable_amount?: number;
  linked_contact_name?: string;
  /** When present, this income is money borrowed and creates a payable debt. */
  loan_contact_name?: string;
}

export interface UpdateTransactionDTO extends Omit<CreateTransactionDTO, 'type'> {
  type?: CreateTransactionDTO['type'];
}

export class TransactionService {
  async getTransactionsForUser(userId: string) {
    const transactions = await transactionRepository.findAllByUserId(userId);
    const [allSplits, allDebts] = await Promise.all([
      transactionRepository.findSplitsByTransactionIds(transactions.map((transaction) => transaction.id)),
      debtRepository.findAllByUserId(userId),
    ]);
    const splitByTransactionId = new Map(allSplits.map((split) => [split.transactionId, split]));
    const debtById = new Map(allDebts.map((debt) => [debt.id, debt]));
    return transactions.map((transaction) => {
      const split = splitByTransactionId.get(transaction.id);
      return {
        ...transaction,
        category: normalizeCategory(transaction.category),
        reimbursableAmount: split?.reimbursableAmount,
        linkedContactId: split?.linkedContactId,
        linkedContactName: split?.linkedContactId ? debtById.get(split.linkedContactId)?.contactName : null,
        linkedDebtType: split?.linkedContactId ? debtById.get(split.linkedContactId)?.type : null,
      };
    });
  }

  async createTransaction(userId: string, dto: CreateTransactionDTO) {
    this.validateAmount(dto.amount);
    this.validateReimbursement(dto.amount, dto.reimbursable_amount);
    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName && dto.type !== 'Income') throw new Error('A loan received must be an income transaction');
    if (loanContactName && dto.reimbursable_amount) throw new Error('A loan received cannot also be reimbursable');
    const createdAt = this.parseTransactionDate(dto.transaction_date);
    const newTx = await transactionRepository.create({
      userId,
      amount: String(dto.amount),
      type: dto.type,
      sourceWallet: dto.source_wallet,
      category: normalizeCategory(loanContactName ? '🤝 Loan Received' : dto.category),
      notes: dto.notes,
      createdAt,
    });

    if (dto.reimbursable_amount && dto.reimbursable_amount > 0 && dto.linked_contact_name) {
      const newDebt = await debtRepository.create({
        userId,
        contactName: dto.linked_contact_name,
        type: 'Receivable',
        originalAmount: String(dto.reimbursable_amount),
        remainingBalance: String(dto.reimbursable_amount),
        status: 'Pending',
      });

      await transactionRepository.createSplit({
        transactionId: newTx.id,
        reimbursableAmount: String(dto.reimbursable_amount),
        linkedContactId: newDebt.id,
      });
    }

    if (loanContactName) {
      const newDebt = await debtRepository.create({
        userId,
        contactName: loanContactName,
        type: 'Payable',
        originalAmount: String(dto.amount),
        remainingBalance: String(dto.amount),
        status: 'Pending',
        createdAt,
      });
      await transactionRepository.createSplit({
        transactionId: newTx.id,
        reimbursableAmount: String(dto.amount),
        linkedContactId: newDebt.id,
      });
    }

    return newTx;
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateTransactionDTO) {
    const current = await transactionRepository.findByIdAndUserId(transactionId, userId);
    if (!current) throw new Error('Transaction not found');
    if (dto.type && dto.type !== current.type) {
      throw new Error('Transaction type cannot be changed. Delete and create a new transaction instead.');
    }
    this.validateAmount(dto.amount);
    this.validateReimbursement(dto.amount, dto.reimbursable_amount);

    const createdAt = this.parseTransactionDate(dto.transaction_date);
    if (current.payrollId) {
      await this.syncPostedPayroll(userId, current.payrollId, dto.amount, createdAt);
    }
    const existingSplit = (await transactionRepository.findSplitsByTransactionId(transactionId))[0];
    const reimbursementWasUpdated = dto.reimbursable_amount !== undefined;

    if (current.type !== 'Expense' && reimbursementWasUpdated && dto.reimbursable_amount && dto.reimbursable_amount > 0) {
      throw new Error('Only expense transactions can be reimbursable');
    }

    if (current.type === 'Expense' && reimbursementWasUpdated) {
      const newReimbursableAmount = dto.reimbursable_amount || 0;
      if (existingSplit?.linkedContactId) {
        const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId);
        if (!debt) throw new Error('Linked debt not found');
        const oldReimbursableAmount = parseFloat(existingSplit.reimbursableAmount as unknown as string);
        const originalAmount = parseFloat(debt.originalAmount as unknown as string);
        const settledAmount = originalAmount - parseFloat(debt.remainingBalance as unknown as string);
        if (newReimbursableAmount < settledAmount) {
          throw new Error('The reimbursement cannot be lower than the amount already settled.');
        }

        if (newReimbursableAmount === 0) {
          const linkedSplits = await transactionRepository.findSplitsByDebtId(debt.id);
          if (linkedSplits.some((split) => split.transactionId !== transactionId)) {
            throw new Error('This reimbursement has settlements. Adjust the debt before removing it from the expense.');
          }
          await transactionRepository.deleteSplitById(existingSplit.id);
          await debtRepository.deleteByIdAndUserId(debt.id, userId);
        } else {
          const newOriginalAmount = originalAmount + (newReimbursableAmount - oldReimbursableAmount);
          await debtRepository.update(debt.id, userId, {
            originalAmount: String(newOriginalAmount),
            remainingBalance: String(newOriginalAmount - settledAmount),
            status: newOriginalAmount === settledAmount ? 'Cleared' : 'Pending',
            ...(dto.linked_contact_name ? { contactName: dto.linked_contact_name.trim() } : {}),
          });
          await transactionRepository.updateSplit(existingSplit.id, { reimbursableAmount: String(newReimbursableAmount) });
        }
      } else if (newReimbursableAmount > 0) {
        const contactName = dto.linked_contact_name?.trim();
        if (!contactName) throw new Error('A contact name is required for a reimbursable expense');
        const debt = await debtRepository.create({
          userId,
          contactName,
          type: 'Receivable',
          originalAmount: String(newReimbursableAmount),
          remainingBalance: String(newReimbursableAmount),
          status: 'Pending',
        });
        await transactionRepository.createSplit({
          transactionId,
          reimbursableAmount: String(newReimbursableAmount),
          linkedContactId: debt.id,
        });
      }
    }

    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName) {
      if (current.type !== 'Income' || !existingSplit?.linkedContactId) {
        throw new Error('This transaction is not a loan received');
      }
      const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId);
      if (!debt || debt.type !== 'Payable') throw new Error('Linked loan debt not found');
      const originalAmount = parseFloat(debt.originalAmount as unknown as string);
      const remainingAmount = parseFloat(debt.remainingBalance as unknown as string);
      const settledAmount = originalAmount - remainingAmount;
      if (dto.amount < settledAmount) {
        throw new Error('The loan amount cannot be lower than the amount already repaid.');
      }
      await debtRepository.update(debt.id, userId, {
        contactName: loanContactName,
        originalAmount: String(dto.amount),
        remainingBalance: String(dto.amount - settledAmount),
        status: dto.amount === settledAmount ? 'Cleared' : 'Pending',
      });
      await transactionRepository.updateSplit(existingSplit.id, { reimbursableAmount: String(dto.amount) });
    }

    const updated = await transactionRepository.update(transactionId, userId, {
      amount: String(dto.amount),
      sourceWallet: dto.source_wallet,
      category: normalizeCategory(loanContactName ? '🤝 Loan Received' : dto.category),
      notes: dto.notes,
      ...(createdAt ? { createdAt } : {}),
    });
    return updated;
  }

  private parseTransactionDate(date?: string) {
    if (!date) return undefined;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new Error('Invalid transaction date');
    }

    const parsedDate = new Date(`${date}T12:00:00.000Z`);
    if (Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      throw new Error('Invalid transaction date');
    }

    return parsedDate;
  }

  async deleteTransaction(userId: string, transactionId: string) {
    const transaction = await transactionRepository.findByIdAndUserId(transactionId, userId);
    if (!transaction) throw new Error('Transaction not found');

    const relatedSplits = await transactionRepository.findSplitsByTransactionId(transactionId);

    for (const split of relatedSplits) {
      if (split.linkedContactId) {
        const debt = await debtRepository.findByIdAndUserId(split.linkedContactId, userId);
        if (debt) {
          const isOriginalTransaction =
            (debt.type === 'Receivable' && transaction.type === 'Expense') ||
            (debt.type === 'Payable' && transaction.type === 'Income');
          if (isOriginalTransaction) {
            // Deleting the original reimbursable expense or loan receipt deletes its debt and settlements.
            const linkedSplits = await transactionRepository.findSplitsByDebtId(debt.id);
            for (const linkedSplit of linkedSplits) {
              if (linkedSplit.transactionId !== transactionId) {
                // Delete settlement splits and settlement transaction
                await transactionRepository.deleteSplitsByTransactionId(linkedSplit.transactionId);
                await transactionRepository.deleteByIdAndUserId(linkedSplit.transactionId, userId);
              } else {
                // Delete the split for this original expense
                await transactionRepository.deleteSplitById(linkedSplit.id);
              }
            }
            // All splits referencing debt.id are deleted, now delete debt
            await debtRepository.deleteByIdAndUserId(debt.id, userId);
          } else {
            // Deleting a settlement transaction -> restore debt balance
            const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
            const reimbAmount = parseFloat(split.reimbursableAmount as unknown as string);
            const originalAmount = parseFloat(debt.originalAmount as unknown as string);
            const newRemaining = Math.min(originalAmount, currentRemaining + reimbAmount);

            await debtRepository.update(debt.id, userId, {
              remainingBalance: String(newRemaining),
              status: newRemaining <= 0 ? 'Cleared' : 'Pending',
            });
          }
        }
      }
    }

    // Delete any remaining splits for this transaction
    await transactionRepository.deleteSplitsByTransactionId(transactionId);
    // Delete the transaction itself
    await transactionRepository.deleteByIdAndUserId(transactionId, userId);
  }

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');
  }

  private validateReimbursement(amount: number, reimbursableAmount?: number) {
    if (reimbursableAmount === undefined) return;
    if (!Number.isFinite(reimbursableAmount) || reimbursableAmount < 0 || reimbursableAmount > amount) {
      throw new Error('Reimbursable amount must be between zero and the transaction amount');
    }
  }

  private async syncPostedPayroll(userId: string, payrollId: string, amount: number, scheduledFor?: Date) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId);
    if (!payroll) throw new Error('Linked payroll not found');

    const payrollDate = scheduledFor || new Date(payroll.scheduledFor);
    const start = new Date(Date.UTC(payrollDate.getUTCFullYear(), payrollDate.getUTCMonth(), 1));
    const end = new Date(Date.UTC(payrollDate.getUTCFullYear(), payrollDate.getUTCMonth() + 1, 1));
    const existingForMonth = await payrollRepository.findForMonth(userId, start, end, payrollId);
    if (existingForMonth) throw new Error('This calendar month already has a payroll. Choose another date.');

    await payrollRepository.update(payrollId, userId, {
      scheduledFor: payrollDate,
      amount: String(amount),
    });
  }
}

export const transactionService = new TransactionService();
