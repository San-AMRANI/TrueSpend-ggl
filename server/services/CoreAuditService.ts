import crypto from 'crypto';
import { and, desc, eq } from 'drizzle-orm';
import { createPool, db } from '../../src/db/index.js';
import {
  commitmentOccurrences,
  debts,
  exchangeRates,
  externalWealthItems,
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
  subscriptions,
  transactions,
  wallets,
} from '../../src/db/schema.js';

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
    for (const r of rows) {
      if (r.quoteCurrency === 'MAD' && !rateMap[r.baseCurrency]) {
        rateMap[r.baseCurrency] = Number(r.rate) || 1;
      } else if (r.quoteCurrency === 'MAD') {
        // Most recent rate wins since ordered desc
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
    explicitRate?: number
  ): Promise<{ rate: number; source: string }> {
    const cleanCurr = (currency || 'MAD').toUpperCase().trim();
    if (cleanCurr === 'MAD') {
      return { rate: 1, source: 'base_currency' };
    }
    if (explicitRate && Number.isFinite(explicitRate) && explicitRate > 0) {
      return { rate: Number(explicitRate), source: 'locked_at_posting' };
    }

    const rows = await db
      .select()
      .from(exchangeRates)
      .where(and(eq(exchangeRates.userId, userId), eq(exchangeRates.baseCurrency, cleanCurr)))
      .orderBy(desc(exchangeRates.effectiveDate));

    if (effectiveDate && rows.length > 0) {
      const exactOrPrior = rows.find((r) => r.effectiveDate <= effectiveDate) || rows[0];
      if (exactOrPrior) {
        return { rate: Number(exactOrPrior.rate) || 1, source: exactOrPrior.source };
      }
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
    }
  ): Promise<{ entryType: string; lines: JournalLineInput[] }> {
    const amountMad = Math.abs(Number(tx.amount) || 0);
    const nativeCurrency = (tx.currency || 'MAD').toUpperCase();
    const nativeAmount = Math.abs(Number(tx.nativeAmount ?? tx.amount) || 0);

    const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
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
    options: { isEstimatedBackfill?: boolean; idempotencyKey?: string; memo?: string } = {}
  ) {
    const { entryType, lines } = await this.buildBalancedLinesForTransaction(userId, tx);

    const totalDebit = lines.reduce((sum, l) => sum + Number(l.debitMad || 0), 0);
    const totalCredit = lines.reduce((sum, l) => sum + Number(l.creditMad || 0), 0);
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(
        `Double-entry accounting invariant violation: debits (${totalDebit.toFixed(2)}) != credits (${totalCredit.toFixed(2)})`
      );
    }

    const [entry] = await db
      .insert(journalEntries)
      .values({
        userId,
        transactionId: tx.id,
        entryType,
        status: 'posted',
        currency: (tx.currency || 'MAD').toUpperCase(),
        exchangeRateUsed: String(tx.exchangeRateUsed || '1'),
        isEstimatedBackfill: Boolean(options.isEstimatedBackfill),
        idempotencyKey: options.idempotencyKey || tx.idempotencyKey || `tx-post-${tx.id}`,
        memo: options.memo || tx.notes || `${tx.type}: ${tx.category || 'General'}`,
        postedAt: tx.createdAt ? new Date(tx.createdAt) : new Date(),
      })
      .returning();

    for (const line of lines) {
      await db.insert(journalLines).values({
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
      });
    }

    // Update credit card liabilityBalance if source or destination wallet is a CreditCard/Overdraft
    await this.syncCreditWalletLiabilityBalances(userId);

    return entry;
  }

  async reverseJournalEntriesForTransaction(userId: string, transactionId: string, reason = 'Transaction modified or reversed') {
    const existingEntries = await db
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
      const lines = await db
        .select()
        .from(journalLines)
        .where(eq(journalLines.journalEntryId, entry.id));

      await db
        .update(journalEntries)
        .set({ status: 'reversed' })
        .where(eq(journalEntries.id, entry.id));

      const [reversalEntry] = await db
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
          memo: `Reversal of ${entry.id.slice(0, 8)}: ${reason}`,
        })
        .returning();

      for (const l of lines) {
        await db.insert(journalLines).values({
          journalEntryId: reversalEntry.id,
          userId,
          walletId: l.walletId,
          accountCode: l.accountCode,
          accountName: l.accountName,
          accountClass: l.accountClass,
          debitMad: l.creditMad, // Swap debit and credit to reverse!
          creditMad: l.debitMad,
          nativeAmount: l.nativeAmount,
          nativeCurrency: l.nativeCurrency,
        });
      }
    }

    await this.syncCreditWalletLiabilityBalances(userId);
  }

  async syncCreditWalletLiabilityBalances(userId: string) {
    try {
      const userWallets = await db.select().from(wallets).where(eq(wallets.userId, userId));
      const creditWallets = userWallets.filter(
        (w) => w.accountSubtype === 'CreditCard' || w.accountSubtype === 'Overdraft'
      );
      if (creditWallets.length === 0) return;

      const userTx = await db.select().from(transactions).where(eq(transactions.userId, userId));
      for (const cw of creditWallets) {
        let liability = Math.max(0, -Number(cw.initialBalance || 0));
        for (const tx of userTx) {
          const amt = Number(tx.amount || 0);
          if (tx.walletId === cw.id && tx.type === 'Expense') {
            liability += amt; // Spending on credit increases liability
          } else if (tx.destinationWalletId === cw.id && tx.type === 'Transfer') {
            liability = Math.max(0, liability - amt); // Paying the card settles liability
          } else if (tx.walletId === cw.id && tx.type === 'Income') {
            liability = Math.max(0, liability - amt);
          }
        }
        await db
          .update(wallets)
          .set({ liabilityBalance: String(liability.toFixed(2)), updatedAt: new Date() })
          .where(eq(wallets.id, cw.id));
      }
    } catch (err) {
      console.warn('[CoreAuditService] syncCreditWalletLiabilityBalances warning:', err);
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

  // ─── F. Reusable Commitment Occurrences ─────────────────────────────────────

  async syncAndGetCommitmentOccurrences(userId: string) {
    const [userSubs, userDebts, userPayrolls, existingOccurrences] = await Promise.all([
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)),
      db.select().from(debts).where(eq(debts.userId, userId)),
      db.select().from(payrolls).where(eq(payrolls.userId, userId)),
      db.select().from(commitmentOccurrences).where(eq(commitmentOccurrences.userId, userId)),
    ]);

    const existingKeys = new Set(
      existingOccurrences.map((o) => `${o.sourceType}:${o.sourceId}:${o.expectedDate}`)
    );

    // 1. Sync active/planned subscriptions next occurrence
    for (const sub of userSubs) {
      if (sub.status !== 'active' && sub.status !== 'planned') continue;
      if (!sub.nextBillingDate) continue;
      const expectedDate = new Date(sub.nextBillingDate).toISOString().slice(0, 10);
      const key = `subscription:${sub.id}:${expectedDate}`;
      if (!existingKeys.has(key)) {
        await db.insert(commitmentOccurrences).values({
          userId,
          sourceType: 'subscription',
          sourceId: sub.id,
          title: `${sub.icon || '🔁'} ${sub.name}`,
          expectedDate,
          expectedAmount: String(sub.amount),
          currency: sub.currency || 'MAD',
          status: 'scheduled',
        });
        existingKeys.add(key);
      }
    }

    // 2. Sync pending debts with dueDates
    for (const debt of userDebts) {
      if (debt.status === 'Cleared' || !debt.dueDate) continue;
      const expectedDate = new Date(debt.dueDate).toISOString().slice(0, 10);
      const key = `debt_installment:${debt.id}:${expectedDate}`;
      if (!existingKeys.has(key)) {
        await db.insert(commitmentOccurrences).values({
          userId,
          sourceType: 'debt_installment',
          sourceId: debt.id,
          title: `${debt.type === 'Payable' ? '📤 Debt Due' : '🤝 Receivable'}: ${debt.contactName}`,
          expectedDate,
          expectedAmount: String(debt.installmentAmount || debt.remainingBalance),
          currency: debt.currency || 'MAD',
          status: 'scheduled',
        });
        existingKeys.add(key);
      }
    }

    // 3. Sync payrolls
    for (const pr of userPayrolls) {
      const expectedDate = new Date(pr.scheduledFor).toISOString().slice(0, 10);
      const key = `payroll:${pr.id}:${expectedDate}`;
      if (!existingKeys.has(key)) {
        await db.insert(commitmentOccurrences).values({
          userId,
          sourceType: 'payroll',
          sourceId: pr.id,
          title: '💰 Scheduled Salary / Payroll',
          expectedDate,
          expectedAmount: String(pr.amount),
          currency: 'MAD',
          status: pr.status === 'confirmed' || pr.status === 'matched' ? 'completed' : 'scheduled',
          actualDate: pr.confirmedAt ? new Date(pr.confirmedAt).toISOString().slice(0, 10) : null,
          actualAmount: pr.confirmedAmount ? String(pr.confirmedAmount) : null,
          varianceAmount: String(pr.varianceAmount || '0'),
        });
        existingKeys.add(key);
      }
    }

    return await db
      .select()
      .from(commitmentOccurrences)
      .where(eq(commitmentOccurrences.userId, userId))
      .orderBy(desc(commitmentOccurrences.expectedDate));
  }

  async settleCommitmentOccurrence(
    userId: string,
    occurrenceId: string,
    dto: { actualAmount: number; actualDate?: string; linkedTransactionId?: string; notes?: string }
  ) {
    const [occ] = await db
      .select()
      .from(commitmentOccurrences)
      .where(and(eq(commitmentOccurrences.id, occurrenceId), eq(commitmentOccurrences.userId, userId)));
    if (!occ) throw new Error('Commitment occurrence not found');

    const expected = Number(occ.expectedAmount || 0);
    const actual = Number(dto.actualAmount ?? expected);
    const variance = Number((actual - expected).toFixed(2));
    const actualDate = dto.actualDate || new Date().toISOString().slice(0, 10);

    const [updated] = await db
      .update(commitmentOccurrences)
      .set({
        status: 'completed',
        actualAmount: String(actual),
        actualDate,
        varianceAmount: String(variance),
        linkedTransactionId: dto.linkedTransactionId || occ.linkedTransactionId,
        notes: dto.notes || occ.notes,
        updatedAt: new Date(),
      })
      .where(eq(commitmentOccurrences.id, occurrenceId))
      .returning();

    return updated;
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

  // ─── K. Constrained User-Configurable Financial Rules Engine ────────────────

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
          conditionsJson: JSON.stringify(dto.conditions || {}),
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
        conditionsJson: JSON.stringify(dto.conditions || {}),
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

  async evaluateRulesForTrigger(
    userId: string,
    triggerType: string,
    eventContext: { amount?: number; category?: string; walletId?: string; description?: string; eventId?: string }
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

      if (cond.minAmount !== undefined && (eventContext.amount ?? 0) < Number(cond.minAmount)) {
        continue;
      }
      if (cond.maxAmount !== undefined && (eventContext.amount ?? 0) > Number(cond.maxAmount)) {
        continue;
      }
      if (
        cond.category &&
        eventContext.category &&
        !eventContext.category.toLowerCase().includes(String(cond.category).toLowerCase())
      ) {
        continue;
      }

      const idempotencyKey = `${rule.id}:v${rule.version}:${triggerType}:${eventContext.eventId || new Date().toISOString().slice(0, 13)}`;
      const existingLog = await db
        .select()
        .from(financialRuleLogs)
        .where(eq(financialRuleLogs.idempotencyKey, idempotencyKey));
      if (existingLog.length > 0) continue;

      let proposedSummary = `Rule "${rule.name}" triggered by ${triggerType}`;
      let outcomeStatus = 'notified';

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
        proposedSummary = `Created draft in Review Inbox: ${payload.description || rule.name}`;
        outcomeStatus = 'draft_created';
      } else if (rule.actionType === 'prepare_allocation') {
        proposedSummary = `Prepared allocation proposal (${payload.percent || 20}% -> ${payload.target || 'Savings/Investments'}) awaiting approval`;
        outcomeStatus = 'awaiting_approval';
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

  // ─── L. External Assets & Liabilities for Unified Net Worth ─────────────────

  async getExternalWealthItems(userId: string) {
    const items = await db
      .select()
      .from(externalWealthItems)
      .where(eq(externalWealthItems.userId, userId))
      .orderBy(desc(externalWealthItems.valuationDate));

    const now = Date.now();
    const enriched = items.map((item) => {
      const valDate = new Date(item.valuationDate).getTime();
      const ageDays = Number.isNaN(valDate)
        ? 0
        : Math.floor((now - valDate) / (1000 * 60 * 60 * 24));
      return {
        ...item,
        ageDays,
        isStaleEstimate: ageDays > 90,
      };
    });

    const totalExternalAssetsMad = enriched
      .filter((i) => !i.isLiability)
      .reduce((s, i) => s + Number(i.estimatedValue || 0) * (DEFAULT_FX_TO_MAD[i.currency] || 1), 0);
    const totalExternalLiabilitiesMad = enriched
      .filter((i) => i.isLiability)
      .reduce((s, i) => s + Number(i.estimatedValue || 0) * (DEFAULT_FX_TO_MAD[i.currency] || 1), 0);

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

    if (dto.id) {
      const [updated] = await db
        .update(externalWealthItems)
        .set({
          name: dto.name.trim(),
          itemClass: dto.itemClass,
          isLiability: Boolean(dto.isLiability),
          isLiquid: Boolean(dto.isLiquid),
          estimatedValue: String(val),
          currency: (dto.currency || 'MAD').toUpperCase(),
          valuationDate: dto.valuationDate || new Date().toISOString().slice(0, 10),
          valuationSource: dto.valuationSource || 'manual_estimate',
          confidenceLevel: dto.confidenceLevel || 'medium',
          isExternallyVerified: Boolean(dto.isExternallyVerified),
          notes: dto.notes || null,
          updatedAt: new Date(),
        })
        .where(and(eq(externalWealthItems.id, dto.id), eq(externalWealthItems.userId, userId)))
        .returning();
      return updated;
    }

    const [created] = await db
      .insert(externalWealthItems)
      .values({
        userId,
        name: dto.name.trim(),
        itemClass: dto.itemClass || 'Property',
        isLiability: Boolean(dto.isLiability),
        isLiquid: Boolean(dto.isLiquid),
        estimatedValue: String(val),
        currency: (dto.currency || 'MAD').toUpperCase(),
        valuationDate: dto.valuationDate || new Date().toISOString().slice(0, 10),
        valuationSource: dto.valuationSource || 'manual_estimate',
        confidenceLevel: dto.confidenceLevel || 'medium',
        isExternallyVerified: Boolean(dto.isExternallyVerified),
        notes: dto.notes || null,
      })
      .returning();
    return created;
  }

  async deleteExternalWealthItem(userId: string, itemId: string) {
    await db
      .delete(externalWealthItems)
      .where(and(eq(externalWealthItems.id, itemId), eq(externalWealthItems.userId, userId)));
    return { success: true };
  }
}

export const coreAuditService = new CoreAuditService();
