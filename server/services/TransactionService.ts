import { transactionRepository } from '../repositories/TransactionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { walletService } from './WalletService.js';
import { normalizeCategory } from '../../src/lib/categories.js';

export interface SplitInput {
  id?: string;
  reimbursable_amount: number;
  linked_contact_name: string;
}

export interface CreateTransactionDTO {
  amount: number;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: string; // Wallet UUID
  destinationWalletId?: string;
  category?: string;
  notes?: string;
  transaction_date?: string;
  reimbursable_amount?: number;
  linked_contact_name?: string;
  splits?: SplitInput[];
  /** When present, this income is money borrowed and creates a payable debt. */
  loan_contact_name?: string;
  contextId?: string | null;
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

    const splitsByTxId = new Map<string, typeof allSplits>();
    for (const split of allSplits) {
      const list = splitsByTxId.get(split.transactionId) || [];
      list.push(split);
      splitsByTxId.set(split.transactionId, list);
    }
    const debtById = new Map(allDebts.map((debt) => [debt.id, debt]));

    return transactions.map((transaction) => {
      const txSplits = splitsByTxId.get(transaction.id) || [];
      const mappedSplits = txSplits.map((split) => {
        const linkedDebt = split.linkedContactId ? debtById.get(split.linkedContactId) : null;
        return {
          id: split.id,
          reimbursableAmount: split.reimbursableAmount,
          linkedContactId: split.linkedContactId,
          linkedContactName: linkedDebt?.contactName ?? null,
          linkedDebtType: linkedDebt?.type ?? null,
          remainingBalance: linkedDebt?.remainingBalance ?? null,
          status: linkedDebt?.status ?? null,
        };
      });

      const firstDebt = mappedSplits[0]?.linkedContactId ? debtById.get(mappedSplits[0].linkedContactId) : null;
      const isPayableDebt = firstDebt?.type === 'Payable' || transaction.category === 'Debt Repayment';

      // Total reimbursable amount across all Receivable splits
      const totalReimbursable = mappedSplits
        .filter((s) => s.linkedDebtType === 'Receivable' || (!s.linkedDebtType && transaction.type === 'Expense'))
        .reduce((sum, s) => sum + (parseFloat(s.reimbursableAmount || '0') || 0), 0);

      const contactNames = mappedSplits
        .map((s) => s.linkedContactName)
        .filter(Boolean) as string[];

      return {
        ...transaction,
        category: normalizeCategory(transaction.category),
        // Only Receivable debts represent money that is reimbursable to the user!
        // A Payable debt settlement or repayment is an out-of-pocket obligation and not reimbursable.
        reimbursableAmount: isPayableDebt || totalReimbursable <= 0 ? null : String(totalReimbursable),
        linkedContactId: mappedSplits[0]?.linkedContactId || null,
        linkedContactName: contactNames.length > 0 ? contactNames.join(', ') : null,
        linkedDebtType: mappedSplits[0]?.linkedDebtType ?? null,
        splits: mappedSplits,
      };
    });
  }

  async resolveWalletId(userId: string, requestedWalletId?: string | null, fallbackType: 'Bank' | 'Cash' = 'Bank'): Promise<string> {
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    try {
      const wallets = await walletService.getWallets(userId);
      if (requestedWalletId && uuidPattern.test(requestedWalletId)) {
        const match = wallets.find((w) => w.id === requestedWalletId);
        if (match) return match.id;
      }

      if (requestedWalletId === 'Cash' || fallbackType === 'Cash') {
        const cashWallet = wallets.find((w) => w.type === 'Cash') || wallets[0];
        if (cashWallet) return cashWallet.id;
      }

      const mainBank = wallets.find((w) => w.type === 'Bank' && w.isMain) 
        || wallets.find((w) => w.type === 'Bank') 
        || wallets[0];
      return mainBank?.id || requestedWalletId || '';
    } catch {
      return requestedWalletId || '';
    }
  }

  async resolveOptionalWalletId(userId: string, requestedWalletId?: string | null): Promise<string | null> {
    if (!requestedWalletId) return null;
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (uuidPattern.test(requestedWalletId)) {
      return requestedWalletId;
    }
    try {
      const wallets = await walletService.getWallets(userId);
      if (requestedWalletId === 'Cash') {
        const cashWallet = wallets.find((w) => w.type === 'Cash') || wallets[0];
        return cashWallet ? cashWallet.id : null;
      }
      if (requestedWalletId === 'Bank') {
        const bankWallet = wallets.find((w) => w.type === 'Bank' && w.isMain) || wallets.find((w) => w.type === 'Bank') || wallets[0];
        return bankWallet ? bankWallet.id : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  async createTransaction(userId: string, dto: CreateTransactionDTO) {
    this.validateAmount(dto.amount);
    
    // Normalize splits from DTO:
    let splitList: SplitInput[] = [];
    if (Array.isArray(dto.splits) && dto.splits.length > 0) {
      splitList = dto.splits
        .map((s) => ({
          ...s,
          reimbursable_amount: Number(s.reimbursable_amount),
          linked_contact_name: (s.linked_contact_name || '').trim(),
        }))
        .filter((s) => s.reimbursable_amount > 0 && s.linked_contact_name.length > 0);
    } else if (dto.reimbursable_amount && dto.reimbursable_amount > 0 && dto.linked_contact_name?.trim()) {
      splitList = [{
        reimbursable_amount: Number(dto.reimbursable_amount),
        linked_contact_name: dto.linked_contact_name.trim(),
      }];
    }

    const totalReimbursable = splitList.reduce((sum, s) => sum + s.reimbursable_amount, 0);
    if (splitList.length > 0) {
      if (dto.type !== 'Expense') {
        throw new Error('Only expense transactions can be split or reimbursable');
      }
      if (totalReimbursable > dto.amount) {
        throw new Error(`Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed transaction amount (${dto.amount.toFixed(2)} MAD)`);
      }
    }

    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName && dto.type !== 'Income') throw new Error('A loan received must be an income transaction');
    if (loanContactName && splitList.length > 0) throw new Error('A loan received cannot also be reimbursable');
    const createdAt = this.parseTransactionDate(dto.transaction_date);

    const resolvedWalletId = await this.resolveWalletId(userId, dto.walletId);
    const resolvedDestWalletId = await this.resolveOptionalWalletId(userId, dto.destinationWalletId);

    const newTx = await transactionRepository.create({
      userId,
      amount: String(dto.amount),
      type: dto.type,
      walletId: resolvedWalletId,
      destinationWalletId: resolvedDestWalletId,
      category: normalizeCategory(loanContactName ? '🤝 Loan Received' : dto.category),
      notes: dto.notes,
      createdAt,
      contextId: dto.contextId || null,
    });

    for (const split of splitList) {
      const newDebt = await debtRepository.create({
        userId,
        contactName: split.linked_contact_name,
        type: 'Receivable',
        originalAmount: String(split.reimbursable_amount),
        remainingBalance: String(split.reimbursable_amount),
        status: 'Pending',
        createdAt,
      });

      await transactionRepository.createSplit({
        transactionId: newTx.id,
        reimbursableAmount: String(split.reimbursable_amount),
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

    const createdAt = this.parseTransactionDate(dto.transaction_date);
    if (current.payrollId) {
      await this.syncPostedPayroll(userId, current.payrollId, dto.amount, createdAt);
    }

    const existingSplits = await transactionRepository.findSplitsByTransactionId(transactionId);
    const splitsProvided = dto.splits !== undefined || dto.reimbursable_amount !== undefined;

    if (current.type !== 'Expense' && splitsProvided && ((dto.splits && dto.splits.length > 0) || (dto.reimbursable_amount && dto.reimbursable_amount > 0))) {
      throw new Error('Only expense transactions can be reimbursable');
    }

    if (current.type === 'Expense' && splitsProvided) {
      let updatedSplitsList: SplitInput[] = [];
      if (Array.isArray(dto.splits)) {
        updatedSplitsList = dto.splits
          .map((s) => ({
            id: s.id,
            reimbursable_amount: Number(s.reimbursable_amount),
            linked_contact_name: (s.linked_contact_name || '').trim(),
          }))
          .filter((s) => s.reimbursable_amount > 0 && s.linked_contact_name.length > 0);
      } else if (dto.reimbursable_amount !== undefined) {
        if (dto.reimbursable_amount > 0 && dto.linked_contact_name?.trim()) {
          updatedSplitsList = [{
            id: existingSplits[0]?.id,
            reimbursable_amount: Number(dto.reimbursable_amount),
            linked_contact_name: dto.linked_contact_name.trim(),
          }];
        }
      }

      const totalReimbursable = updatedSplitsList.reduce((sum, s) => sum + s.reimbursable_amount, 0);
      if (totalReimbursable > dto.amount) {
        throw new Error(`Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed transaction amount (${dto.amount.toFixed(2)} MAD)`);
      }

      // Handle removed splits
      const updatedSplitIds = new Set(updatedSplitsList.map((s) => s.id).filter(Boolean));
      for (const existingSplit of existingSplits) {
        if (!updatedSplitIds.has(existingSplit.id)) {
          if (existingSplit.linkedContactId) {
            const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId);
            if (debt) {
              const originalAmount = parseFloat(debt.originalAmount as unknown as string);
              const remainingBalance = parseFloat(debt.remainingBalance as unknown as string);
              const settledAmount = originalAmount - remainingBalance;
              if (settledAmount > 0.001) {
                throw new Error(`Cannot remove split for ${debt.contactName} because a settlement of ${settledAmount.toFixed(2)} MAD has already been received.`);
              }
              const linkedSplits = await transactionRepository.findSplitsByDebtId(debt.id);
              if (linkedSplits.some((s) => s.transactionId !== transactionId)) {
                throw new Error(`This reimbursement for ${debt.contactName} has settlements. Adjust the debt before removing it.`);
              }
              await transactionRepository.deleteSplitById(existingSplit.id);
              await debtRepository.deleteByIdAndUserId(debt.id, userId);
            } else {
              await transactionRepository.deleteSplitById(existingSplit.id);
            }
          } else {
            await transactionRepository.deleteSplitById(existingSplit.id);
          }
        }
      }

      // Handle existing and new splits in updatedSplitsList
      for (const splitDto of updatedSplitsList) {
        if (splitDto.id) {
          const existingSplit = existingSplits.find((s) => s.id === splitDto.id);
          if (existingSplit && existingSplit.linkedContactId) {
            const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId);
            if (debt) {
              const oldReimbursableAmount = parseFloat(existingSplit.reimbursableAmount as unknown as string);
              const originalAmount = parseFloat(debt.originalAmount as unknown as string);
              const settledAmount = originalAmount - parseFloat(debt.remainingBalance as unknown as string);

              if (splitDto.reimbursable_amount < settledAmount) {
                throw new Error(`The reimbursement for ${debt.contactName} cannot be lower than the amount already settled (${settledAmount.toFixed(2)} MAD).`);
              }

              const newOriginalAmount = originalAmount + (splitDto.reimbursable_amount - oldReimbursableAmount);
              await debtRepository.update(debt.id, userId, {
                originalAmount: String(newOriginalAmount),
                remainingBalance: String(newOriginalAmount - settledAmount),
                status: Math.abs(newOriginalAmount - settledAmount) <= 0.001 ? 'Cleared' : 'Pending',
                contactName: splitDto.linked_contact_name,
              });
              await transactionRepository.updateSplit(existingSplit.id, {
                reimbursableAmount: String(splitDto.reimbursable_amount),
              });
            }
          }
        } else {
          // New split
          const newDebt = await debtRepository.create({
            userId,
            contactName: splitDto.linked_contact_name,
            type: 'Receivable',
            originalAmount: String(splitDto.reimbursable_amount),
            remainingBalance: String(splitDto.reimbursable_amount),
            status: 'Pending',
            createdAt,
          });
          await transactionRepository.createSplit({
            transactionId,
            reimbursableAmount: String(splitDto.reimbursable_amount),
            linkedContactId: newDebt.id,
          });
        }
      }
    }

    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName) {
      const loanSplit = existingSplits[0];
      if (current.type !== 'Income' || !loanSplit?.linkedContactId) {
        throw new Error('This transaction is not a loan received');
      }
      const debt = await debtRepository.findByIdAndUserId(loanSplit.linkedContactId, userId);
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
      await transactionRepository.updateSplit(loanSplit.id, { reimbursableAmount: String(dto.amount) });
    }

    const updatePayload: any = {
      amount: String(dto.amount),
      category: normalizeCategory(loanContactName ? '🤝 Loan Received' : dto.category),
      notes: dto.notes,
      ...(createdAt ? { createdAt } : {}),
      ...(dto.contextId !== undefined ? { contextId: dto.contextId || null } : {}),
    };

    if (dto.walletId !== undefined) {
      updatePayload.walletId = await this.resolveWalletId(userId, dto.walletId);
    }
    if (dto.destinationWalletId !== undefined) {
      updatePayload.destinationWalletId = await this.resolveOptionalWalletId(userId, dto.destinationWalletId);
    }

    const updated = await transactionRepository.update(transactionId, userId, updatePayload);
    return updated;
  }

  private parseTransactionDate(date?: string) {
    if (!date) return undefined;

    if (typeof date === 'string' && date.includes('T')) {
      const parsedDate = new Date(date);
      if (!Number.isNaN(parsedDate.getTime())) {
        return parsedDate;
      }
    }

    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const parsedDate = new Date(`${date}T12:00:00.000Z`);
      if (!Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === date) {
        return parsedDate;
      }
    }

    throw new Error('Invalid transaction date');
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
            const splitReimbNum = parseFloat(split.reimbursableAmount as unknown as string);
            const reimbAmount = splitReimbNum > 0 ? splitReimbNum : (parseFloat(transaction.amount as unknown as string) || 0);
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
