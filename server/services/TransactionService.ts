import { and, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { counterparties, transactions } from '../../src/db/schema.js';
import { transactionRepository, DbExecutor } from '../repositories/TransactionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { walletService } from './WalletService.js';
import { normalizeCategory } from '../../src/lib/categories.js';
import { coreAuditService } from './CoreAuditService.js';

export interface SplitInput {
  id?: string;
  reimbursable_amount: number;
  linked_contact_name: string;
}

export interface CreateTransactionDTO {
  amount: number;
  nativeAmount?: number;
  currency?: string;
  exchangeRateUsed?: number;
  idempotencyKey?: string;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: string; // Wallet UUID
  destinationWalletId?: string;
  category?: string;
  notes?: string;
  transaction_date?: string;
  reimbursable_amount?: number;
  linked_contact_name?: string;
  splits?: SplitInput[];
  /** When present on an Income transaction, this income is money borrowed and creates a payable debt. */
  loan_contact_name?: string;
  /** When present on an Expense transaction, represents the unpaid portion of a partially paid bill (creates a Payable debt). */
  unpaid_amount?: number;
  unpaid_contact_name?: string;
  unpaid_due_date?: string;
  contextId?: string | null;
  counterpartyId?: string | null;
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
          originalDebtAmount: linkedDebt?.originalAmount ?? null,
        };
      });

      const partialPayableSplit =
        transaction.type === 'Expense' && transaction.category !== 'Debt Repayment'
          ? mappedSplits.find(
              (s) =>
                s.linkedDebtType === 'Payable' &&
                (parseFloat(s.reimbursableAmount || '0') > 0 ||
                  parseFloat(s.originalDebtAmount || '0') > 0)
            )
          : undefined;

      const receivableSplits = mappedSplits.filter(
        (s) => s.linkedDebtType === 'Receivable' || (!s.linkedDebtType && transaction.type === 'Expense')
      );

      const firstDebt = mappedSplits[0]?.linkedContactId
        ? debtById.get(mappedSplits[0].linkedContactId)
        : null;
      const isPayableSettlementOrLoan =
        (firstDebt?.type === 'Payable' && !partialPayableSplit && receivableSplits.length === 0) ||
        transaction.category === 'Debt Repayment';

      const totalReimbursable = receivableSplits.reduce(
        (sum, s) =>
          sum +
          (parseFloat(s.reimbursableAmount || '0') ||
            parseFloat(s.originalDebtAmount || '0') ||
            0),
        0
      );

      const contactNames = receivableSplits
        .map((s) => s.linkedContactName)
        .filter(Boolean) as string[];

      const paidNowNum = parseFloat(transaction.amount as unknown as string) || 0;
      const unpaidOrigNum = partialPayableSplit
        ? parseFloat(partialPayableSplit.originalDebtAmount || partialPayableSplit.reimbursableAmount || '0') || 0
        : 0;

      return {
        ...transaction,
        category: normalizeCategory(transaction.category),
        reimbursableAmount:
          isPayableSettlementOrLoan || totalReimbursable <= 0 ? null : String(totalReimbursable),
        linkedContactId:
          receivableSplits[0]?.linkedContactId || mappedSplits[0]?.linkedContactId || null,
        linkedContactName:
          contactNames.length > 0
            ? contactNames.join(', ')
            : partialPayableSplit?.linkedContactName || mappedSplits[0]?.linkedContactName || null,
        linkedDebtType:
          receivableSplits.length > 0
            ? 'Receivable'
            : mappedSplits[0]?.linkedDebtType ?? null,
        splits: mappedSplits,
        isPartialPayment: Boolean(partialPayableSplit && unpaidOrigNum > 0),
        unpaidAmount: partialPayableSplit && unpaidOrigNum > 0 ? unpaidOrigNum.toFixed(2) : null,
        totalBillAmount:
          partialPayableSplit && unpaidOrigNum > 0
            ? (paidNowNum + unpaidOrigNum).toFixed(2)
            : null,
        unpaidRemainingBalance: partialPayableSplit ? partialPayableSplit.remainingBalance : null,
        unpaidStatus: partialPayableSplit ? partialPayableSplit.status : null,
        unpaidDebtId: partialPayableSplit ? partialPayableSplit.linkedContactId : null,
        unpaidContactName: partialPayableSplit ? partialPayableSplit.linkedContactName : null,
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

      const mainBank =
        wallets.find((w) => w.type === 'Bank' && w.isMain) ||
        wallets.find((w) => w.type === 'Bank') ||
        wallets[0];
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
        const bankWallet =
          wallets.find((w) => w.type === 'Bank' && w.isMain) ||
          wallets.find((w) => w.type === 'Bank') ||
          wallets[0];
        return bankWallet ? bankWallet.id : null;
      }
    } catch {
      return null;
    }
    return null;
  }

  private async resolveMatchingCounterpartyId(userId: string, text?: string | null, explicitId?: string | null, exec: DbExecutor = db): Promise<string | null> {
    if (explicitId) return explicitId;
    if (!text || !text.trim()) return null;
    const normNotes = coreAuditService.normalizeCounterpartyName(text);
    if (!normNotes) return null;
    const userCounterparties = await exec
      .select()
      .from(counterparties)
      .where(eq(counterparties.userId, userId));
    for (const cp of userCounterparties) {
      const aliases: string[] = (() => {
        try {
          return JSON.parse(cp.aliasesJson || '[]');
        } catch {
          return [];
        }
      })();
      const candidates = [cp.canonicalName, ...aliases].map((s) => coreAuditService.normalizeCounterpartyName(s)).filter(Boolean);
      if (candidates.some((c) => normNotes.includes(c))) {
        return cp.id;
      }
    }
    return null;
  }

  async createTransaction(userId: string, dto: CreateTransactionDTO) {
    this.validateAmount(dto.amount);

    const cleanIdempKey = dto.idempotencyKey && dto.idempotencyKey.trim() ? dto.idempotencyKey.trim() : null;
    if (cleanIdempKey) {
      const existingByKey = await db
        .select()
        .from(transactions)
        .where(and(eq(transactions.userId, userId), eq(transactions.idempotencyKey, cleanIdempKey)))
        .limit(1);
      if (existingByKey.length > 0) {
        return existingByKey[0];
      }
    }

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
      splitList = [
        {
          reimbursable_amount: Number(dto.reimbursable_amount),
          linked_contact_name: dto.linked_contact_name.trim(),
        },
      ];
    }

    const totalReimbursable = splitList.reduce((sum, s) => sum + s.reimbursable_amount, 0);
    if (splitList.length > 0) {
      if (dto.type !== 'Expense') {
        throw new Error('Only expense transactions can be split or reimbursable');
      }
      if (totalReimbursable > dto.amount) {
        throw new Error(
          `Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed transaction amount (${dto.amount.toFixed(2)} MAD)`
        );
      }
    }

    const unpaidAmount = Number(dto.unpaid_amount || 0);
    const unpaidContactName = (dto.unpaid_contact_name || '').trim();
    if (unpaidAmount > 0) {
      if (dto.type !== 'Expense') {
        throw new Error('Partial / uncompleted payment is only supported for expense transactions');
      }
      if (!unpaidContactName) {
        throw new Error('Please specify who you still owe for the remaining unpaid balance');
      }
    }

    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName && dto.type !== 'Income') {
      throw new Error('A loan received must be an income transaction');
    }
    if (loanContactName && splitList.length > 0) {
      throw new Error('A loan received cannot also be reimbursable');
    }

    const createdAt = this.parseTransactionDate(dto.transaction_date);
    const unpaidDueDate = this.parseTransactionDate(dto.unpaid_due_date);
    const resolvedWalletId = await this.resolveWalletId(userId, dto.walletId);
    const resolvedDestWalletId = await this.resolveOptionalWalletId(userId, dto.destinationWalletId);

    let assignedCategory = dto.category;
    if (loanContactName) {
      assignedCategory = '🤝 Loan Received';
    } else if (dto.type === 'Transfer' && resolvedDestWalletId) {
      try {
        const wallets = await walletService.getWallets(userId);
        const destWallet = wallets.find((w) => w.id === resolvedDestWalletId);
        const destType = destWallet?.type?.toLowerCase();
        if (destType === 'investment') {
          assignedCategory = '📈 Investments';
        } else if (destType === 'savings') {
          assignedCategory = '🛟 Emergency & goals Fund';
        } else if (
          !assignedCategory ||
          assignedCategory === '📈 Investments' ||
          assignedCategory === '🛟 Emergency & goals Fund'
        ) {
          assignedCategory = '🔄 Transfer';
        }
      } catch {
        if (!assignedCategory) assignedCategory = '🔄 Transfer';
      }
    }

    const requestedCurrency = (dto.currency || 'MAD').toUpperCase().trim();
    const effectiveDateStr = createdAt
      ? createdAt.toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10);
    const { rate: fxRate, source: fxSource } = await coreAuditService.resolveHistoricalRateToMad(
      userId,
      requestedCurrency,
      effectiveDateStr,
      dto.exchangeRateUsed
    );
    const nativeAmountNum =
      dto.nativeAmount !== undefined && Number.isFinite(Number(dto.nativeAmount))
        ? Number(dto.nativeAmount)
        : Number(dto.amount);
    const amountMadNum =
      requestedCurrency === 'MAD'
        ? Number(dto.amount)
        : dto.nativeAmount !== undefined
        ? Number((nativeAmountNum * fxRate).toFixed(2))
        : Number(dto.amount);

    const normalizedCat = normalizeCategory(assignedCategory);

    let createdTx: any;
    try {
      createdTx = await db.transaction(async (txDb) => {
        const matchedCpId = await this.resolveMatchingCounterpartyId(
          userId,
          dto.notes || loanContactName || unpaidContactName || '',
          dto.counterpartyId,
          txDb
        );

        const newTx = await transactionRepository.create(
          {
            userId,
            amount: String(amountMadNum),
            nativeAmount: String(nativeAmountNum),
            currency: requestedCurrency,
            exchangeRateUsed: String(fxRate),
            fxSource,
            idempotencyKey: cleanIdempKey,
            type: dto.type,
            walletId: resolvedWalletId,
            destinationWalletId: resolvedDestWalletId,
            category: normalizedCat,
            notes: dto.notes,
            createdAt,
            contextId: dto.contextId || null,
            counterpartyId: matchedCpId,
          },
          txDb
        );

        for (const split of splitList) {
          const splitCpId = await this.resolveMatchingCounterpartyId(userId, split.linked_contact_name, null, txDb);
          const newDebt = await debtRepository.create(
            {
              userId,
              contactName: split.linked_contact_name,
              type: 'Receivable',
              originalAmount: String(split.reimbursable_amount),
              remainingBalance: String(split.reimbursable_amount),
              status: 'Pending',
              createdAt,
              counterpartyId: splitCpId,
            },
            txDb
          );

          await transactionRepository.createSplit(
            {
              transactionId: newTx.id,
              reimbursableAmount: String(split.reimbursable_amount),
              linkedContactId: newDebt.id,
            },
            txDb
          );
        }

        if (unpaidAmount > 0 && unpaidContactName) {
          const unpaidCpId = await this.resolveMatchingCounterpartyId(userId, unpaidContactName, null, txDb);
          const newPayableDebt = await debtRepository.create(
            {
              userId,
              contactName: unpaidContactName,
              type: 'Payable',
              originalAmount: String(unpaidAmount),
              remainingBalance: String(unpaidAmount),
              status: 'Pending',
              dueDate: unpaidDueDate,
              createdAt,
              counterpartyId: unpaidCpId,
            },
            txDb
          );

          await transactionRepository.createSplit(
            {
              transactionId: newTx.id,
              reimbursableAmount: String(unpaidAmount),
              linkedContactId: newPayableDebt.id,
            },
            txDb
          );
        }

        if (loanContactName) {
          const loanCpId = await this.resolveMatchingCounterpartyId(userId, loanContactName, null, txDb);
          const newDebt = await debtRepository.create(
            {
              userId,
              contactName: loanContactName,
              type: 'Payable',
              originalAmount: String(amountMadNum),
              remainingBalance: String(amountMadNum),
              status: 'Pending',
              createdAt,
              counterpartyId: loanCpId,
            },
            txDb
          );
          await transactionRepository.createSplit(
            {
              transactionId: newTx.id,
              reimbursableAmount: String(amountMadNum),
              linkedContactId: newDebt.id,
            },
            txDb
          );
        }

        // Mandatory balanced journal posting inside the exact same PostgreSQL transaction
        await coreAuditService.postJournalEntryForTransaction(
          userId,
          newTx,
          {
            idempotencyKey: cleanIdempKey ? `tx-post-${cleanIdempKey}` : `tx-post-${newTx.id}`,
          },
          txDb
        );

        // Record downstream rule trigger inside transactional outbox for post-commit dispatch
        await coreAuditService.enqueueDomainEvent(
          userId,
          'transaction_posted',
          newTx.id,
          {
            amount: amountMadNum,
            transactionType: dto.type,
            category: normalizedCat || undefined,
            walletId: resolvedWalletId,
            counterparty: dto.notes || loanContactName || unpaidContactName || '',
            description: dto.notes || normalizedCat,
            contextId: dto.contextId || undefined,
            eventId: newTx.id,
          },
          txDb
        );

        return newTx;
      });
    } catch (err: any) {
      // Concurrent duplicate idempotent request recovery
      if (cleanIdempKey && (err?.code === '23505' || String(err?.message || '').includes('idempotency'))) {
        const existing = await db
          .select()
          .from(transactions)
          .where(and(eq(transactions.userId, userId), eq(transactions.idempotencyKey, cleanIdempKey)))
          .limit(1);
        if (existing.length > 0) return existing[0];
      }
      throw err;
    }

    // Secondary work executes strictly OUTSIDE the critical posting transaction
    await coreAuditService.processPendingOutboxEvents(userId).catch(() => undefined);
    await coreAuditService
      .evaluatePostCommitThresholds(userId, resolvedWalletId, normalizedCat, createdTx.id)
      .catch(() => undefined);

    return createdTx;
  }

  async updateTransaction(userId: string, transactionId: string, dto: UpdateTransactionDTO) {
    const current = await transactionRepository.findByIdAndUserId(transactionId, userId);
    if (!current) throw new Error('Transaction not found');
    if (dto.type && dto.type !== current.type) {
      throw new Error('Transaction type cannot be changed. Delete and create a new transaction instead.');
    }
    this.validateAmount(dto.amount);

    const createdAt = this.parseTransactionDate(dto.transaction_date);
    const unpaidDueDate = this.parseTransactionDate(dto.unpaid_due_date);

    let assignedCategory = dto.category;
    const loanContactName = dto.loan_contact_name?.trim();
    if (loanContactName) {
      assignedCategory = '🤝 Loan Received';
    } else if (current.type === 'Transfer' && (dto.destinationWalletId !== undefined || !assignedCategory)) {
      const targetDestId =
        dto.destinationWalletId !== undefined
          ? await this.resolveOptionalWalletId(userId, dto.destinationWalletId)
          : current.destinationWalletId;
      if (targetDestId) {
        try {
          const wallets = await walletService.getWallets(userId);
          const destWallet = wallets.find((w) => w.id === targetDestId);
          const destType = destWallet?.type?.toLowerCase();
          if (destType === 'investment') {
            assignedCategory = '📈 Investments';
          } else if (destType === 'savings') {
            assignedCategory = '🛟 Emergency & goals Fund';
          } else if (
            !assignedCategory ||
            assignedCategory === '📈 Investments' ||
            assignedCategory === '🛟 Emergency & goals Fund'
          ) {
            assignedCategory = '🔄 Transfer';
          }
        } catch {
          if (!assignedCategory) assignedCategory = '🔄 Transfer';
        }
      }
    }

    const resolvedUpdateWalletId =
      dto.walletId !== undefined ? await this.resolveWalletId(userId, dto.walletId) : undefined;
    const resolvedUpdateDestId =
      dto.destinationWalletId !== undefined ? await this.resolveOptionalWalletId(userId, dto.destinationWalletId) : undefined;

    const updatedTx = await db.transaction(async (txDb) => {
      if (current.payrollId) {
        await this.syncPostedPayroll(userId, current.payrollId, dto.amount, createdAt, txDb);
      }

      const existingSplits = await transactionRepository.findSplitsByTransactionId(transactionId, txDb);
      const allUserDebts = await debtRepository.findAllByUserId(userId, txDb);
      const debtById = new Map(allUserDebts.map((d) => [d.id, d]));

      const existingReceivableSplits = existingSplits.filter((s) => {
        const d = s.linkedContactId ? debtById.get(s.linkedContactId) : null;
        return !d || d.type === 'Receivable';
      });

      const existingPartialPayableSplit = existingSplits.find((s) => {
        const d = s.linkedContactId ? debtById.get(s.linkedContactId) : null;
        return d && d.type === 'Payable' && parseFloat(s.reimbursableAmount as unknown as string) > 0;
      });

      const splitsProvided = dto.splits !== undefined || dto.reimbursable_amount !== undefined;

      if (
        current.type !== 'Expense' &&
        splitsProvided &&
        ((dto.splits && dto.splits.length > 0) || (dto.reimbursable_amount && dto.reimbursable_amount > 0))
      ) {
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
            updatedSplitsList = [
              {
                id: existingReceivableSplits[0]?.id,
                reimbursable_amount: Number(dto.reimbursable_amount),
                linked_contact_name: dto.linked_contact_name.trim(),
              },
            ];
          }
        }

        const totalReimbursable = updatedSplitsList.reduce((sum, s) => sum + s.reimbursable_amount, 0);
        if (totalReimbursable > dto.amount) {
          throw new Error(
            `Total reimbursable amount (${totalReimbursable.toFixed(2)} MAD) cannot exceed transaction amount (${dto.amount.toFixed(2)} MAD)`
          );
        }

        const updatedSplitIds = new Set(updatedSplitsList.map((s) => s.id).filter(Boolean));
        for (const existingSplit of existingReceivableSplits) {
          if (!updatedSplitIds.has(existingSplit.id)) {
            if (existingSplit.linkedContactId) {
              const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId, txDb);
              if (debt) {
                const originalAmount = parseFloat(debt.originalAmount as unknown as string);
                const remainingBalance = parseFloat(debt.remainingBalance as unknown as string);
                const settledAmount = originalAmount - remainingBalance;
                if (settledAmount > 0.001) {
                  throw new Error(
                    `Cannot remove split for ${debt.contactName} because a settlement of ${settledAmount.toFixed(2)} MAD has already been recorded.`
                  );
                }
                const linkedSplits = await transactionRepository.findSplitsByDebtId(debt.id, txDb);
                if (linkedSplits.some((s) => s.transactionId !== transactionId)) {
                  throw new Error(
                    `This reimbursement for ${debt.contactName} has settlements. Adjust the debt before removing it.`
                  );
                }
                await transactionRepository.deleteSplitById(existingSplit.id, txDb);
                await debtRepository.deleteByIdAndUserId(debt.id, userId, txDb);
              } else {
                await transactionRepository.deleteSplitById(existingSplit.id, txDb);
              }
            } else {
              await transactionRepository.deleteSplitById(existingSplit.id, txDb);
            }
          }
        }

        for (const splitDto of updatedSplitsList) {
          if (splitDto.id) {
            const existingSplit = existingReceivableSplits.find((s) => s.id === splitDto.id);
            if (existingSplit && existingSplit.linkedContactId) {
              const debt = await debtRepository.findByIdAndUserId(existingSplit.linkedContactId, userId, txDb);
              if (debt) {
                const oldReimbursableAmount = parseFloat(existingSplit.reimbursableAmount as unknown as string);
                const originalAmount = parseFloat(debt.originalAmount as unknown as string);
                const settledAmount = originalAmount - parseFloat(debt.remainingBalance as unknown as string);

                if (splitDto.reimbursable_amount < settledAmount) {
                  throw new Error(
                    `The reimbursement for ${debt.contactName} cannot be lower than the amount already settled (${settledAmount.toFixed(2)} MAD).`
                  );
                }

                const newOriginalAmount = originalAmount + (splitDto.reimbursable_amount - oldReimbursableAmount);
                await debtRepository.update(
                  debt.id,
                  userId,
                  {
                    originalAmount: String(newOriginalAmount),
                    remainingBalance: String(newOriginalAmount - settledAmount),
                    status: Math.abs(newOriginalAmount - settledAmount) <= 0.001 ? 'Cleared' : 'Pending',
                    contactName: splitDto.linked_contact_name,
                  },
                  txDb
                );
                await transactionRepository.updateSplit(
                  existingSplit.id,
                  { reimbursableAmount: String(splitDto.reimbursable_amount) },
                  txDb
                );
              }
            }
          } else {
            const newDebt = await debtRepository.create(
              {
                userId,
                contactName: splitDto.linked_contact_name,
                type: 'Receivable',
                originalAmount: String(splitDto.reimbursable_amount),
                remainingBalance: String(splitDto.reimbursable_amount),
                status: 'Pending',
                createdAt,
              },
              txDb
            );
            await transactionRepository.createSplit(
              {
                transactionId,
                reimbursableAmount: String(splitDto.reimbursable_amount),
                linkedContactId: newDebt.id,
              },
              txDb
            );
          }
        }
      }

      if (current.type === 'Expense' && dto.unpaid_amount !== undefined) {
        const nextUnpaid = Number(dto.unpaid_amount || 0);
        const nextUnpaidContact = (dto.unpaid_contact_name || '').trim();

        if (nextUnpaid > 0) {
          if (!nextUnpaidContact) {
            throw new Error('Please specify who you still owe for the remaining unpaid balance');
          }
          if (existingPartialPayableSplit && existingPartialPayableSplit.linkedContactId) {
            const debt = await debtRepository.findByIdAndUserId(
              existingPartialPayableSplit.linkedContactId,
              userId,
              txDb
            );
            if (debt) {
              const origAmt = parseFloat(debt.originalAmount as unknown as string) || 0;
              const remAmt = parseFloat(debt.remainingBalance as unknown as string) || 0;
              const settledAlready = Math.max(0, origAmt - remAmt);
              if (nextUnpaid < settledAlready - 0.001) {
                throw new Error(
                  `Unpaid amount cannot be lower than the amount already paid/settled (${settledAlready.toFixed(2)} MAD).`
                );
              }
              const nextRem = Math.max(0, Number((nextUnpaid - settledAlready).toFixed(2)));
              await debtRepository.update(
                debt.id,
                userId,
                {
                  contactName: nextUnpaidContact,
                  originalAmount: String(nextUnpaid),
                  remainingBalance: nextRem <= 0.001 ? '0' : String(nextRem),
                  status: nextRem <= 0.001 ? 'Cleared' : 'Pending',
                  ...(unpaidDueDate ? { dueDate: unpaidDueDate } : {}),
                },
                txDb
              );
              await transactionRepository.updateSplit(
                existingPartialPayableSplit.id,
                { reimbursableAmount: String(nextUnpaid) },
                txDb
              );
            }
          } else {
            const newPayableDebt = await debtRepository.create(
              {
                userId,
                contactName: nextUnpaidContact,
                type: 'Payable',
                originalAmount: String(nextUnpaid),
                remainingBalance: String(nextUnpaid),
                status: 'Pending',
                dueDate: unpaidDueDate,
                createdAt,
              },
              txDb
            );
            await transactionRepository.createSplit(
              {
                transactionId,
                reimbursableAmount: String(nextUnpaid),
                linkedContactId: newPayableDebt.id,
              },
              txDb
            );
          }
        } else if (existingPartialPayableSplit) {
          if (existingPartialPayableSplit.linkedContactId) {
            const debt = await debtRepository.findByIdAndUserId(
              existingPartialPayableSplit.linkedContactId,
              userId,
              txDb
            );
            if (debt) {
              const origAmt = parseFloat(debt.originalAmount as unknown as string) || 0;
              const remAmt = parseFloat(debt.remainingBalance as unknown as string) || 0;
              const settledAlready = Math.max(0, origAmt - remAmt);
              if (settledAlready > 0.001) {
                throw new Error(
                  `Cannot remove the unpaid balance for ${debt.contactName} because ${settledAlready.toFixed(2)} MAD has already been settled.`
                );
              }
              await transactionRepository.deleteSplitById(existingPartialPayableSplit.id, txDb);
              await debtRepository.deleteByIdAndUserId(debt.id, userId, txDb);
            } else {
              await transactionRepository.deleteSplitById(existingPartialPayableSplit.id, txDb);
            }
          } else {
            await transactionRepository.deleteSplitById(existingPartialPayableSplit.id, txDb);
          }
        }
      }

      if (loanContactName) {
        const loanSplit = existingSplits[0];
        if (current.type !== 'Income' || !loanSplit?.linkedContactId) {
          throw new Error('This transaction is not a loan received');
        }
        const debt = await debtRepository.findByIdAndUserId(loanSplit.linkedContactId, userId, txDb);
        if (!debt || debt.type !== 'Payable') throw new Error('Linked loan debt not found');
        const originalAmount = parseFloat(debt.originalAmount as unknown as string);
        const remainingAmount = parseFloat(debt.remainingBalance as unknown as string);
        const settledAmount = originalAmount - remainingAmount;
        if (dto.amount < settledAmount) {
          throw new Error('The loan amount cannot be lower than the amount already repaid.');
        }
        await debtRepository.update(
          debt.id,
          userId,
          {
            contactName: loanContactName,
            originalAmount: String(dto.amount),
            remainingBalance: String(dto.amount - settledAmount),
            status: dto.amount === settledAmount ? 'Cleared' : 'Pending',
          },
          txDb
        );
        await transactionRepository.updateSplit(loanSplit.id, { reimbursableAmount: String(dto.amount) }, txDb);
      }

      const matchedCpId =
        dto.counterpartyId !== undefined
          ? dto.counterpartyId
          : await this.resolveMatchingCounterpartyId(userId, dto.notes || current.notes || '', current.counterpartyId, txDb);

      const updatePayload: any = {
        amount: String(dto.amount),
        category: normalizeCategory(assignedCategory),
        notes: dto.notes,
        ...(createdAt ? { createdAt } : {}),
        ...(dto.contextId !== undefined ? { contextId: dto.contextId || null } : {}),
        ...(resolvedUpdateWalletId !== undefined ? { walletId: resolvedUpdateWalletId } : {}),
        ...(resolvedUpdateDestId !== undefined ? { destinationWalletId: resolvedUpdateDestId } : {}),
        ...(matchedCpId !== undefined ? { counterpartyId: matchedCpId } : {}),
      };

      const updated = await transactionRepository.update(transactionId, userId, updatePayload, txDb);
      if (!updated) throw new Error('Failed to update transaction');

      // Atomic journal correction: reverse prior posting and post corrected balanced entry in same TX
      await coreAuditService.reverseJournalEntriesForTransaction(
        userId,
        transactionId,
        'Transaction edited — reversing prior posting before correction',
        txDb
      );
      await coreAuditService.postJournalEntryForTransaction(
        userId,
        updated,
        {
          idempotencyKey: `tx-edit-${updated.id}-${Date.now()}`,
          memo: `[Corrected] ${updated.notes || updated.category || updated.type}`,
        },
        txDb
      );

      return updated;
    });

    await coreAuditService
      .evaluatePostCommitThresholds(userId, updatedTx.walletId, updatedTx.category, updatedTx.id)
      .catch(() => undefined);

    return updatedTx;
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
    await db.transaction(async (txDb) => {
      const transaction = await transactionRepository.findByIdAndUserId(transactionId, userId, txDb);
      if (!transaction) throw new Error('Transaction not found');

      // Mandatory reversal journal entry BEFORE removing business rows; failure rolls back deletion
      await coreAuditService.reverseJournalEntriesForTransaction(
        userId,
        transactionId,
        `Reversal for deleted ${transaction.type} (${transaction.amount} MAD)`,
        txDb
      );

      const relatedSplits = await transactionRepository.findSplitsByTransactionId(transactionId, txDb);

      for (const split of relatedSplits) {
        if (split.linkedContactId) {
          const debt = await debtRepository.findByIdAndUserId(split.linkedContactId, userId, txDb);
          if (debt) {
            const splitReimbNum = parseFloat(split.reimbursableAmount as unknown as string) || 0;
            const isOriginalTransaction =
              (debt.type === 'Receivable' && transaction.type === 'Expense') ||
              (debt.type === 'Payable' && transaction.type === 'Income') ||
              (debt.type === 'Payable' && transaction.type === 'Expense' && splitReimbNum > 0);
            if (isOriginalTransaction) {
              const linkedSplits = await transactionRepository.findSplitsByDebtId(debt.id, txDb);
              for (const linkedSplit of linkedSplits) {
                if (linkedSplit.transactionId !== transactionId) {
                  await coreAuditService.reverseJournalEntriesForTransaction(
                    userId,
                    linkedSplit.transactionId,
                    `Cascading reversal for removed debt ${debt.contactName}`,
                    txDb
                  );
                  await transactionRepository.deleteSplitsByTransactionId(linkedSplit.transactionId, txDb);
                  await transactionRepository.deleteByIdAndUserId(linkedSplit.transactionId, userId, txDb);
                } else {
                  await transactionRepository.deleteSplitById(linkedSplit.id, txDb);
                }
              }
              await debtRepository.deleteByIdAndUserId(debt.id, userId, txDb);
            } else {
              const currentRemaining = parseFloat(debt.remainingBalance as unknown as string);
              const reimbAmount =
                splitReimbNum > 0
                  ? splitReimbNum
                  : parseFloat(transaction.amount as unknown as string) || 0;
              const originalAmount = parseFloat(debt.originalAmount as unknown as string);
              const newRemaining = Math.min(originalAmount, currentRemaining + reimbAmount);

              await debtRepository.update(
                debt.id,
                userId,
                {
                  remainingBalance: String(newRemaining),
                  status: newRemaining <= 0 ? 'Cleared' : 'Pending',
                },
                txDb
              );
            }
          }
        }
      }

      await transactionRepository.deleteSplitsByTransactionId(transactionId, txDb);
      await transactionRepository.deleteByIdAndUserId(transactionId, userId, txDb);
    });
  }

  private validateAmount(amount: number) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error('Amount must be greater than zero');
  }

  private async syncPostedPayroll(
    userId: string,
    payrollId: string,
    amount: number,
    scheduledFor?: Date,
    exec: DbExecutor = db
  ) {
    const payroll = await payrollRepository.findByIdAndUserId(payrollId, userId, exec);
    if (!payroll) throw new Error('Linked payroll not found');

    const payrollDate = scheduledFor || new Date(payroll.scheduledFor);
    const start = new Date(Date.UTC(payrollDate.getUTCFullYear(), payrollDate.getUTCMonth(), 1));
    const end = new Date(Date.UTC(payrollDate.getUTCFullYear(), payrollDate.getUTCMonth() + 1, 1));
    const existingForMonth = await payrollRepository.findForMonth(userId, start, end, payrollId, exec);
    if (existingForMonth) throw new Error('This calendar month already has a payroll. Choose another date.');

    await payrollRepository.update(
      payrollId,
      userId,
      {
        scheduledFor: payrollDate,
        amount: String(amount),
      },
      exec
    );
  }
}

export const transactionService = new TransactionService();
