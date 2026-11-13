import crypto from 'crypto';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  categoryBudgets,
  commitmentOccurrences,
  counterparties,
  debts,
  domainEventOutbox,
  exchangeRates,
  externalWealthItems,
  externalWealthValuations,
  financialPositionSnapshots,
  financialReviewItems,
  financialRuleLogs,
  financialRules,
  goalContributionEvents,
  goals,
  journalEntries,
  journalLines,
  payrolls,
  savedScenarios,
  statementImportBatches,
  statementImportRows,
  stockPositions,
  subscriptions,
  transactions,
  wallets,
} from '../../src/db/schema.js';
import { pushService } from './PushService.js';

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const DEFAULT_FX_TO_MAD: Record<string, number> = {
  MAD: 1,
  USD: 9.95,
  EUR: 10.75,
  GBP: 12.65,
  CAD: 7.25,
  AED: 2.71,
  SAR: 2.65,
  CHF: 11.2,
};

export interface JournalLineInput {
  walletId?: string | null;
  accountCode: string;
  accountName: string;
  accountClass: 'Asset' | 'Liability' | 'Income' | 'Expense' | 'Equity' | 'Clearing';
  debitMad: number;
  creditMad: number;
  nativeAmount?: number;
  nativeCurrency?: string;
}

export class CoreAuditService {
  // ─── C. Multi-Currency & Historical FX Service ──────────────────────────────

  async getExchangeRates(userId: string) {
    const rows = await db
      .select()
      .from(exchangeRates)
      .where(eq(exchangeRates.userId, userId))
      .orderBy(desc(exchangeRates.effectiveDate));

    const rateMap: Record<string, number> = { ...DEFAULT_FX_TO_MAD };
    const seenBase = new Set<string>();
    for (const r of rows) {
      if (r.quoteCurrency === 'MAD' && !seenBase.has(r.baseCurrency)) {
        seenBase.add(r.baseCurrency);
        rateMap[r.baseCurrency] = Number(r.rate) || rateMap[r.baseCurrency] || 1;
      }
    }

    return {
      ratesToMad: rateMap,
      history: rows,
    };
  }

  async resolveHistoricalRateToMad(
    userId: string,
    currency: string,
    effectiveDate?: string,
    explicitRate?: number,
    txDb: DbExecutor = db
  ): Promise<{ rate: number; source: string }> {
    const cleanCurr = (currency || 'MAD').toUpperCase().trim();
    if (cleanCurr === 'MAD') {
      return { rate: 1, source: 'base_currency' };
    }
    if (explicitRate && Number.isFinite(explicitRate) && explicitRate > 0) {
      return { rate: Number(explicitRate), source: 'locked_at_posting' };
    }

    const rows = await txDb
      .select()
      .from(exchangeRates)
      .where(and(eq(exchangeRates.userId, userId), eq(exchangeRates.baseCurrency, cleanCurr)))
      .orderBy(desc(exchangeRates.effectiveDate));

    if (effectiveDate && rows.length > 0) {
      const exactOrPrior = rows.find((r) => r.effectiveDate <= effectiveDate) || rows[0];
      if (exactOrPrior) {
        return { rate: Number(exactOrPrior.rate) || 1, source: exactOrPrior.source };
      }
    } else if (rows.length > 0) {
      return { rate: Number(rows[0].rate) || 1, source: rows[0].source };
    }

    const fallback = DEFAULT_FX_TO_MAD[cleanCurr] || 1;
    return { rate: fallback, source: 'reference_feed' };
  }

  async upsertExchangeRate(
    userId: string,
    dto: { baseCurrency: string; quoteCurrency?: string; rate: number; effectiveDate?: string; source?: string }
  ) {
    const baseCurrency = (dto.baseCurrency || 'USD').toUpperCase().trim();
    const quoteCurrency = (dto.quoteCurrency || 'MAD').toUpperCase().trim();
    const rate = Number(dto.rate);
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error('Exchange rate must be a positive number');
    }
    const effectiveDate = dto.effectiveDate || new Date().toISOString().slice(0, 10);
    const [inserted] = await db
      .insert(exchangeRates)
      .values({
        userId,
        baseCurrency,
        quoteCurrency,
        rate: String(rate),
        effectiveDate,
        source: dto.source || 'manual',
      })
      .returning();
    return inserted;
  }

  // ─── A. Balanced Double-Entry Accounting-Posting Layer ──────────────────────

  async buildBalancedLinesForTransaction(
    userId: string,
    tx: {
      id: string;
      type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
      amount: string | number;
      nativeAmount?: string | number | null;
      currency?: string | null;
      exchangeRateUsed?: string | number | null;
      walletId?: string | null;
      destinationWalletId?: string | null;
      category?: string | null;
      notes?: string | null;
    },
    txDb: DbExecutor = db
  ): Promise<{ entryType: string; lines: JournalLineInput[] }> {
    const amountMad = Math.abs(Number(tx.amount) || 0);
    const nativeCurrency = (tx.currency || 'MAD').toUpperCase();
    const nativeAmount = Math.abs(Number(tx.nativeAmount ?? tx.amount) || 0);

    const userWallets = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
    const walletMap = new Map(userWallets.map((w) => [w.id, w]));

    const sourceWallet = tx.walletId ? walletMap.get(tx.walletId) : undefined;
    const destWallet = tx.destinationWalletId ? walletMap.get(tx.destinationWalletId) : undefined;

    const isSourceCreditCard =
      sourceWallet?.accountSubtype === 'CreditCard' || sourceWallet?.accountSubtype === 'Overdraft';
    const isDestCreditCard =
      destWallet?.accountSubtype === 'CreditCard' || destWallet?.accountSubtype === 'Overdraft';

    const sourceAccountCode = isSourceCreditCard
      ? `2010-LIAB-${(sourceWallet?.name || 'CREDIT').toUpperCase().slice(0, 10)}`
      : `1010-ASSET-${(sourceWallet?.name || 'WALLET').toUpperCase().slice(0, 10)}`;
    const sourceAccountName = sourceWallet?.name || 'Primary Wallet';
    const sourceAccountClass: JournalLineInput['accountClass'] = isSourceCreditCard
      ? 'Liability'
      : 'Asset';

    if (tx.type === 'Income') {
      const isLoan = (tx.category || '').toLowerCase().includes('loan');
      return {
        entryType: isLoan ? 'loan_receipt' : 'standard',
        lines: [
          {
            walletId: tx.walletId || null,
            accountCode: sourceAccountCode,
            accountName: sourceAccountName,
            accountClass: sourceAccountClass,
            debitMad: amountMad,
            creditMad: 0,
            nativeAmount,
            nativeCurrency,
          },
          {
            walletId: null,
            accountCode: isLoan ? '2100-LIAB-PAYABLE' : '4010-INCOME-REVENUE',
            accountName: isLoan ? 'Loans & Payables' : tx.category || 'Income',
            accountClass: isLoan ? 'Liability' : 'Income',
            debitMad: 0,
            creditMad: amountMad,
            nativeAmount,
            nativeCurrency,
          },
        ],
      };
    }

    if (tx.type === 'Transfer') {
      const destAccountCode = isDestCreditCard
        ? `2010-LIAB-${(destWallet?.name || 'CREDIT').toUpperCase().slice(0, 10)}`
        : `1020-ASSET-${(destWallet?.name || 'DEST').toUpperCase().slice(0, 10)}`;
      const destAccountName = destWallet?.name || 'Destination Account';
      const destAccountClass: JournalLineInput['accountClass'] = isDestCreditCard
        ? 'Liability'
        : 'Asset';

      return {
        entryType: isDestCreditCard ? 'credit_settlement' : 'transfer',
        lines: [
          {
            walletId: tx.destinationWalletId || null,
            accountCode: destAccountCode,
            accountName: destAccountName,
            accountClass: destAccountClass,
            debitMad: amountMad,
            creditMad: 0,
            nativeAmount,
            nativeCurrency,
          },
          {
            walletId: tx.walletId || null,
            accountCode: sourceAccountCode,
            accountName: sourceAccountName,
            accountClass: sourceAccountClass,
            debitMad: 0,
            creditMad: amountMad,
            nativeAmount,
            nativeCurrency,
          },
        ],
      };
    }

    if (tx.type === 'Debt Repayment') {
      return {
        entryType: 'credit_settlement',
        lines: [
          {
            walletId: tx.destinationWalletId || null,
            accountCode: '2100-LIAB-DEBT-SETTLEMENT',
            accountName: 'Debt / Credit Liability Settlement',
            accountClass: 'Liability',
            debitMad: amountMad,
            creditMad: 0,
            nativeAmount,
            nativeCurrency,
          },
          {
            walletId: tx.walletId || null,
            accountCode: sourceAccountCode,
            accountName: sourceAccountName,
            accountClass: sourceAccountClass,
            debitMad: 0,
            creditMad: amountMad,
            nativeAmount,
            nativeCurrency,
          },
        ],
      };
    }

    // Default: Expense (including Credit-Card purchase or Investment purchase)
    const catLower = (tx.category || '').toLowerCase();
    const isInvestmentAllocation = catLower.includes('investment');
    return {
      entryType: isSourceCreditCard
        ? 'credit_purchase'
        : isInvestmentAllocation
        ? 'investment'
        : 'standard',
      lines: [
        {
          walletId: null,
          accountCode: isInvestmentAllocation ? '1300-ASSET-INVESTMENTS' : '5010-EXPENSE-OPERATING',
          accountName: tx.category || 'Operating Expense',
          accountClass: isInvestmentAllocation ? 'Asset' : 'Expense',
          debitMad: amountMad,
          creditMad: 0,
          nativeAmount,
          nativeCurrency,
        },
        {
          walletId: tx.walletId || null,
          accountCode: sourceAccountCode,
          accountName: sourceAccountName,
          accountClass: sourceAccountClass,
          debitMad: 0,
          creditMad: amountMad,
          nativeAmount,
          nativeCurrency,
        },
      ],
    };
  }

  async postJournalEntryForTransaction(
    userId: string,
    tx: any,
    options: { isEstimatedBackfill?: boolean; idempotencyKey?: string; memo?: string } = {},
    txDb?: DbExecutor
  ) {
    const runInExecutor = async (exec: DbExecutor) => {
      const { entryType, lines } = await this.buildBalancedLinesForTransaction(userId, tx, exec);

      const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitMad || 0), 0);
      const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditMad || 0), 0);
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(
          `Double-entry accounting invariant violation: debits (${totalDebit.toFixed(2)}) != credits (${totalCredit.toFixed(2)})`
        );
      }

      const idempKey = options.idempotencyKey || (tx.idempotencyKey ? `tx-post-${tx.idempotencyKey}` : `tx-post-${tx.id}`);
      const existingByKey = await exec
        .select()
        .from(journalEntries)
        .where(and(eq(journalEntries.userId, userId), eq(journalEntries.idempotencyKey, idempKey)))
        .limit(1);
      if (existingByKey.length > 0) {
        return existingByKey[0];
      }

      const [entry] = await exec
        .insert(journalEntries)
        .values({
          userId,
          transactionId: tx.id,
          entryType,
          status: 'posted',
          currency: (tx.currency || 'MAD').toUpperCase(),
          exchangeRateUsed: String(tx.exchangeRateUsed || '1'),
          isEstimatedBackfill: Boolean(options.isEstimatedBackfill),
          idempotencyKey: idempKey,
          memo: options.memo || tx.notes || `${tx.type}: ${tx.category || 'General'}`,
          postedAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
        })
        .returning();

      await exec.insert(journalLines).values(
        lines.map((line) => ({
          journalEntryId: entry.id,
          userId,
          walletId: line.walletId || null,
          accountCode: line.accountCode,
          accountName: line.accountName,
          accountClass: line.accountClass,
          debitMad: String(line.debitMad.toFixed(2)),
          creditMad: String(line.creditMad.toFixed(2)),
          nativeAmount: String((line.nativeAmount ?? line.debitMad ?? line.creditMad).toFixed(2)),
          nativeCurrency: line.nativeCurrency || 'MAD',
        }))
      );

      await this.syncCreditWalletLiabilityBalances(userId, exec);
      return entry;
    };

    if (txDb) {
      return await runInExecutor(txDb);
    }
    return await db.transaction(async (atomicTx) => await runInExecutor(atomicTx));
  }

  async reverseJournalEntriesForTransaction(
    userId: string,
    transactionId: string,
    reason = 'Transaction modified or reversed',
    txDb?: DbExecutor
  ) {
    const runInExecutor = async (exec: DbExecutor) => {
      const existingEntries = await exec
        .select()
        .from(journalEntries)
        .where(
          and(
            eq(journalEntries.userId, userId),
            eq(journalEntries.transactionId, transactionId),
            eq(journalEntries.status, 'posted')
          )
        );

      for (const entry of existingEntries) {
        const lines = await exec
          .select()
          .from(journalLines)
          .where(eq(journalLines.journalEntryId, entry.id));

        await exec
          .update(journalEntries)
          .set({ status: 'reversed' })
          .where(eq(journalEntries.id, entry.id));

        const reversalKey = `rev-${entry.id}-${Date.now()}`;
        const [reversalEntry] = await exec
          .insert(journalEntries)
          .values({
            userId,
            transactionId: null,
            entryType: 'reversal',
            status: 'posted',
            reversalOfEntryId: entry.id,
            currency: entry.currency,
            exchangeRateUsed: entry.exchangeRateUsed,
            isEstimatedBackfill: false,
            idempotencyKey: reversalKey,
            memo: `Reversal of ${entry.id.slice(0, 8)}: ${reason}`,
          })
          .returning();

        if (lines.length > 0) {
          await exec.insert(journalLines).values(
            lines.map((l) => ({
              journalEntryId: reversalEntry.id,
              userId,
              walletId: l.walletId,
              accountCode: l.accountCode,
              accountName: l.accountName,
              accountClass: l.accountClass,
              debitMad: l.creditMad,
              creditMad: l.debitMad,
              nativeAmount: l.nativeAmount,
              nativeCurrency: l.nativeCurrency,
            }))
          );
        }
      }

      await this.syncCreditWalletLiabilityBalances(userId, exec);
      return existingEntries.length;
    };

    if (txDb) {
      return await runInExecutor(txDb);
    }
    return await db.transaction(async (atomicTx) => await runInExecutor(atomicTx));
  }

  async syncCreditWalletLiabilityBalances(userId: string, txDb: DbExecutor = db) {
    const userWallets = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
    const creditWallets = userWallets.filter(
      (w) => w.accountSubtype === 'CreditCard' || w.accountSubtype === 'Overdraft'
    );
    if (creditWallets.length === 0) return;

    const userTx = await txDb.select().from(transactions).where(eq(transactions.userId, userId));
    for (const cw of creditWallets) {
      let liability = Math.max(0, -Number(cw.initialBalance || 0));
      for (const tx of userTx) {
        const amt = Number(tx.amount || 0);
        if (tx.walletId === cw.id && tx.type === 'Expense') {
          liability += amt;
        } else if (tx.destinationWalletId === cw.id && tx.type === 'Transfer') {
          liability = Math.max(0, liability - amt);
        } else if (tx.walletId === cw.id && tx.type === 'Income') {
          liability = Math.max(0, liability - amt);
        }
      }
      await txDb
        .update(wallets)
        .set({ liabilityBalance: String(liability.toFixed(2)), updatedAt: new Date() })
        .where(eq(wallets.id, cw.id));
    }
  }

  /** Transactional outbox helpers: secondary rule/notification work runs outside critical posting TX */
  async enqueueDomainEvent(
    userId: string,
    eventType: string,
    aggregateId: string,
    payload: Record<string, any>,
    txDb: DbExecutor = db
  ) {
    const [evt] = await txDb
      .insert(domainEventOutbox)
      .values({
        userId,
        eventType,
        aggregateId,
        payloadJson: JSON.stringify(payload || {}),
        status: 'pending',
      })
      .returning();
    return evt;
  }

  async processPendingOutboxEvents(userId: string) {
    const pending = await db
      .select()
      .from(domainEventOutbox)
      .where(and(eq(domainEventOutbox.userId, userId), eq(domainEventOutbox.status, 'pending')))
      .limit(25);

    for (const evt of pending) {
      try {
        const payload = JSON.parse(evt.payloadJson || '{}');
        await this.evaluateRulesForTrigger(userId, evt.eventType, {
          ...payload,
          eventId: payload.eventId || evt.aggregateId,
        });
        await db
          .update(domainEventOutbox)
          .set({ status: 'processed', processedAt: new Date(), attempts: evt.attempts + 1 })
          .where(eq(domainEventOutbox.id, evt.id));
      } catch (err: any) {
        await db
          .update(domainEventOutbox)
          .set({
            status: evt.attempts >= 2 ? 'failed' : 'pending',
            attempts: evt.attempts + 1,
            lastError: err?.message || 'Outbox dispatch failed',
          })
          .where(eq(domainEventOutbox.id, evt.id));
      }
    }
  }

  async backfillJournalFromTransactions(userId: string) {
    const [allTx, existingEntries] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
    ]);

    const postedTxIds = new Set(
      existingEntries.filter((e) => e.transactionId && e.status === 'posted').map((e) => e.transactionId!)
    );

    let backfilledCount = 0;
    for (const tx of allTx) {
      if (postedTxIds.has(tx.id)) continue;
      await this.postJournalEntryForTransaction(userId, tx, {
        isEstimatedBackfill: true,
        idempotencyKey: `backfill-${tx.id}`,
        memo: `[Backfilled] ${tx.notes || tx.category || tx.type}`,
      });
      backfilledCount++;
    }

    return { backfilledCount, totalTransactions: allTx.length };
  }

  async getJournalAuditSummary(userId: string) {
    // Automatically ensure existing transactions are backfilled once so the user sees a complete ledger
    await this.backfillJournalFromTransactions(userId);

    const [entries, lines, userWallets, userTx] = await Promise.all([
      db
        .select()
        .from(journalEntries)
        .where(eq(journalEntries.userId, userId))
        .orderBy(desc(journalEntries.postedAt)),
      db.select().from(journalLines).where(eq(journalLines.userId, userId)),
      db.select().from(wallets).where(eq(wallets.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
    ]);

    const linesByEntry = new Map<string, typeof lines>();
    let totalDebitsMad = 0;
    let totalCreditsMad = 0;

    for (const l of lines) {
      const list = linesByEntry.get(l.journalEntryId) || [];
      list.push(l);
      linesByEntry.set(l.journalEntryId, list);
      totalDebitsMad += Number(l.debitMad || 0);
      totalCreditsMad += Number(l.creditMad || 0);
    }

    const enrichedEntries = entries.slice(0, 60).map((e) => {
      const entryLines = linesByEntry.get(e.id) || [];
      const debitSum = entryLines.reduce((s, l) => s + Number(l.debitMad || 0), 0);
      const creditSum = entryLines.reduce((s, l) => s + Number(l.creditMad || 0), 0);
      return {
        ...e,
        debitSum: Number(debitSum.toFixed(2)),
        creditSum: Number(creditSum.toFixed(2)),
        isBalanced: Math.abs(debitSum - creditSum) < 0.01,
        lines: entryLines,
      };
    });

    // Side-by-side wallet balance comparison (Legacy vs Double-Entry Journal)
    const walletComparison = userWallets.map((w) => {
      const initBal = Number(w.initialBalance || 0);
      const isCredit = w.accountSubtype === 'CreditCard' || w.accountSubtype === 'Overdraft';
      const walletLines = lines.filter((l) => {
        const parentEntry = entries.find((e) => e.id === l.journalEntryId);
        return l.walletId === w.id && parentEntry?.status === 'posted';
      });
      const netJournalDelta = walletLines.reduce(
        (s, l) =>
          s +
          (isCredit
            ? Number(l.creditMad || 0) - Number(l.debitMad || 0)
            : Number(l.debitMad || 0) - Number(l.creditMad || 0)),
        0
      );
      const journalBalance = isCredit ? netJournalDelta : initBal + netJournalDelta;

      let legacyDelta = 0;
      for (const tx of userTx) {
        const amt = Number(tx.amount || 0);
        if (tx.walletId === w.id) {
          if (tx.type === 'Income') legacyDelta += amt;
          else if (tx.type === 'Expense' || tx.type === 'Transfer' || tx.type === 'Debt Repayment')
            legacyDelta -= amt;
        }
        if (tx.destinationWalletId === w.id && tx.type === 'Transfer') {
          legacyDelta += amt;
        }
      }
      const legacyBalance = isCredit ? Math.abs(legacyDelta) : initBal + legacyDelta;

      return {
        walletId: w.id,
        walletName: w.name,
        accountSubtype: w.accountSubtype || 'Checking',
        currency: w.currency || 'MAD',
        legacyBalance: Number(legacyBalance.toFixed(2)),
        journalBalance: Number(journalBalance.toFixed(2)),
        variance: Number((journalBalance - legacyBalance).toFixed(2)),
        reconciled: Math.abs(journalBalance - legacyBalance) < 0.05,
      };
    });

    return {
      totalEntries: entries.length,
      totalDebitsMad: Number(totalDebitsMad.toFixed(2)),
      totalCreditsMad: Number(totalCreditsMad.toFixed(2)),
      isLedgerBalanced: Math.abs(totalDebitsMad - totalCreditsMad) < 0.02,
      estimatedBackfillCount: entries.filter((e) => e.isEstimatedBackfill).length,
      reversalCount: entries.filter((e) => e.entryType === 'reversal').length,
      walletComparison,
      recentEntries: enrichedEntries,
    };
  }

  // ─── D. Statement Import & Transaction-Level Matching ───────────────────────

  async importStatementBatch(
    userId: string,
    dto: {
      walletId: string;
      fileName: string;
      fileFormat?: string;
      rawContent: string;
      statementOpeningBalance?: number;
      statementClosingBalance?: number;
      columnMap?: { dateCol?: number; descCol?: number; amountCol?: number; currencyCol?: number; refCol?: number };
    }
  ) {
    const lines = (dto.rawContent || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) {
      throw new Error('Statement file is empty');
    }

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(';') ? ';' : ',';
    const splitRow = (line: string) => {
      const cols: string[] = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
        } else if (ch === delimiter && !inQuotes) {
          cols.push(cur.trim());
          cur = '';
        } else {
          cur += ch;
        }
      }
      cols.push(cur.trim());
      return cols;
    };

    const headerCols = splitRow(lines[0]).map((c) => c.toLowerCase());
    const hasHeader = headerCols.some((c) =>
      /date|description|label|libelle|amount|montant|debit|credit/i.test(c)
    );
    const dataLines = hasHeader ? lines.slice(1) : lines;

    const dateIdx =
      dto.columnMap?.dateCol ??
      Math.max(0, headerCols.findIndex((c) => /date/i.test(c)));
    const descIdx =
      dto.columnMap?.descCol ??
      (headerCols.findIndex((c) => /desc|label|libelle|merchant|narration/i.test(c)) >= 0
        ? headerCols.findIndex((c) => /desc|label|libelle|merchant|narration/i.test(c))
        : 1);
    const amountIdx =
      dto.columnMap?.amountCol ??
      (headerCols.findIndex((c) => /amount|montant|value|somme/i.test(c)) >= 0
        ? headerCols.findIndex((c) => /amount|montant|value|somme/i.test(c))
        : 2);

    const [existingTx, existingImportRows] = await Promise.all([
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(statementImportRows).where(eq(statementImportRows.userId, userId)),
    ]);
    const existingHashes = new Set(existingImportRows.map((r) => r.rowHash));

    const [batch] = await db
      .insert(statementImportBatches)
      .values({
        userId,
        walletId: dto.walletId,
        fileName: dto.fileName || 'statement.csv',
        fileFormat: dto.fileFormat || 'CSV',
        statementOpeningBalance:
          dto.statementOpeningBalance !== undefined ? String(dto.statementOpeningBalance) : null,
        statementClosingBalance:
          dto.statementClosingBalance !== undefined ? String(dto.statementClosingBalance) : null,
        status: 'pending_review',
      })
      .returning();

    let matchedCount = 0;
    let unmatchedCount = 0;
    let ambiguousCount = 0;
    let duplicateCount = 0;
    const insertedRows = [];

    for (const rawLine of dataLines) {
      const cols = splitRow(rawLine);
      if (cols.length < 2) continue;

      const rawDate = cols[dateIdx] || new Date().toISOString().slice(0, 10);
      const parsedDateObj = new Date(rawDate);
      const rowDate = !Number.isNaN(parsedDateObj.getTime())
        ? parsedDateObj.toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10);

      const description = cols[descIdx] || 'Statement Line';
      const cleanedAmtStr = (cols[amountIdx] || '0').replace(/[^0-9.-]/g, '');
      const amount = Number(cleanedAmtStr);
      if (!Number.isFinite(amount) || Math.abs(amount) < 0.01) continue;

      const currency = (cols[dto.columnMap?.currencyCol ?? 3] || 'MAD').toUpperCase().slice(0, 3);
      const externalRef = cols[dto.columnMap?.refCol ?? 4] || null;

      const rowHash = crypto
        .createHash('sha256')
        .update(`${dto.walletId}|${rowDate}|${description.toLowerCase()}|${amount.toFixed(2)}`)
        .digest('hex')
        .slice(0, 32);

      if (existingHashes.has(rowHash)) {
        duplicateCount++;
        const [dupRow] = await db
          .insert(statementImportRows)
          .values({
            batchId: batch.id,
            userId,
            walletId: dto.walletId,
            rowDate,
            description,
            amount: String(amount),
            currency: /^[A-Z]{3}$/.test(currency) ? currency : 'MAD',
            externalReference: externalRef,
            rowHash,
            matchStatus: 'duplicate',
            matchConfidence: '1.0',
          })
          .returning();
        insertedRows.push(dupRow);
        continue;
      }
      existingHashes.add(rowHash);

      // Score matches against existing TrueSpend transactions
      const absAmt = Math.abs(amount);
      const rowTime = new Date(rowDate).getTime();

      const scoredCandidates = existingTx
        .map((tx) => {
          const txAmt = Math.abs(Number(tx.amount || 0));
          const amtDiff = Math.abs(txAmt - absAmt);
          if (amtDiff > Math.max(2, absAmt * 0.03)) return null;

          const txTime = new Date(tx.createdAt || new Date()).getTime();
          const daysDiff = Math.abs(txTime - rowTime) / (1000 * 60 * 60 * 24);
          if (daysDiff > 6) return null;

          let score = 0.6;
          if (amtDiff < 0.05) score += 0.25;
          if (daysDiff <= 1.5) score += 0.1;
          if (tx.walletId === dto.walletId) score += 0.05;

          return { tx, score: Math.min(0.99, score) };
        })
        .filter(Boolean) as Array<{ tx: any; score: number }>;

      scoredCandidates.sort((a, b) => b.score - a.score);

      let matchStatus: 'matched' | 'unmatched' | 'ambiguous' = 'unmatched';
      let matchConfidence = 0;
      let suggestedTxId: string | null = null;

      if (scoredCandidates.length === 1 && scoredCandidates[0].score >= 0.75) {
        matchStatus = 'matched';
        matchConfidence = scoredCandidates[0].score;
        suggestedTxId = scoredCandidates[0].tx.id;
        matchedCount++;
      } else if (scoredCandidates.length > 1) {
        matchStatus = 'ambiguous';
        matchConfidence = scoredCandidates[0].score;
        suggestedTxId = scoredCandidates[0].tx.id;
        ambiguousCount++;
      } else {
        unmatchedCount++;
      }

      const [savedRow] = await db
        .insert(statementImportRows)
        .values({
          batchId: batch.id,
          userId,
          walletId: dto.walletId,
          rowDate,
          description,
          amount: String(amount),
          currency: /^[A-Z]{3}$/.test(currency) ? currency : 'MAD',
          externalReference: externalRef,
          rowHash,
          matchStatus,
          matchConfidence: String(matchConfidence.toFixed(2)),
          suggestedTransactionId: suggestedTxId,
          candidateTransactionIdsJson: JSON.stringify(scoredCandidates.map((c) => c.tx.id)),
        })
        .returning();

      insertedRows.push(savedRow);

      // Route unmatched and ambiguous rows into the Financial Review Inbox
      if (matchStatus === 'unmatched' || matchStatus === 'ambiguous') {
        await db.insert(financialReviewItems).values({
          userId,
          sourceType: 'statement_row',
          status: 'Needs Review',
          confidenceScore: String(matchConfidence || 0.75),
          parsedAmount: String(Math.abs(amount)),
          parsedCurrency: /^[A-Z]{3}$/.test(currency) ? currency : 'MAD',
          parsedDate: rowDate,
          parsedDescription: description,
          parsedCategory: amount < 0 ? '🧾 Bills & Utilities' : '📥 Income',
          parsedType: amount < 0 ? 'Expense' : 'Income',
          walletId: dto.walletId,
          linkedTransactionId: suggestedTxId,
          rawPayloadJson: JSON.stringify({ statementRowId: savedRow.id, batchId: batch.id }),
        });
      }
    }

    const totalRows = insertedRows.length;
    const netStatementMovement = insertedRows
      .filter((r) => r.matchStatus !== 'duplicate')
      .reduce((s, r) => s + Number(r.amount || 0), 0);
    const reconciledVariance =
      dto.statementOpeningBalance !== undefined && dto.statementClosingBalance !== undefined
        ? Number(
            (
              dto.statementOpeningBalance +
              netStatementMovement -
              dto.statementClosingBalance
            ).toFixed(2)
          )
        : 0;

    const [updatedBatch] = await db
      .update(statementImportBatches)
      .set({
        totalRows,
        matchedCount,
        unmatchedCount,
        ambiguousCount,
        duplicateCount,
        reconciledVariance: String(reconciledVariance),
      })
      .where(eq(statementImportBatches.id, batch.id))
      .returning();

    return {
      batch: updatedBatch,
      rows: insertedRows,
    };
  }

  async getStatementBatches(userId: string) {
    const [batches, rows] = await Promise.all([
      db
        .select()
        .from(statementImportBatches)
        .where(eq(statementImportBatches.userId, userId))
        .orderBy(desc(statementImportBatches.createdAt)),
      db
        .select()
        .from(statementImportRows)
        .where(eq(statementImportRows.userId, userId))
        .orderBy(desc(statementImportRows.rowDate)),
    ]);

    return batches.map((b) => ({
      ...b,
      rows: rows.filter((r) => r.batchId === b.id),
    }));
  }

  async resolveStatementRow(
    userId: string,
    rowId: string,
    decision: { action: 'confirm_match' | 'create_transaction' | 'ignore'; linkedTransactionId?: string; category?: string }
  ) {
    const [row] = await db
      .select()
      .from(statementImportRows)
      .where(and(eq(statementImportRows.id, rowId), eq(statementImportRows.userId, userId)));
    if (!row) throw new Error('Statement row not found');

    if (decision.action === 'ignore') {
      const [updated] = await db
        .update(statementImportRows)
        .set({ matchStatus: 'ignored' })
        .where(eq(statementImportRows.id, rowId))
        .returning();
      return updated;
    }

    if (decision.action === 'confirm_match') {
      const targetTxId = decision.linkedTransactionId || row.suggestedTransactionId;
      if (!targetTxId) throw new Error('No transaction selected to link');
      const [updated] = await db
        .update(statementImportRows)
        .set({
          matchStatus: 'confirmed_linked',
          linkedTransactionId: targetTxId,
        })
        .where(eq(statementImportRows.id, rowId))
        .returning();
      return updated;
    }

    // Create transaction from unmatched statement row
    const amtNum = Number(row.amount || 0);
    const txType: 'Income' | 'Expense' = amtNum >= 0 ? 'Income' : 'Expense';
    const absAmt = Math.abs(amtNum);
    const { rate } = await this.resolveHistoricalRateToMad(userId, row.currency, row.rowDate);
    const madAmount = Number((absAmt * rate).toFixed(2));

    const [createdTx] = await db
      .insert(transactions)
      .values({
        userId,
        walletId: row.walletId,
        amount: String(madAmount),
        nativeAmount: String(absAmt),
        currency: row.currency || 'MAD',
        exchangeRateUsed: String(rate),
        fxSource: 'locked_at_posting',
        idempotencyKey: `stmt-row-${row.id}`,
        type: txType,
        category: decision.category || (txType === 'Income' ? '📥 Income' : '🧾 Bills & Utilities'),
        notes: `[Statement Import] ${row.description}`,
        createdAt: new Date(`${row.rowDate}T12:00:00.000Z`),
      })
      .returning();

    await this.postJournalEntryForTransaction(userId, createdTx, {
      idempotencyKey: `stmt-journal-${row.id}`,
      memo: `Statement import posting: ${row.description}`,
    });

    const [updated] = await db
      .update(statementImportRows)
      .set({
        matchStatus: 'confirmed_created',
        linkedTransactionId: createdTx.id,
      })
      .where(eq(statementImportRows.id, rowId))
      .returning();

    await db
      .update(wallets)
      .set({ lastReconciledAt: new Date(), valuationStatus: 'verified' })
      .where(eq(wallets.id, row.walletId));

    return updated;
  }

  // ─── E. Persistent Financial Review Inbox ───────────────────────────────────

  async getReviewInbox(userId: string) {
    return await db
      .select()
      .from(financialReviewItems)
      .where(eq(financialReviewItems.userId, userId))
      .orderBy(desc(financialReviewItems.createdAt));
  }

  async createReviewItem(
    userId: string,
    dto: {
      sourceType: string;
      confidenceScore?: number;
      parsedAmount: number;
      parsedCurrency?: string;
      parsedDate?: string;
      parsedDescription: string;
      parsedCategory?: string;
      parsedType?: 'Income' | 'Expense' | 'Transfer';
      walletId?: string | null;
      rawPayloadJson?: string;
    }
  ) {
    const [item] = await db
      .insert(financialReviewItems)
      .values({
        userId,
        sourceType: dto.sourceType || 'receipt_ocr',
        status: 'Needs Review',
        confidenceScore: String(dto.confidenceScore ?? 0.85),
        parsedAmount: String(Math.abs(Number(dto.parsedAmount || 0))),
        parsedCurrency: (dto.parsedCurrency || 'MAD').toUpperCase(),
        parsedDate: dto.parsedDate || new Date().toISOString().slice(0, 10),
        parsedDescription: dto.parsedDescription || 'Captured Financial Item',
        parsedCategory: dto.parsedCategory || '🛒 Groceries',
        parsedType: dto.parsedType || 'Expense',
        walletId: dto.walletId || null,
        rawPayloadJson: dto.rawPayloadJson || null,
      })
      .returning();
    return item;
  }

  async decideReviewItem(
    userId: string,
    itemId: string,
    decision: {
      action: 'post_transaction' | 'link_existing' | 'reject' | 'mark_duplicate';
      walletId?: string;
      category?: string;
      amount?: number;
      description?: string;
      linkedTransactionId?: string;
      decisionNotes?: string;
    }
  ) {
    const [item] = await db
      .select()
      .from(financialReviewItems)
      .where(and(eq(financialReviewItems.id, itemId), eq(financialReviewItems.userId, userId)));
    if (!item) throw new Error('Review item not found');

    if (decision.action === 'reject' || decision.action === 'mark_duplicate') {
      const [updated] = await db
        .update(financialReviewItems)
        .set({
          status: decision.action === 'reject' ? 'Rejected' : 'Duplicate',
          decisionNotes: decision.decisionNotes || null,
          updatedAt: new Date(),
        })
        .where(eq(financialReviewItems.id, itemId))
        .returning();
      return { item: updated, transaction: null };
    }

    if (decision.action === 'link_existing') {
      const targetTxId = decision.linkedTransactionId || item.linkedTransactionId;
      if (!targetTxId) throw new Error('Please select an existing transaction to link');
      const [updated] = await db
        .update(financialReviewItems)
        .set({
          status: 'Linked',
          linkedTransactionId: targetTxId,
          decisionNotes: decision.decisionNotes || 'Linked to existing transaction',
          updatedAt: new Date(),
        })
        .where(eq(financialReviewItems.id, itemId))
        .returning();
      return { item: updated, transaction: null };
    }

    // Post as a verified transaction + balanced journal entry
    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
    const targetWalletId =
      decision.walletId ||
      item.walletId ||
      userWallets.find((w) => w.isMain)?.id ||
      userWallets[0]?.id ||
      null;

    const nativeAmt = Number(decision.amount ?? item.parsedAmount ?? 0);
    const { rate } = await this.resolveHistoricalRateToMad(
      userId,
      item.parsedCurrency,
      item.parsedDate
    );
    const madAmt = Number((nativeAmt * rate).toFixed(2));

    const [createdTx] = await db
      .insert(transactions)
      .values({
        userId,
        walletId: targetWalletId,
        amount: String(madAmt),
        nativeAmount: String(nativeAmt),
        currency: item.parsedCurrency || 'MAD',
        exchangeRateUsed: String(rate),
        fxSource: 'locked_at_posting',
        idempotencyKey: `review-item-${item.id}`,
        type: (item.parsedType as any) || 'Expense',
        category: decision.category || item.parsedCategory || '🛒 Groceries',
        notes: decision.description || item.parsedDescription,
        createdAt: new Date(`${item.parsedDate}T12:00:00.000Z`),
      })
      .returning();

    await this.postJournalEntryForTransaction(userId, createdTx, {
      idempotencyKey: `review-journal-${item.id}`,
      memo: `Review Inbox approved: ${item.parsedDescription}`,
    });

    const [updated] = await db
      .update(financialReviewItems)
      .set({
        status: 'Posted',
        linkedTransactionId: createdTx.id,
        decisionNotes: decision.decisionNotes || 'Confirmed and posted to ledger',
        updatedAt: new Date(),
      })
      .where(eq(financialReviewItems.id, itemId))
      .returning();

    return { item: updated, transaction: createdTx };
  }

  // ─── F. Complete Commitment Scheduling, Amortization & Atomic Settlement ────

  private advanceCommitmentDate(base: Date, cycleRaw?: string | null): Date {
    const next = new Date(base.getTime());
    const raw = (cycleRaw || 'monthly').trim().toLowerCase();
    if (raw === 'weekly') {
      next.setUTCDate(next.getUTCDate() + 7);
    } else if (raw === 'biweekly') {
      next.setUTCDate(next.getUTCDate() + 14);
    } else if (raw === 'yearly') {
      next.setUTCFullYear(next.getUTCFullYear() + 1);
    } else if (raw === 'every_6_months') {
      next.setUTCMonth(next.getUTCMonth() + 6);
    } else if (raw === 'every_3_months' || raw === 'quarterly') {
      next.setUTCMonth(next.getUTCMonth() + 3);
    } else if (raw === 'every_2_months') {
      next.setUTCMonth(next.getUTCMonth() + 2);
    } else {
      const customMonths = raw.match(/^every_(\d+)_months?$/);
      const customDays = raw.match(/^every_(\d+)_days?$/);
      if (customMonths) {
        next.setUTCMonth(next.getUTCMonth() + Math.max(1, parseInt(customMonths[1], 10)));
      } else if (customDays) {
        next.setUTCDate(next.getUTCDate() + Math.max(1, parseInt(customDays[1], 10)));
      } else {
        next.setUTCMonth(next.getUTCMonth() + 1);
      }
    }
    return next;
  }

  /** Pure helper: generates a complete dated debt installment amortization schedule */
  generateDebtInstallmentSchedule(debt: {
    id: string;
    contactName: string;
    type: string;
    remainingBalance: number;
    installmentAmount?: number | null;
    installmentFrequency?: string | null;
    interestRateApr?: number;
    feesAmount?: number;
    dueDate?: string | Date | null;
    currency?: string;
  }) {
    const remaining = Math.max(0, Number(debt.remainingBalance || 0));
    if (remaining <= 0.01) return [];

    const start = debt.dueDate ? new Date(debt.dueDate) : new Date();
    const validStart = Number.isNaN(start.getTime()) ? new Date() : start;
    const freq = (debt.installmentFrequency || 'one_time').toLowerCase();
    const apr = Math.max(0, Number(debt.interestRateApr || 0));
    const totalFees = Math.max(0, Number(debt.feesAmount || 0));

    if (freq === 'one_time' || !debt.installmentAmount || Number(debt.installmentAmount) <= 0) {
      const interestEst = apr > 0 ? Number(((remaining * (apr / 100)) / 12).toFixed(2)) : 0;
      const totalAmt = Number((remaining + interestEst + totalFees).toFixed(2));
      return [
        {
          installmentNumber: 1,
          expectedDate: validStart.toISOString().slice(0, 10),
          expectedAmount: totalAmt,
          principalComponent: Number(remaining.toFixed(2)),
          interestComponent: interestEst,
          feeComponent: Number(totalFees.toFixed(2)),
          remainingPrincipalAfter: 0,
        },
      ];
    }

    const periodsPerYear = freq === 'weekly' ? 52 : freq === 'biweekly' ? 26 : 12;
    const periodicRate = apr > 0 ? apr / 100 / periodsPerYear : 0;
    const instAmount = Math.max(1, Number(debt.installmentAmount));
    const schedule: Array<{
      installmentNumber: number;
      expectedDate: string;
      expectedAmount: number;
      principalComponent: number;
      interestComponent: number;
      feeComponent: number;
      remainingPrincipalAfter: number;
    }> = [];

    let balance = remaining;
    let cursorDate = new Date(validStart.getTime());
    const maxInstallments = 120;

    for (let idx = 1; idx <= maxInstallments && balance > 0.01; idx++) {
      const interestPart = Number((balance * periodicRate).toFixed(2));
      const feePart = idx === 1 ? Number(totalFees.toFixed(2)) : 0;
      const maxPrincipalPayable = balance;
      let principalPart = Number(Math.max(0, instAmount - interestPart).toFixed(2));
      if (principalPart <= 0) principalPart = Number(Math.min(balance, instAmount).toFixed(2));
      if (principalPart > maxPrincipalPayable) principalPart = Number(maxPrincipalPayable.toFixed(2));
      const totalPayment = Number((principalPart + interestPart + feePart).toFixed(2));
      balance = Math.max(0, Number((balance - principalPart).toFixed(2)));

      schedule.push({
        installmentNumber: idx,
        expectedDate: cursorDate.toISOString().slice(0, 10),
        expectedAmount: totalPayment,
        principalComponent: principalPart,
        interestComponent: interestPart,
        feeComponent: feePart,
        remainingPrincipalAfter: balance,
      });

      cursorDate = this.advanceCommitmentDate(cursorDate, freq);
    }

    return schedule;
  }

  async syncAndGetCommitmentOccurrences(userId: string, horizonDays = 90) {
    const [userSubs, userDebts, userPayrolls, userWallets] = await Promise.all([
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      db.select().from(debts).where(eq(debts.userId, userId)),
      db.select().from(payrolls).where(eq(payrolls.userId, userId)),
      db.select().from(wallets).where(eq(wallets.userId, userId)),
    ]);
    const walletMap = new Map(userWallets.map((w) => [w.id, w]));

    const todayStr = new Date().toISOString().slice(0, 10);
    const horizonEnd = new Date(Date.now() + Math.max(7, horizonDays) * 86400000);
    const rowsToInsert: Array<typeof commitmentOccurrences.$inferInsert> = [];

    // 1. Generate rolling horizon of active & planned subscription occurrences
    for (const sub of userSubs) {
      if (sub.status !== 'active' && sub.status !== 'planned') continue;
      if (!sub.nextBillingDate) continue;
      let cursor = new Date(sub.nextBillingDate);
      if (Number.isNaN(cursor.getTime())) continue;

      let safetyCount = 0;
      while (cursor <= horizonEnd && safetyCount < 24) {
        const expectedDate = cursor.toISOString().slice(0, 10);
        rowsToInsert.push({
          userId,
          sourceType: 'subscription',
          sourceId: sub.id,
          title: `${sub.icon || '🔁'} ${sub.name}`,
          expectedDate,
          expectedAmount: String(sub.amount),
          currency: sub.currency || 'MAD',
          status: expectedDate < todayStr ? 'overdue' : 'scheduled',
        });
        cursor = this.advanceCommitmentDate(cursor, sub.billingCycle);
        safetyCount++;
      }
    }

    // 2. Generate complete dated debt installment amortization occurrences
    for (const debt of userDebts) {
      if (debt.status === 'Cleared') continue;
      if (!debt.dueDate && (debt.installmentFrequency || 'one_time') === 'one_time') continue;

      const schedule = this.generateDebtInstallmentSchedule({
        id: debt.id,
        contactName: debt.contactName,
        type: debt.type,
        remainingBalance: Number(debt.remainingBalance || 0),
        installmentAmount: debt.installmentAmount ? Number(debt.installmentAmount) : null,
        installmentFrequency: debt.installmentFrequency,
        interestRateApr: Number(debt.interestRateApr || 0),
        feesAmount: Number(debt.feesAmount || 0),
        dueDate: debt.dueDate,
        currency: debt.currency,
      });

      for (const inst of schedule) {
        if (new Date(inst.expectedDate) > horizonEnd && inst.installmentNumber > 1) break;
        rowsToInsert.push({
          userId,
          sourceType: 'debt_installment',
          sourceId: debt.id,
          title: `${debt.type === 'Payable' ? '📤 Debt Installment' : '🤝 Receivable'}: ${debt.contactName}${
            schedule.length > 1 ? ` (#${inst.installmentNumber}/${schedule.length})` : ''
          }`,
          expectedDate: inst.expectedDate,
          expectedAmount: String(inst.expectedAmount),
          currency: debt.currency || 'MAD',
          status: inst.expectedDate < todayStr ? 'overdue' : 'scheduled',
          principalComponent: String(inst.principalComponent),
          interestComponent: String(inst.interestComponent),
          feeComponent: String(inst.feeComponent),
          installmentNumber: inst.installmentNumber,
        });
      }
    }

    // 3. Sync scheduled payroll occurrences
    for (const pr of userPayrolls) {
      const expectedDate = new Date(pr.scheduledFor).toISOString().slice(0, 10);
      const prWallet = (pr as any).walletId ? walletMap.get((pr as any).walletId) : null;
      const isConfirmed = pr.status === 'confirmed' || pr.status === 'matched';
      rowsToInsert.push({
        userId,
        sourceType: 'payroll',
        sourceId: pr.id,
        title: prWallet ? `💰 Scheduled Salary / Payroll → ${prWallet.name}` : '💰 Scheduled Salary / Payroll',
        expectedDate,
        expectedAmount: String(pr.amount),
        currency: 'MAD',
        status: isConfirmed ? 'completed' : expectedDate < todayStr ? 'overdue' : 'scheduled',
        actualDate: pr.confirmedAt ? new Date(pr.confirmedAt).toISOString().slice(0, 10) : null,
        actualAmount: pr.confirmedAmount ? String(pr.confirmedAmount) : null,
        varianceAmount: String(pr.varianceAmount || '0'),
        notes: prWallet ? `Destination account: ${prWallet.name} (${prWallet.type})` : null,
      });

      if (isConfirmed) {
        await db
          .update(commitmentOccurrences)
          .set({
            status: 'completed',
            title: prWallet ? `💰 Scheduled Salary / Payroll → ${prWallet.name}` : '💰 Scheduled Salary / Payroll',
            actualDate: pr.confirmedAt ? new Date(pr.confirmedAt).toISOString().slice(0, 10) : expectedDate,
            actualAmount: pr.confirmedAmount ? String(pr.confirmedAmount) : String(pr.amount),
            varianceAmount: String(pr.varianceAmount || '0'),
            notes: prWallet ? `Destination account: ${prWallet.name} (${prWallet.type})` : null,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commitmentOccurrences.userId, userId),
              eq(commitmentOccurrences.sourceType, 'payroll'),
              eq(commitmentOccurrences.sourceId, pr.id)
            )
          );
      } else if (prWallet) {
        await db
          .update(commitmentOccurrences)
          .set({
            title: `💰 Scheduled Salary / Payroll → ${prWallet.name}`,
            notes: `Destination account: ${prWallet.name} (${prWallet.type})`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(commitmentOccurrences.userId, userId),
              eq(commitmentOccurrences.sourceType, 'payroll'),
              eq(commitmentOccurrences.sourceId, pr.id)
            )
          );
      }
    }

    // Concurrency-safe insert via DB unique constraint on (user_id, source_type, source_id, expected_date)
    for (const row of rowsToInsert) {
      await db.insert(commitmentOccurrences).values(row).onConflictDoNothing();
    }

    // Promote any past-due 'scheduled' occurrences to 'overdue' and trigger commitment_approaching rules
    const allOccurrences = await db
      .select()
      .from(commitmentOccurrences)
      .where(eq(commitmentOccurrences.userId, userId))
      .orderBy(desc(commitmentOccurrences.expectedDate));

    for (const occ of allOccurrences) {
      if (occ.status === 'scheduled' && occ.expectedDate < todayStr) {
        await db
          .update(commitmentOccurrences)
          .set({ status: 'overdue', updatedAt: new Date() })
          .where(eq(commitmentOccurrences.id, occ.id));
        occ.status = 'overdue';
      } else if (occ.status === 'scheduled') {
        const diffDays = Math.ceil((new Date(occ.expectedDate).getTime() - Date.now()) / 86400000);
        if (diffDays >= 0 && diffDays <= 7) {
          await this.evaluateRulesForTrigger(userId, 'commitment_approaching', {
            amount: Number(occ.expectedAmount || 0),
            description: occ.title,
            withinDays: diffDays,
            eventId: occ.id,
          }).catch(() => undefined);
        }
      }
    }

    return allOccurrences;
  }

  async createRecurringIncomeCommitment(
    userId: string,
    dto: { title: string; expectedDate: string; expectedAmount: number; currency?: string; notes?: string }
  ) {
    if (!dto.title?.trim()) throw new Error('Commitment title is required');
    const amt = Number(dto.expectedAmount);
    if (!Number.isFinite(amt) || amt <= 0) throw new Error('Expected amount must be positive');
    const [created] = await db
      .insert(commitmentOccurrences)
      .values({
        userId,
        sourceType: 'recurring_income',
        sourceId: `inc-${crypto.randomUUID().slice(0, 8)}`,
        title: `📥 ${dto.title.trim()}`,
        expectedDate: dto.expectedDate,
        expectedAmount: String(amt),
        currency: (dto.currency || 'MAD').toUpperCase(),
        status: 'scheduled',
        notes: dto.notes || null,
      })
      .returning();
    return created;
  }

  async settleCommitmentOccurrence(
    userId: string,
    occurrenceId: string,
    dto: {
      action?: 'pay' | 'partial' | 'skip' | 'reschedule' | 'renegotiate' | 'cancel';
      status?: 'paid' | 'skipped' | 'renegotiated' | 'partial' | 'cancelled';
      actualAmount?: number;
      confirmedAmount?: number;
      actualDate?: string;
      newDate?: string;
      newAmount?: number;
      walletId?: string;
      linkedTransactionId?: string;
      isNonCashEvent?: boolean;
      reason?: string;
      varianceNotes?: string;
      notes?: string;
    }
  ) {
    const [occ] = await db
      .select()
      .from(commitmentOccurrences)
      .where(and(eq(commitmentOccurrences.id, occurrenceId), eq(commitmentOccurrences.userId, userId)));
    if (!occ) throw new Error('Commitment occurrence not found');

    const priorHistory: any[] = (() => {
      try {
        return JSON.parse(occ.historyJson || '[]');
      } catch {
        return [];
      }
    })();

    const action =
      dto.action ||
      (dto.status === 'skipped'
        ? 'skip'
        : dto.status === 'renegotiated'
        ? 'renegotiate'
        : dto.status === 'partial'
        ? 'partial'
        : dto.status === 'cancelled'
        ? 'cancel'
        : 'pay');

    if (action === 'skip' || action === 'cancel') {
      const nextStatus = action === 'cancel' ? 'cancelled' : 'skipped';
      priorHistory.push({
        type: nextStatus,
        priorDate: occ.expectedDate,
        priorAmount: Number(occ.expectedAmount),
        changedAt: new Date().toISOString(),
        reason: dto.reason || dto.varianceNotes || dto.notes || nextStatus,
      });
      const [updated] = await db
        .update(commitmentOccurrences)
        .set({
          status: nextStatus,
          historyJson: JSON.stringify(priorHistory),
          notes: dto.reason || dto.notes || occ.notes,
          updatedAt: new Date(),
        })
        .where(eq(commitmentOccurrences.id, occurrenceId))
        .returning();
      return { occurrence: updated, transactionId: null };
    }

    if (action === 'reschedule' || action === 'renegotiate') {
      const nextDate = dto.newDate || dto.actualDate || occ.expectedDate;
      const nextAmount = Number(dto.newAmount ?? dto.confirmedAmount ?? dto.actualAmount ?? occ.expectedAmount);
      priorHistory.push({
        type: action,
        priorDate: occ.expectedDate,
        priorAmount: Number(occ.expectedAmount),
        newDate: nextDate,
        newAmount: nextAmount,
        changedAt: new Date().toISOString(),
        reason: dto.reason || dto.varianceNotes || 'Schedule adjusted',
      });
      const [updated] = await db
        .update(commitmentOccurrences)
        .set({
          expectedDate: nextDate,
          expectedAmount: String(nextAmount),
          status: 'scheduled',
          historyJson: JSON.stringify(priorHistory),
          notes: dto.reason || dto.varianceNotes || occ.notes,
          updatedAt: new Date(),
        })
        .where(eq(commitmentOccurrences.id, occurrenceId))
        .returning();
      return { occurrence: updated, transactionId: null };
    }

    // Pay / Partial Payment: MUST have a posted transaction unless explicitly marked non-cash
    const expected = Number(occ.expectedAmount || 0);
    const alreadyPaid = Number(occ.paidAmount || 0);
    const paymentAmt = Number(dto.actualAmount ?? dto.confirmedAmount ?? Math.max(0, expected - alreadyPaid));
    if (!Number.isFinite(paymentAmt) || paymentAmt <= 0) {
      throw new Error('Settlement amount must be greater than zero');
    }
    const actualDate = dto.actualDate || new Date().toISOString().slice(0, 10);
    const cumulativePaid = Number((alreadyPaid + paymentAmt).toFixed(2));
    const isFull = cumulativePaid >= expected - 0.01 && action !== 'partial';
    const nextStatus = isFull ? 'completed' : 'partial';
    const variance = Number((cumulativePaid - expected).toFixed(2));

    const result = await db.transaction(async (txDb) => {
      let txId = dto.linkedTransactionId || occ.linkedTransactionId || null;

      if (!dto.isNonCashEvent && !txId) {
        const userWallets = await txDb.select().from(wallets).where(eq(wallets.userId, userId));
        const targetWallet =
          (dto.walletId ? userWallets.find((w) => w.id === dto.walletId) : null) ||
          userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
          userWallets.find((w) => w.type === 'Bank') ||
          userWallets[0];
        if (!targetWallet) throw new Error('No wallet available to post commitment settlement');

        const isIncomeSource = occ.sourceType === 'payroll' || occ.sourceType === 'recurring_income' || occ.title.includes('Receivable');
        const txType: 'Income' | 'Expense' = isIncomeSource ? 'Income' : 'Expense';
        const { rate, source } = await this.resolveHistoricalRateToMad(userId, occ.currency || 'MAD', actualDate, undefined, txDb);
        const madAmt = Number((paymentAmt * rate).toFixed(2));

        const [createdTx] = await txDb
          .insert(transactions)
          .values({
            userId,
            walletId: targetWallet.id,
            amount: String(madAmt),
            nativeAmount: String(paymentAmt),
            currency: occ.currency || 'MAD',
            exchangeRateUsed: String(rate),
            fxSource: source,
            idempotencyKey: `occ-settle-${occ.id}-${cumulativePaid.toFixed(2)}`,
            type: txType,
            category:
              occ.sourceType === 'subscription'
                ? '📱 Telecom & Subscriptions'
                : occ.sourceType === 'debt_installment'
                ? '💳 Debt & Obligations'
                : '📥 Income',
            notes: `Settled commitment: ${occ.title}`,
            createdAt: new Date(`${actualDate}T12:00:00.000Z`),
          })
          .returning();

        await this.postJournalEntryForTransaction(
          userId,
          createdTx,
          { idempotencyKey: `occ-journal-${createdTx.id}`, memo: `Commitment settlement: ${occ.title}` },
          txDb
        );
        txId = createdTx.id;
      }

      if (!dto.isNonCashEvent && !txId) {
        throw new Error('Completed cash commitment must link to a posted transaction');
      }

      // Update source schedule only after successful posting
      if (isFull && occ.sourceType === 'subscription') {
        const [sub] = await txDb
          .select()
          .from(subscriptions)
          .where(and(eq(subscriptions.id, occ.sourceId), eq(subscriptions.userId, userId)));
        if (sub) {
          const baseDate = sub.nextBillingDate ? new Date(sub.nextBillingDate) : new Date(actualDate);
          const rolled = this.advanceCommitmentDate(baseDate, sub.billingCycle);
          await txDb
            .update(subscriptions)
            .set({ nextBillingDate: rolled, status: sub.status === 'planned' ? 'active' : sub.status, updatedAt: new Date() })
            .where(eq(subscriptions.id, sub.id));
        }
      } else if (occ.sourceType === 'debt_installment') {
        const [debt] = await txDb
          .select()
          .from(debts)
          .where(and(eq(debts.id, occ.sourceId), eq(debts.userId, userId)));
        if (debt) {
          const nextRem = Math.max(0, Number((Number(debt.remainingBalance || 0) - paymentAmt).toFixed(2)));
          await txDb
            .update(debts)
            .set({
              remainingBalance: nextRem <= 0.01 ? '0' : String(nextRem),
              status: nextRem <= 0.01 ? 'Cleared' : 'Pending',
            })
            .where(eq(debts.id, debt.id));
        }
      }

      priorHistory.push({
        type: nextStatus,
        paymentAmt,
        cumulativePaid,
        linkedTransactionId: txId,
        settledAt: new Date().toISOString(),
      });

      const [updated] = await txDb
        .update(commitmentOccurrences)
        .set({
          status: nextStatus,
          isNonCashEvent: Boolean(dto.isNonCashEvent),
          paidAmount: String(cumulativePaid),
          actualAmount: String(cumulativePaid),
          actualDate,
          varianceAmount: String(variance),
          linkedTransactionId: txId,
          historyJson: JSON.stringify(priorHistory),
          notes: dto.varianceNotes || dto.notes || occ.notes,
          updatedAt: new Date(),
        })
        .where(eq(commitmentOccurrences.id, occurrenceId))
        .returning();

      return { occurrence: updated, transactionId: txId };
    });

    return result;
  }

  // ─── I. Auditable Goal & Sinking-Fund Contribution Events ───────────────────

  async getGoalContributionEvents(userId: string, goalId?: string) {
    if (goalId) {
      return await db
        .select()
        .from(goalContributionEvents)
        .where(and(eq(goalContributionEvents.userId, userId), eq(goalContributionEvents.goalId, goalId)))
        .orderBy(desc(goalContributionEvents.eventDate));
    }
    return await db
      .select()
      .from(goalContributionEvents)
      .where(eq(goalContributionEvents.userId, userId))
      .orderBy(desc(goalContributionEvents.eventDate));
  }

  // ─── J. Saved & Comparable Multi-Event What-If Scenarios ────────────────────

  async getSavedScenarios(userId: string) {
    return await db
      .select()
      .from(savedScenarios)
      .where(eq(savedScenarios.userId, userId))
      .orderBy(desc(savedScenarios.updatedAt));
  }

  async saveScenario(
    userId: string,
    dto: {
      id?: string;
      name: string;
      description?: string;
      baselineSnapshot: any;
      events: any[];
      assumptions: any;
      projectedSummary: any;
      isApprovedPlan?: boolean;
    }
  ) {
    if (!dto.name?.trim()) throw new Error('Scenario name is required');

    if (dto.id) {
      const [updated] = await db
        .update(savedScenarios)
        .set({
          name: dto.name.trim(),
          description: dto.description || '',
          baselineSnapshotJson: JSON.stringify(dto.baselineSnapshot || {}),
          eventsJson: JSON.stringify(dto.events || []),
          assumptionsJson: JSON.stringify(dto.assumptions || {}),
          projectedSummaryJson: JSON.stringify(dto.projectedSummary || {}),
          isApprovedPlan: Boolean(dto.isApprovedPlan),
          updatedAt: new Date(),
        })
        .where(and(eq(savedScenarios.id, dto.id), eq(savedScenarios.userId, userId)))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(savedScenarios)
      .values({
        userId,
        name: dto.name.trim(),
        description: dto.description || '',
        baselineSnapshotJson: JSON.stringify(dto.baselineSnapshot || {}),
        eventsJson: JSON.stringify(dto.events || []),
        assumptionsJson: JSON.stringify(dto.assumptions || {}),
        projectedSummaryJson: JSON.stringify(dto.projectedSummary || {}),
        isApprovedPlan: Boolean(dto.isApprovedPlan),
      })
      .returning();
    return created;
  }

  async deleteScenario(userId: string, scenarioId: string) {
    await db
      .delete(savedScenarios)
      .where(and(eq(savedScenarios.id, scenarioId), eq(savedScenarios.userId, userId)));
    return { success: true };
  }

  // ─── K. Complete User-Configurable Financial Rules Engine & Dry-Run ─────────

  async getFinancialRules(userId: string) {
    const [rules, logs] = await Promise.all([
      db
        .select()
        .from(financialRules)
        .where(eq(financialRules.userId, userId))
        .orderBy(desc(financialRules.createdAt)),
      db
        .select()
        .from(financialRuleLogs)
        .where(eq(financialRuleLogs.userId, userId))
        .orderBy(desc(financialRuleLogs.createdAt)),
    ]);
    return { rules, logs: logs.slice(0, 50) };
  }

  async upsertFinancialRule(
    userId: string,
    dto: {
      id?: string;
      name: string;
      enabled?: boolean;
      triggerType: string;
      conditions: Record<string, any>;
      actionType: string;
      actionPayload: Record<string, any>;
      approvalPolicy?: string;
    }
  ) {
    const allowedTriggers = new Set([
      'salary_confirmed',
      'transaction_posted',
      'balance_threshold_crossed',
      'commitment_approaching',
      'budget_pace_crossed',
    ]);
    const allowedActions = new Set([
      'send_notification',
      'create_review_draft',
      'suggest_category',
      'prepare_allocation',
    ]);
    if (!allowedTriggers.has(dto.triggerType)) {
      throw new Error(`Unsupported trigger type: ${dto.triggerType}`);
    }
    if (!allowedActions.has(dto.actionType)) {
      throw new Error(
        `Safety policy violation: autonomous money movement is prohibited. Allowed actions: ${[...allowedActions].join(', ')}`
      );
    }

    // Validate typed condition schema
    const c = dto.conditions || {};
    const sanitizedConditions: Record<string, any> = {
      ...(c.transactionType ? { transactionType: String(c.transactionType) } : {}),
      ...(c.walletId ? { walletId: String(c.walletId) } : {}),
      ...(c.category ? { category: String(c.category) } : {}),
      ...(c.counterparty ? { counterparty: String(c.counterparty) } : {}),
      ...(c.descriptionContains ? { descriptionContains: String(c.descriptionContains) } : {}),
      ...(c.contextId ? { contextId: String(c.contextId) } : {}),
      ...(c.minAmount !== undefined && c.minAmount !== '' ? { minAmount: Number(c.minAmount) } : {}),
      ...(c.maxAmount !== undefined && c.maxAmount !== '' ? { maxAmount: Number(c.maxAmount) } : {}),
      ...(c.thresholdMad !== undefined && c.thresholdMad !== '' ? { thresholdMad: Number(c.thresholdMad) } : {}),
      ...(c.pacePercent !== undefined && c.pacePercent !== '' ? { pacePercent: Number(c.pacePercent) } : {}),
      ...(c.withinDays !== undefined && c.withinDays !== '' ? { withinDays: Number(c.withinDays) } : {}),
      ...(c.cooldownHours !== undefined ? { cooldownHours: Math.max(0, Number(c.cooldownHours)) } : {}),
    };

    if (dto.id) {
      const [existing] = await db
        .select()
        .from(financialRules)
        .where(and(eq(financialRules.id, dto.id), eq(financialRules.userId, userId)));
      if (!existing) throw new Error('Rule not found');

      const [updated] = await db
        .update(financialRules)
        .set({
          name: dto.name.trim(),
          enabled: dto.enabled ?? existing.enabled,
          triggerType: dto.triggerType,
          conditionsJson: JSON.stringify(sanitizedConditions),
          actionType: dto.actionType,
          actionPayloadJson: JSON.stringify(dto.actionPayload || {}),
          approvalPolicy: dto.approvalPolicy || existing.approvalPolicy,
          version: (existing.version || 1) + 1,
          updatedAt: new Date(),
        })
        .where(eq(financialRules.id, dto.id))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(financialRules)
      .values({
        userId,
        name: dto.name.trim(),
        enabled: dto.enabled ?? true,
        triggerType: dto.triggerType,
        conditionsJson: JSON.stringify(sanitizedConditions),
        actionType: dto.actionType,
        actionPayloadJson: JSON.stringify(dto.actionPayload || {}),
        approvalPolicy: dto.approvalPolicy || 'notify_only',
        version: 1,
      })
      .returning();
    return created;
  }

  async deleteFinancialRule(userId: string, ruleId: string) {
    await db
      .delete(financialRules)
      .where(and(eq(financialRules.id, ruleId), eq(financialRules.userId, userId)));
    return { success: true };
  }

  /** Pure deterministic condition evaluator used by live evaluation AND dry-run mode */
  evaluateRuleConditions(
    cond: Record<string, any>,
    eventContext: {
      amount?: number;
      transactionType?: string;
      category?: string;
      walletId?: string;
      counterparty?: string;
      description?: string;
      contextId?: string;
      walletBalanceMad?: number;
      pacePercent?: number;
      withinDays?: number;
    }
  ) {
    const matchedConditions: string[] = [];
    const failedConditions: string[] = [];

    if (cond.transactionType) {
      if (eventContext.transactionType === cond.transactionType) {
        matchedConditions.push(`type == ${cond.transactionType}`);
      } else {
        failedConditions.push(`type != ${cond.transactionType}`);
      }
    }
    if (cond.walletId) {
      if (eventContext.walletId === cond.walletId) {
        matchedConditions.push(`walletId matched`);
      } else {
        failedConditions.push(`walletId did not match`);
      }
    }
    if (cond.contextId) {
      if (eventContext.contextId === cond.contextId) {
        matchedConditions.push(`contextId matched`);
      } else {
        failedConditions.push(`contextId did not match`);
      }
    }
    if (cond.minAmount !== undefined && Number.isFinite(Number(cond.minAmount))) {
      if ((eventContext.amount ?? 0) >= Number(cond.minAmount)) {
        matchedConditions.push(`amount >= ${cond.minAmount}`);
      } else {
        failedConditions.push(`amount < ${cond.minAmount}`);
      }
    }
    if (cond.maxAmount !== undefined && Number.isFinite(Number(cond.maxAmount))) {
      if ((eventContext.amount ?? 0) <= Number(cond.maxAmount)) {
        matchedConditions.push(`amount <= ${cond.maxAmount}`);
      } else {
        failedConditions.push(`amount > ${cond.maxAmount}`);
      }
    }
    if (cond.category) {
      if ((eventContext.category || '').toLowerCase().includes(String(cond.category).toLowerCase())) {
        matchedConditions.push(`category matches "${cond.category}"`);
      } else {
        failedConditions.push(`category missing "${cond.category}"`);
      }
    }
    const textNeedle = cond.counterparty || cond.descriptionContains;
    if (textNeedle) {
      const hay = `${eventContext.counterparty || ''} ${eventContext.description || ''}`.toLowerCase();
      if (hay.includes(String(textNeedle).toLowerCase())) {
        matchedConditions.push(`text contains "${textNeedle}"`);
      } else {
        failedConditions.push(`text missing "${textNeedle}"`);
      }
    }
    if (cond.thresholdMad !== undefined && Number.isFinite(Number(cond.thresholdMad))) {
      if ((eventContext.walletBalanceMad ?? eventContext.amount ?? Infinity) <= Number(cond.thresholdMad)) {
        matchedConditions.push(`balance <= ${cond.thresholdMad} MAD`);
      } else {
        failedConditions.push(`balance > ${cond.thresholdMad} MAD`);
      }
    }
    if (cond.pacePercent !== undefined && Number.isFinite(Number(cond.pacePercent))) {
      if ((eventContext.pacePercent ?? 0) >= Number(cond.pacePercent)) {
        matchedConditions.push(`budget pace >= ${cond.pacePercent}%`);
      } else {
        failedConditions.push(`budget pace < ${cond.pacePercent}%`);
      }
    }
    if (cond.withinDays !== undefined && Number.isFinite(Number(cond.withinDays))) {
      if ((eventContext.withinDays ?? 999) <= Number(cond.withinDays)) {
        matchedConditions.push(`due within ${cond.withinDays}d`);
      } else {
        failedConditions.push(`due after ${cond.withinDays}d`);
      }
    }

    return {
      matched: failedConditions.length === 0,
      matchedConditions,
      failedConditions,
    };
  }

  describeProposedRuleResult(
    rule: { name: string; actionType: string; approvalPolicy: string },
    payload: Record<string, any>,
    eventContext: Record<string, any>,
    triggerType: string
  ) {
    if (rule.actionType === 'create_review_draft') {
      return {
        summary: `Would create Review Inbox draft: ${payload.description || eventContext.description || rule.name}`,
        requiresApproval: true,
        outcomeStatus: 'draft_created',
      };
    }
    if (rule.actionType === 'suggest_category') {
      return {
        summary: `Would suggest category "${payload.suggestedCategory || payload.category || 'Reviewed Category'}" via Review Inbox`,
        requiresApproval: true,
        outcomeStatus: 'draft_created',
      };
    }
    if (rule.actionType === 'prepare_allocation') {
      return {
        summary: `Would prepare allocation proposal (${payload.percent || 20}% -> ${payload.target || 'Savings/Investments'}) awaiting user approval`,
        requiresApproval: true,
        outcomeStatus: 'awaiting_approval',
      };
    }
    return {
      summary: `Would send notification alert for "${rule.name}" (${triggerType})`,
      requiresApproval: false,
      outcomeStatus: 'notified',
    };
  }

  async dryRunFinancialRule(
    userId: string,
    dto: {
      ruleId?: string;
      name?: string;
      triggerType: string;
      conditions: Record<string, any>;
      actionType: string;
      actionPayload?: Record<string, any>;
      approvalPolicy?: string;
      sampleEvent: Record<string, any>;
    }
  ) {
    let ruleObj = {
      name: dto.name || 'Preview Rule',
      triggerType: dto.triggerType,
      actionType: dto.actionType,
      approvalPolicy: dto.approvalPolicy || 'notify_only',
    };
    let cond = dto.conditions || {};
    let payload = dto.actionPayload || {};

    if (dto.ruleId) {
      const [existing] = await db
        .select()
        .from(financialRules)
        .where(and(eq(financialRules.id, dto.ruleId), eq(financialRules.userId, userId)));
      if (!existing) throw new Error('Rule not found');
      ruleObj = {
        name: existing.name,
        triggerType: existing.triggerType,
        actionType: existing.actionType,
        approvalPolicy: existing.approvalPolicy,
      };
      cond = JSON.parse(existing.conditionsJson || '{}');
      payload = JSON.parse(existing.actionPayloadJson || '{}');
    }

    const evaluation = this.evaluateRuleConditions(cond, dto.sampleEvent || {});
    const proposed = this.describeProposedRuleResult(ruleObj, payload, dto.sampleEvent || {}, ruleObj.triggerType);
    return {
      ...evaluation,
      triggerType: ruleObj.triggerType,
      actionType: ruleObj.actionType,
      proposedResultSummary: proposed.summary,
      requiresApproval: proposed.requiresApproval,
      sideEffects: 'none',
    };
  }

  async evaluateRulesForTrigger(
    userId: string,
    triggerType: string,
    eventContext: {
      amount?: number;
      transactionType?: string;
      category?: string;
      walletId?: string;
      counterparty?: string;
      description?: string;
      contextId?: string;
      walletBalanceMad?: number;
      pacePercent?: number;
      withinDays?: number;
      eventId?: string;
    }
  ) {
    const activeRules = await db
      .select()
      .from(financialRules)
      .where(
        and(
          eq(financialRules.userId, userId),
          eq(financialRules.triggerType, triggerType),
          eq(financialRules.enabled, true)
        )
      );

    const results = [];
    for (const rule of activeRules) {
      const cond = JSON.parse(rule.conditionsJson || '{}');
      const payload = JSON.parse(rule.actionPayloadJson || '{}');

      // Cooldown enforcement
      const cooldownHours = Number(cond.cooldownHours ?? 0);
      if (cooldownHours > 0 && rule.lastTriggeredAt) {
        const elapsedHours = (Date.now() - new Date(rule.lastTriggeredAt).getTime()) / 3600000;
        if (elapsedHours < cooldownHours) {
          continue;
        }
      }

      const evalRes = this.evaluateRuleConditions(cond, eventContext);
      if (!evalRes.matched) continue;

      const idempotencyKey = `${rule.id}:v${rule.version}:${triggerType}:${eventContext.eventId || new Date().toISOString().slice(0, 13)}`;
      const existingLog = await db
        .select()
        .from(financialRuleLogs)
        .where(eq(financialRuleLogs.idempotencyKey, idempotencyKey));
      if (existingLog.length > 0) continue;

      const proposed = this.describeProposedRuleResult(rule, payload, eventContext, triggerType);
      let proposedSummary = `${proposed.summary} [Matched: ${evalRes.matchedConditions.join(', ') || 'trigger'}]`;
      let outcomeStatus = proposed.outcomeStatus;

      if (rule.actionType === 'create_review_draft') {
        await this.createReviewItem(userId, {
          sourceType: 'recurring_suggestion',
          confidenceScore: 0.9,
          parsedAmount: Number(payload.amount || eventContext.amount || 0),
          parsedDescription: payload.description || `Rule Draft: ${rule.name}`,
          parsedCategory: payload.category || eventContext.category || '🛟 Emergency & goals Fund',
          parsedType: payload.type || 'Transfer',
          walletId: eventContext.walletId || null,
        });
      } else if (rule.actionType === 'suggest_category') {
        await this.createReviewItem(userId, {
          sourceType: 'rule_category_suggestion',
          confidenceScore: 0.92,
          parsedAmount: Number(eventContext.amount || 0),
          parsedDescription: `Category Suggestion (${payload.suggestedCategory || payload.category || 'Reviewed'}): ${eventContext.description || rule.name}`,
          parsedCategory: payload.suggestedCategory || payload.category || eventContext.category || '🛒 Groceries',
          parsedType: (eventContext.transactionType as any) || 'Expense',
          walletId: eventContext.walletId || null,
        });
      } else if (rule.actionType === 'prepare_allocation') {
        const pct = Number(payload.percent || 20);
        const baseAmt = Number(eventContext.amount || 0);
        const allocAmt = Number((payload.amount || (baseAmt > 0 ? (baseAmt * pct) / 100 : 0)).toFixed(2));
        await this.createReviewItem(userId, {
          sourceType: 'allocation_proposal',
          confidenceScore: 0.95,
          parsedAmount: allocAmt > 0 ? allocAmt : 100,
          parsedDescription: payload.description || `Allocation Proposal (${pct}% -> ${payload.target || 'Savings/Investments'}): ${rule.name}`,
          parsedCategory: payload.category || '🛟 Emergency & goals Fund',
          parsedType: 'Transfer',
          walletId: payload.targetWalletId || eventContext.walletId || null,
        });
      } else if (rule.actionType === 'send_notification') {
        await pushService
          .sendNotification(userId, 'rule_alert', idempotencyKey, {
            title: `TrueSpend Rule: ${rule.name}`,
            body: proposed.summary,
            tag: `rule-${rule.id}`,
          })
          .catch(() => undefined);
      }

      const [logEntry] = await db
        .insert(financialRuleLogs)
        .values({
          ruleId: rule.id,
          userId,
          ruleVersion: rule.version,
          triggerEventSummary: `${triggerType}: ${eventContext.description || ''} (${eventContext.amount ?? 0} MAD)`,
          proposedResultSummary: proposedSummary,
          outcomeStatus,
          idempotencyKey,
        })
        .returning();

      await db
        .update(financialRules)
        .set({ lastTriggeredAt: new Date() })
        .where(eq(financialRules.id, rule.id));

      results.push(logEntry);
    }

    return results;
  }

  async evaluatePostCommitThresholds(userId: string, walletId?: string | null, category?: string | null, eventId?: string) {
    const [userWallets, userTx, userBudgets] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(categoryBudgets).where(eq(categoryBudgets.userId, userId)),
    ]);

    if (walletId) {
      const targetW = userWallets.find((w) => w.id === walletId);
      if (targetW) {
        let bal = Number(targetW.initialBalance || 0);
        for (const tx of userTx) {
          const amt = Number(tx.amount || 0);
          if (tx.walletId === walletId) bal += tx.type === 'Income' ? amt : -amt;
          if (tx.destinationWalletId === walletId && tx.type === 'Transfer') bal += amt;
        }
        await this.evaluateRulesForTrigger(userId, 'balance_threshold_crossed', {
          walletId,
          walletBalanceMad: Number(bal.toFixed(2)),
          amount: Number(bal.toFixed(2)),
          description: `${targetW.name} balance is ${bal.toFixed(0)} MAD`,
          eventId: `bal-${walletId}-${eventId || new Date().toISOString().slice(0, 10)}`,
        });
      }
    }

    if (category) {
      const now = new Date();
      const monthBudget = userBudgets.find(
        (b) => b.year === now.getUTCFullYear() && b.month === now.getUTCMonth() + 1 && b.category.toLowerCase() === category.toLowerCase()
      );
      if (monthBudget && Number(monthBudget.amount) > 0) {
        const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
        const spentThisMonth = userTx
          .filter((t) => t.type === 'Expense' && (t.category || '').toLowerCase() === category.toLowerCase() && t.createdAt && new Date(t.createdAt) >= monthStart)
          .reduce((s, t) => s + Number(t.amount || 0), 0);
        const limit = Number(monthBudget.amount) + Number(monthBudget.rolloverAmount || 0);
        const pacePercent = limit > 0 ? Number(((spentThisMonth / limit) * 100).toFixed(1)) : 0;
        await this.evaluateRulesForTrigger(userId, 'budget_pace_crossed', {
          category,
          pacePercent,
          amount: Number(spentThisMonth.toFixed(2)),
          description: `${category} at ${pacePercent}% of budget`,
          eventId: `pace-${category}-${now.getUTCFullYear()}-${now.getUTCMonth() + 1}`,
        });
      }
    }
  }

  async evaluateUpcomingCommitmentRules(userId: string) {
    const occs = await db
      .select()
      .from(commitmentOccurrences)
      .where(and(eq(commitmentOccurrences.userId, userId), eq(commitmentOccurrences.status, 'scheduled')));
    const nowMs = Date.now();
    for (const occ of occs) {
      const dueMs = new Date(`${occ.expectedDate}T12:00:00Z`).getTime();
      const withinDays = Math.ceil((dueMs - nowMs) / 86400000);
      if (withinDays >= 0 && withinDays <= 14) {
        await this.evaluateRulesForTrigger(userId, 'commitment_approaching', {
          amount: Number(occ.expectedAmount || 0),
          withinDays,
          description: occ.title,
          counterparty: occ.title,
          eventId: `commit-${occ.id}-${occ.expectedDate}`,
        }).catch(() => undefined);
      }
    }
  }

  // ─── L. External Assets, Valuation History & Whole Financial Position ───────

  async getExternalWealthItems(userId: string) {
    const [items, valuations, ratesRes] = await Promise.all([
      db.select().from(externalWealthItems).where(eq(externalWealthItems.userId, userId)).orderBy(desc(externalWealthItems.valuationDate)),
      db.select().from(externalWealthValuations).where(eq(externalWealthValuations.userId, userId)).orderBy(desc(externalWealthValuations.valuationDate)),
      this.getExchangeRates(userId),
    ]);

    const now = Date.now();
    const enriched = items.map((item) => {
      const valDate = new Date(item.valuationDate).getTime();
      const ageDays = Number.isNaN(valDate) ? 0 : Math.floor((now - valDate) / (1000 * 60 * 60 * 24));
      const itemHistory = valuations.filter((v) => v.itemId === item.id);
      const latestHist = itemHistory[0];
      const fxRate = latestHist
        ? Number(latestHist.fxRateUsed)
        : ratesRes.ratesToMad[(item.currency || 'MAD').toUpperCase()] || 1;
      const valueMad = Number((Number(item.estimatedValue || 0) * fxRate).toFixed(2));
      return {
        ...item,
        ageDays,
        isStaleEstimate: ageDays > 90,
        fxRateUsed: fxRate,
        valueMad,
        valuationHistory: itemHistory.slice(0, 10),
      };
    });

    const totalExternalAssetsMad = enriched.filter((i) => !i.isLiability).reduce((s, i) => s + i.valueMad, 0);
    const totalExternalLiabilitiesMad = enriched.filter((i) => i.isLiability).reduce((s, i) => s + i.valueMad, 0);

    return {
      items: enriched,
      totalExternalAssetsMad: Number(totalExternalAssetsMad.toFixed(2)),
      totalExternalLiabilitiesMad: Number(totalExternalLiabilitiesMad.toFixed(2)),
      netExternalWealthMad: Number((totalExternalAssetsMad - totalExternalLiabilitiesMad).toFixed(2)),
    };
  }

  async upsertExternalWealthItem(
    userId: string,
    dto: {
      id?: string;
      name: string;
      itemClass: string;
      isLiability?: boolean;
      isLiquid?: boolean;
      estimatedValue: number;
      currency?: string;
      valuationDate?: string;
      valuationSource?: string;
      confidenceLevel?: string;
      isExternallyVerified?: boolean;
      notes?: string;
    }
  ) {
    if (!dto.name?.trim()) throw new Error('Asset/liability name is required');
    const val = Number(dto.estimatedValue);
    if (!Number.isFinite(val) || val < 0) throw new Error('Estimated value must be non-negative');
    const currency = (dto.currency || 'MAD').toUpperCase();
    const valuationDate = dto.valuationDate || new Date().toISOString().slice(0, 10);
    const { rate: fxRate, source: fxSource } = await this.resolveHistoricalRateToMad(userId, currency, valuationDate);
    const valueMad = Number((val * fxRate).toFixed(2));

    let item: any;
    if (dto.id) {
      const [updated] = await db
        .update(externalWealthItems)
        .set({
          name: dto.name.trim(),
          itemClass: dto.itemClass,
          isLiability: Boolean(dto.isLiability),
          isLiquid: Boolean(dto.isLiquid),
          estimatedValue: String(val),
          currency,
          valuationDate,
          valuationSource: dto.valuationSource || 'manual_estimate',
          confidenceLevel: dto.confidenceLevel || 'medium',
          isExternallyVerified: Boolean(dto.isExternallyVerified),
          notes: dto.notes || null,
          updatedAt: new Date(),
        })
        .where(and(eq(externalWealthItems.id, dto.id), eq(externalWealthItems.userId, userId)))
        .returning();
      item = updated;
    } else {
      const [created] = await db
        .insert(externalWealthItems)
        .values({
          userId,
          name: dto.name.trim(),
          itemClass: dto.itemClass || 'Property',
          isLiability: Boolean(dto.isLiability),
          isLiquid: Boolean(dto.isLiquid),
          estimatedValue: String(val),
          currency,
          valuationDate,
          valuationSource: dto.valuationSource || 'manual_estimate',
          confidenceLevel: dto.confidenceLevel || 'medium',
          isExternallyVerified: Boolean(dto.isExternallyVerified),
          notes: dto.notes || null,
        })
        .returning();
      item = created;
    }

    // Preserve valuation history on every create/update instead of overwriting the only valuation
    if (item?.id) {
      await db.insert(externalWealthValuations).values({
        itemId: item.id,
        userId,
        estimatedValue: String(val),
        currency,
        fxRateUsed: String(fxRate),
        fxSource,
        valueMad: String(valueMad),
        valuationDate,
        valuationSource: dto.valuationSource || 'manual_estimate',
        confidenceLevel: dto.confidenceLevel || 'medium',
        notes: dto.notes || null,
      });
    }

    return item;
  }

  async deleteExternalWealthItem(userId: string, itemId: string) {
    await db
      .delete(externalWealthItems)
      .where(and(eq(externalWealthItems.id, itemId), eq(externalWealthItems.userId, userId)));
    return { success: true };
  }

  // ─── 3. Whole-Financial-Position History & Net Worth Change Bridge ────────

  computeNetWorthChangeBridge(
    prev: {
      bankBalanceMad: number;
      cashBalanceMad: number;
      savingsBalanceMad: number;
      investmentCashMad: number;
      creditCardLiabilityMad: number;
      overdraftLiabilityMad: number;
      receivablesMad: number;
      payablesMad: number;
      investmentMarketValueMad: number;
      externalAssetsMad: number;
      externalLiabilitiesMad: number;
      totalNetWorthMad: number;
    },
    curr: typeof prev
  ) {
    const prevLiquid = prev.bankBalanceMad + prev.cashBalanceMad + prev.savingsBalanceMad + prev.investmentCashMad;
    const currLiquid = curr.bankBalanceMad + curr.cashBalanceMad + curr.savingsBalanceMad + curr.investmentCashMad;
    const deltaLiquidCashMad = Number((currLiquid - prevLiquid).toFixed(2));
    // Credit/overdraft debt decreases net worth when liabilities increase, so signed contribution is -(curr - prev)
    const prevCredit = prev.creditCardLiabilityMad + prev.overdraftLiabilityMad;
    const currCredit = curr.creditCardLiabilityMad + curr.overdraftLiabilityMad;
    const deltaCreditDebtMad = Number((prevCredit - currCredit).toFixed(2));
    const deltaReceivablesMad = Number((curr.receivablesMad - prev.receivablesMad).toFixed(2));
    const deltaPayablesMad = Number((prev.payablesMad - curr.payablesMad).toFixed(2));
    const deltaInvestmentsMad = Number((curr.investmentMarketValueMad - prev.investmentMarketValueMad).toFixed(2));
    const deltaExternalNetMad = Number(
      ((curr.externalAssetsMad - curr.externalLiabilitiesMad) -
        (prev.externalAssetsMad - prev.externalLiabilitiesMad)).toFixed(2)
    );
    const totalDeltaMad = Number(
      (
        deltaLiquidCashMad +
        deltaCreditDebtMad +
        deltaReceivablesMad +
        deltaPayablesMad +
        deltaInvestmentsMad +
        deltaExternalNetMad
      ).toFixed(2)
    );

    return {
      totalDeltaMad,
      deltaLiquidCashMad,
      deltaCreditDebtMad,
      deltaReceivablesMad,
      deltaPayablesMad,
      deltaInvestmentsMad,
      deltaExternalNetMad,
      cashFlowChangeMad: deltaLiquidCashMad,
      debtNetChangeMad: Number((deltaCreditDebtMad + deltaReceivablesMad + deltaPayablesMad).toFixed(2)),
      investmentMarketChangeMad: deltaInvestmentsMad,
      externalRevaluationMad: deltaExternalNetMad,
    };
  }

  async captureFinancialPositionSnapshot(userId: string, triggerSource = 'manual') {
    const todayStr = new Date().toISOString().slice(0, 10);
    const [userWallets, userTx, userDebts, positions, extWealth, fxRes] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(debts).where(eq(debts.userId, userId)),
      db.select().from(stockPositions).where(eq(stockPositions.userId, userId)),
      this.getExternalWealthItems(userId),
      this.getExchangeRates(userId),
    ]);

    const walletBalances = new Map<string, number>();
    for (const w of userWallets) {
      walletBalances.set(w.id, Number(w.initialBalance || 0));
    }
    for (const tx of userTx) {
      const amt = Number(tx.amount || 0);
      if (tx.walletId && walletBalances.has(tx.walletId)) {
        const cur = walletBalances.get(tx.walletId)!;
        walletBalances.set(tx.walletId, tx.type === 'Income' ? cur + amt : cur - amt);
      }
      if (tx.destinationWalletId && tx.type === 'Transfer' && walletBalances.has(tx.destinationWalletId)) {
        walletBalances.set(tx.destinationWalletId, walletBalances.get(tx.destinationWalletId)! + amt);
      }
    }

    let bankBalanceMad = 0;
    let cashBalanceMad = 0;
    let savingsBalanceMad = 0;
    let investmentCashMad = 0;
    let creditCardLiabilityMad = 0;
    let overdraftLiabilityMad = 0;

    for (const w of userWallets) {
      const rawBal = walletBalances.get(w.id) || 0;
      const rate = fxRes.ratesToMad[(w.currency || 'MAD').toUpperCase()] || 1;
      const balMad = rawBal * rate;
      if (w.accountSubtype === 'CreditCard') {
        creditCardLiabilityMad += Math.max(0, Number(w.liabilityBalance || 0) * rate || Math.max(0, -balMad));
      } else if (w.accountSubtype === 'Overdraft') {
        overdraftLiabilityMad += Math.max(0, Number(w.liabilityBalance || 0) * rate || Math.max(0, -balMad));
      } else if (w.type === 'Cash') {
        cashBalanceMad += balMad;
      } else if (w.type === 'Savings') {
        savingsBalanceMad += balMad;
      } else if (w.type === 'Investment') {
        investmentCashMad += balMad;
      } else {
        bankBalanceMad += balMad;
      }
    }

    const receivablesMad = userDebts
      .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
      .reduce((s, d) => s + Number(d.remainingBalance || 0) * (fxRes.ratesToMad[(d.currency || 'MAD').toUpperCase()] || 1), 0);
    const payablesMad = userDebts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((s, d) => s + Number(d.remainingBalance || 0) * (fxRes.ratesToMad[(d.currency || 'MAD').toUpperCase()] || 1), 0);

    const investmentMarketValueMad = positions
      .filter((p) => !p.isWatchlistOnly)
      .reduce((s, p) => {
        const rate = fxRes.ratesToMad[(p.currency || 'USD').toUpperCase()] || 1;
        return s + Number(p.shares || 0) * Number(p.currentPrice || 0) * rate;
      }, 0);

    const externalAssetsMad = extWealth.totalExternalAssetsMad;
    const externalLiabilitiesMad = extWealth.totalExternalLiabilitiesMad;
    const liquidNetWorthMad =
      bankBalanceMad + cashBalanceMad + savingsBalanceMad + investmentCashMad - creditCardLiabilityMad - overdraftLiabilityMad;
    const totalNetWorthMad =
      liquidNetWorthMad + investmentMarketValueMad + receivablesMad - payablesMad + externalAssetsMad - externalLiabilitiesMad;

    const hasManualOrStale = extWealth.items.some((i: any) => i.isStaleEstimate || i.valuationSource === 'manual_estimate');

    const snapshotValues = {
      userId,
      snapshotDate: todayStr,
      reportingCurrency: 'MAD',
      bankBalanceMad: String(bankBalanceMad.toFixed(2)),
      cashBalanceMad: String(cashBalanceMad.toFixed(2)),
      savingsBalanceMad: String(savingsBalanceMad.toFixed(2)),
      investmentCashMad: String(investmentCashMad.toFixed(2)),
      creditCardLiabilityMad: String(creditCardLiabilityMad.toFixed(2)),
      overdraftLiabilityMad: String(overdraftLiabilityMad.toFixed(2)),
      receivablesMad: String(receivablesMad.toFixed(2)),
      payablesMad: String(payablesMad.toFixed(2)),
      investmentMarketValueMad: String(investmentMarketValueMad.toFixed(2)),
      externalAssetsMad: String(externalAssetsMad.toFixed(2)),
      externalLiabilitiesMad: String(externalLiabilitiesMad.toFixed(2)),
      totalNetWorthMad: String(totalNetWorthMad.toFixed(2)),
      liquidNetWorthMad: String(liquidNetWorthMad.toFixed(2)),
      fxRatesJson: JSON.stringify(fxRes.ratesToMad),
      componentsJson: JSON.stringify({
        walletCount: userWallets.length,
        positionsCount: positions.filter((p) => !p.isWatchlistOnly).length,
        externalItemsCount: extWealth.items.length,
        staleExternalCount: extWealth.items.filter((i: any) => i.isStaleEstimate).length,
      }),
      dataSource: hasManualOrStale ? 'mixed_verified_and_estimated' : 'verified_computed',
      confidenceLevel: hasManualOrStale ? 'medium' : 'high',
      isEstimated: hasManualOrStale,
      triggerSource,
    };

    const existing = await db
      .select()
      .from(financialPositionSnapshots)
      .where(and(eq(financialPositionSnapshots.userId, userId), eq(financialPositionSnapshots.snapshotDate, todayStr)));

    if (existing.length > 0) {
      const [updated] = await db
        .update(financialPositionSnapshots)
        .set(snapshotValues)
        .where(eq(financialPositionSnapshots.id, existing[0].id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(financialPositionSnapshots).values(snapshotValues).returning();
    return created;
  }

  async getFinancialPositionHistory(userId: string) {
    // Ensure today's snapshot exists cleanly
    await this.captureFinancialPositionSnapshot(userId, 'daily').catch(() => undefined);
    const snapshots = await db
      .select()
      .from(financialPositionSnapshots)
      .where(eq(financialPositionSnapshots.userId, userId))
      .orderBy(desc(financialPositionSnapshots.snapshotDate));

    let bridge = null;
    if (snapshots.length >= 2) {
      const toNum = (s: any) => ({
        bankBalanceMad: Number(s.bankBalanceMad || 0),
        cashBalanceMad: Number(s.cashBalanceMad || 0),
        savingsBalanceMad: Number(s.savingsBalanceMad || 0),
        investmentCashMad: Number(s.investmentCashMad || 0),
        creditCardLiabilityMad: Number(s.creditCardLiabilityMad || 0),
        overdraftLiabilityMad: Number(s.overdraftLiabilityMad || 0),
        receivablesMad: Number(s.receivablesMad || 0),
        payablesMad: Number(s.payablesMad || 0),
        investmentMarketValueMad: Number(s.investmentMarketValueMad || 0),
        externalAssetsMad: Number(s.externalAssetsMad || 0),
        externalLiabilitiesMad: Number(s.externalLiabilitiesMad || 0),
        totalNetWorthMad: Number(s.totalNetWorthMad || 0),
      });
      bridge = {
        fromDate: snapshots[snapshots.length - 1].snapshotDate,
        toDate: snapshots[0].snapshotDate,
        ...this.computeNetWorthChangeBridge(toNum(snapshots[snapshots.length - 1]), toNum(snapshots[0])),
      };
    }

    return { snapshots: snapshots.slice(0, 90), bridge };
  }

  // ─── 4. Counterparty & Merchant Identity Layer ────────────────────────────

  normalizeCounterpartyName(raw: string): string {
    return (raw || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async getCounterparties(userId: string) {
    const [list, userTx, userDebts, userSubs] = await Promise.all([
      db.select().from(counterparties).where(eq(counterparties.userId, userId)),
      db.select().from(transactions).where(eq(transactions.userId, userId)),
      db.select().from(debts).where(eq(debts.userId, userId)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
    ]);

    return list.map((cp) => {
      const aliases: string[] = (() => {
        try {
          return JSON.parse(cp.aliasesJson || '[]');
        } catch {
          return [];
        }
      })();
      const needles = [cp.canonicalName, ...aliases].map((s) => this.normalizeCounterpartyName(s)).filter(Boolean);
      const matchedTxs = userTx.filter(
        (t) =>
          t.counterpartyId === cp.id ||
          needles.some((n) => this.normalizeCounterpartyName(t.notes || '').includes(n))
      );
      const totalSpendMad = matchedTxs
        .filter((t) => t.type === 'Expense')
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const totalIncomeMad = matchedTxs
        .filter((t) => t.type === 'Income')
        .reduce((s, t) => s + Number(t.amount || 0), 0);
      const linkedDebts = userDebts.filter(
        (d) =>
          d.counterpartyId === cp.id ||
          needles.some((n) => this.normalizeCounterpartyName(d.contactName).includes(n))
      );
      const linkedSubs = userSubs.filter(
        (s) =>
          s.counterpartyId === cp.id ||
          needles.some((n) => this.normalizeCounterpartyName(s.name).includes(n))
      );

      return {
        ...cp,
        aliases,
        totalSpendMad: Number(totalSpendMad.toFixed(2)),
        totalIncomeMad: Number(totalIncomeMad.toFixed(2)),
        transactionCount: matchedTxs.length,
        outstandingReceivablesMad: linkedDebts
          .filter((d) => d.type === 'Receivable' && d.status === 'Pending')
          .reduce((s, d) => s + Number(d.remainingBalance || 0), 0),
        outstandingPayablesMad: linkedDebts
          .filter((d) => d.type === 'Payable' && d.status === 'Pending')
          .reduce((s, d) => s + Number(d.remainingBalance || 0), 0),
        subscriptionsCount: linkedSubs.length,
      };
    });
  }

  async upsertCounterparty(
    userId: string,
    dto: {
      id?: string;
      canonicalName: string;
      counterpartyType?: string;
      aliases?: string[];
      defaultCategory?: string | null;
      website?: string | null;
      logoUrl?: string | null;
      contactDetails?: string | null;
      notes?: string | null;
    }
  ) {
    const canonicalName = dto.canonicalName?.trim();
    if (!canonicalName) throw new Error('Canonical name is required');
    const normalizedName = this.normalizeCounterpartyName(canonicalName);
    const aliases = Array.from(new Set((dto.aliases || []).map((a) => a.trim()).filter(Boolean)));

    if (dto.id) {
      const [updated] = await db
        .update(counterparties)
        .set({
          canonicalName,
          normalizedName,
          counterpartyType: dto.counterpartyType || 'merchant',
          aliasesJson: JSON.stringify(aliases),
          defaultCategory: dto.defaultCategory ?? null,
          website: dto.website ?? null,
          logoUrl: dto.logoUrl ?? null,
          contactDetails: dto.contactDetails ?? null,
          notes: dto.notes ?? null,
          updatedAt: new Date(),
        })
        .where(and(eq(counterparties.id, dto.id), eq(counterparties.userId, userId)))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(counterparties)
      .values({
        userId,
        canonicalName,
        normalizedName,
        counterpartyType: dto.counterpartyType || 'merchant',
        aliasesJson: JSON.stringify(aliases),
        defaultCategory: dto.defaultCategory ?? null,
        website: dto.website ?? null,
        logoUrl: dto.logoUrl ?? null,
        contactDetails: dto.contactDetails ?? null,
        notes: dto.notes ?? null,
      })
      .returning();
    return created;
  }

  async mergeCounterparties(userId: string, sourceId: string, targetId: string) {
    if (sourceId === targetId) throw new Error('Cannot merge a counterparty into itself');
    return await db.transaction(async (txDb) => {
      const [source] = await txDb
        .select()
        .from(counterparties)
        .where(and(eq(counterparties.id, sourceId), eq(counterparties.userId, userId)));
      const [target] = await txDb
        .select()
        .from(counterparties)
        .where(and(eq(counterparties.id, targetId), eq(counterparties.userId, userId)));
      if (!source || !target) throw new Error('Counterparty not found');

      const sourceAliases = JSON.parse(source.aliasesJson || '[]');
      const targetAliases = JSON.parse(target.aliasesJson || '[]');
      const mergedAliases = Array.from(new Set([...targetAliases, source.canonicalName, ...sourceAliases]));

      await txDb
        .update(counterparties)
        .set({ aliasesJson: JSON.stringify(mergedAliases), updatedAt: new Date() })
        .where(eq(counterparties.id, target.id));

      // Re-link all child references without modifying historical amounts or dates
      await txDb.update(transactions).set({ counterpartyId: target.id }).where(and(eq(transactions.userId, userId), eq(transactions.counterpartyId, source.id)));
      await txDb.update(debts).set({ counterpartyId: target.id }).where(and(eq(debts.userId, userId), eq(debts.counterpartyId, source.id)));
      await txDb.update(subscriptions).set({ counterpartyId: target.id }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.counterpartyId, source.id)));
      await txDb.update(statementImportRows).set({ counterpartyId: target.id }).where(and(eq(statementImportRows.userId, userId), eq(statementImportRows.counterpartyId, source.id)));
      await txDb.update(financialReviewItems).set({ counterpartyId: target.id }).where(and(eq(financialReviewItems.userId, userId), eq(financialReviewItems.counterpartyId, source.id)));

      await txDb.delete(counterparties).where(eq(counterparties.id, source.id));
      return { mergedIntoId: target.id, aliases: mergedAliases };
    });
  }

  // ─── 7. Operational Diagnostics & Financial Integrity Report ───────────────

  async getFinancialIntegrityReport(userId: string) {
    const [userTx, entries, lines, userWallets, occurrences, stmtRows, userGoals, goalEvents, extWealth] =
      await Promise.all([
        db.select().from(transactions).where(eq(transactions.userId, userId)),
        db.select().from(journalEntries).where(eq(journalEntries.userId, userId)),
        db.select().from(journalLines).where(eq(journalLines.userId, userId)),
        db.select().from(wallets).where(eq(wallets.userId, userId)),
        db.select().from(commitmentOccurrences).where(eq(commitmentOccurrences.userId, userId)),
        db.select().from(statementImportRows).where(eq(statementImportRows.userId, userId)),
        db.select().from(goals).where(eq(goals.userId, userId)),
        db.select().from(goalContributionEvents).where(eq(goalContributionEvents.userId, userId)),
        this.getExternalWealthItems(userId),
      ]);

    const txIds = new Set(userTx.map((t) => t.id));
    const postedEntryByTxId = new Map<string, number>();
    const entryById = new Map(entries.map((e) => [e.id, e]));

    for (const e of entries) {
      if (e.transactionId && e.status === 'posted') {
        postedEntryByTxId.set(e.transactionId, (postedEntryByTxId.get(e.transactionId) || 0) + 1);
      }
    }

    const unjournaledTransactions = userTx
      .filter((t) => !postedEntryByTxId.has(t.id))
      .map((t) => ({ id: t.id, type: t.type, amount: t.amount, notes: t.notes }));

    const duplicateJournalPostings = Array.from(postedEntryByTxId.entries())
      .filter(([, count]) => count > 1)
      .map(([transactionId, count]) => ({ transactionId, count }));

    const linesByEntry = new Map<string, typeof lines>();
    const orphanedJournalLines: Array<{ id: string; journalEntryId: string }> = [];
    for (const l of lines) {
      if (!entryById.has(l.journalEntryId)) {
        orphanedJournalLines.push({ id: l.id, journalEntryId: l.journalEntryId });
      }
      const list = linesByEntry.get(l.journalEntryId) || [];
      list.push(l);
      linesByEntry.set(l.journalEntryId, list);
    }

    const unbalancedJournalEntries = entries
      .map((e) => {
        const eLines = linesByEntry.get(e.id) || [];
        const debits = eLines.reduce((s, l) => s + Number(l.debitMad || 0), 0);
        const credits = eLines.reduce((s, l) => s + Number(l.creditMad || 0), 0);
        return {
          id: e.id,
          debits: Number(debits.toFixed(2)),
          credits: Number(credits.toFixed(2)),
          lineCount: eLines.length,
        };
      })
      .filter((e) => e.lineCount === 0 || Math.abs(e.debits - e.credits) >= 0.01);

    const orphanedReversals = entries
      .filter((e) => e.entryType === 'reversal' && (!e.reversalOfEntryId || !entryById.has(e.reversalOfEntryId)))
      .map((e) => ({ id: e.id, reversalOfEntryId: e.reversalOfEntryId }));

    const completedOccurrencesWithoutTx = occurrences
      .filter((o) => o.status === 'completed' && !o.isNonCashEvent && (!o.linkedTransactionId || !txIds.has(o.linkedTransactionId)))
      .map((o) => ({ id: o.id, title: o.title, expectedDate: o.expectedDate }));

    const brokenStatementLinks = stmtRows
      .filter((r) => r.linkedTransactionId && !txIds.has(r.linkedTransactionId))
      .map((r) => ({ id: r.id, description: r.description, linkedTransactionId: r.linkedTransactionId }));

    const unreconciledGoals = userGoals
      .filter((g) => !g.autoSyncBalance)
      .map((g) => {
        const events = goalEvents.filter((e) => e.goalId === g.id);
        const eventNet = events.reduce(
          (s, e) => s + (e.eventType === 'withdrawal' ? -Number(e.amount || 0) : Number(e.amount || 0)),
          0
        );
        const currentAmt = Number(g.currentAmount || 0);
        return {
          id: g.id,
          name: g.name,
          currentAmount: currentAmt,
          eventNetAmount: Number(eventNet.toFixed(2)),
          hasEvents: events.length > 0,
          diff: Number((currentAmt - eventNet).toFixed(2)),
        };
      })
      .filter((g) => g.hasEvents && Math.abs(g.diff) >= 0.05);

    const staleExternalValuations = extWealth.items
      .filter((i: any) => i.isStaleEstimate)
      .map((i: any) => ({ id: i.id, name: i.name, valuationDate: i.valuationDate, ageDays: i.ageDays }));

    const totalExceptions =
      unjournaledTransactions.length +
      duplicateJournalPostings.length +
      unbalancedJournalEntries.length +
      orphanedJournalLines.length +
      orphanedReversals.length +
      completedOccurrencesWithoutTx.length +
      brokenStatementLinks.length +
      unreconciledGoals.length +
      staleExternalValuations.length;

    return {
      healthy: totalExceptions === 0,
      checkedAt: new Date().toISOString(),
      totalExceptions,
      walletCount: userWallets.length,
      transactionCount: userTx.length,
      journalEntryCount: entries.length,
      checks: {
        unjournaledTransactions,
        duplicateJournalPostings,
        unbalancedJournalEntries,
        orphanedJournalLines,
        orphanedReversals,
        completedOccurrencesWithoutTx,
        brokenStatementLinks,
        unreconciledGoals,
        staleExternalValuations,
      },
    };
  }
}

export const coreAuditService = new CoreAuditService();
