import { db } from '../../src/db/index.js';
import { debts, transactions, splits, wallets } from '../../src/db/schema.js';
import { eq, desc, and, inArray, lt, or, sql, gte } from 'drizzle-orm';

export type DbExecutor = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CreateTransactionParams {
  userId: string;
  amount: string;
  nativeAmount?: string;
  currency?: string;
  exchangeRateUsed?: string;
  fxSource?: 'base_currency' | 'locked_at_posting' | 'historical_table' | 'reference_feed';
  idempotencyKey?: string | null;
  type: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  walletId: string;
  destinationWalletId?: string | null;
  sourceWallet?: 'Bank' | 'Cash' | null;
  category?: string;
  notes?: string;
  createdAt?: Date;
  payrollId?: string;
  contextId?: string | null;
  counterpartyId?: string | null;
}

export interface CreateSplitParams {
  transactionId: string;
  reimbursableAmount: string;
  linkedContactId?: string | null;
}

export interface CursorPaginationParams {
  limit?: number;
  cursorCreatedAt?: string | Date;
  cursorId?: string;
  walletId?: string;
  type?: 'Income' | 'Expense' | 'Transfer' | 'Debt Repayment';
  category?: string;
  search?: string;
  startDate?: Date;
  endDate?: Date;
}

export class TransactionRepository {
  async findAllByUserId(userId: string, exec: DbExecutor = db) {
    return await exec
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.createdAt), desc(transactions.id));
  }

  /**
   * DB-06 / PERF-02: Keyset cursor pagination on (user_id, created_at DESC, id DESC)
   * backed by idx_transactions_user_created and idx_transactions_user_wallet_created.
   */
  async findPaginatedByUserId(
    userId: string,
    params: CursorPaginationParams = {},
    exec: DbExecutor = db
  ) {
    const limit = Math.min(500, Math.max(1, Number(params.limit || 100)));
    const conditions = [eq(transactions.userId, userId)];

    if (params.walletId && UUID_REGEX.test(params.walletId)) {
      conditions.push(
        or(
          eq(transactions.walletId, params.walletId),
          eq(transactions.destinationWalletId, params.walletId)
        )!
      );
    }
    if (params.type) {
      conditions.push(eq(transactions.type, params.type));
    }
    if (params.category) {
      conditions.push(eq(transactions.category, params.category));
    }
    if (params.search && params.search.trim()) {
      const pattern = `%${params.search.trim()}%`;
      conditions.push(
        sql`(COALESCE(${transactions.notes}, '') ILIKE ${pattern} OR COALESCE(${transactions.category}, '') ILIKE ${pattern})`
      );
    }
    if (params.startDate) {
      conditions.push(gte(transactions.createdAt, params.startDate));
    }
    if (params.endDate) {
      conditions.push(lt(transactions.createdAt, params.endDate));
    }
    if (params.cursorCreatedAt) {
      const cursorDate =
        params.cursorCreatedAt instanceof Date
          ? params.cursorCreatedAt
          : new Date(params.cursorCreatedAt);
      if (!Number.isNaN(cursorDate.getTime())) {
        if (params.cursorId && UUID_REGEX.test(params.cursorId)) {
          conditions.push(
            or(
              lt(transactions.createdAt, cursorDate),
              and(eq(transactions.createdAt, cursorDate), lt(transactions.id, params.cursorId))
            )!
          );
        } else {
          conditions.push(lt(transactions.createdAt, cursorDate));
        }
      }
    }

    const rows = await exec
      .select()
      .from(transactions)
      .where(and(...conditions))
      .orderBy(desc(transactions.createdAt), desc(transactions.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const lastItem = items[items.length - 1];

    return {
      items,
      hasMore,
      nextCursor:
        hasMore && lastItem
          ? {
              cursorCreatedAt:
                lastItem.createdAt instanceof Date
                  ? lastItem.createdAt.toISOString()
                  : String(lastItem.createdAt),
              cursorId: lastItem.id,
            }
          : null,
    };
  }

  /**
   * DB-06: Set-based SQL aggregation for period KPIs (gross income, gross expenses,
   * receivable reimbursements, and net true spend) scoped to the active payday cycle.
   */
  async aggregatePeriodSummaryByUserId(
    userId: string,
    periodStart: Date,
    periodEnd: Date,
    exec: DbExecutor = db
  ) {
    const res = await exec.execute(sql`
      WITH split_totals AS (
        SELECT
          s.transaction_id,
          COALESCE(SUM(
            CASE WHEN d.type = 'Receivable' OR d.type IS NULL THEN s.reimbursable_amount ELSE 0 END
          ), 0) AS receivable_reimbursable
        FROM splits s
        LEFT JOIN debts d ON d.id = s.linked_contact_id
        GROUP BY s.transaction_id
      )
      SELECT
        COALESCE(SUM(CASE WHEN t.type = 'Income' THEN t.amount ELSE 0 END), 0) AS period_income,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN t.amount ELSE 0 END), 0) AS gross_expenses,
        COALESCE(SUM(CASE WHEN t.type = 'Expense' THEN COALESCE(st.receivable_reimbursable, 0) ELSE 0 END), 0) AS reimbursements,
        COALESCE(SUM(
          CASE WHEN t.type = 'Expense'
            THEN GREATEST(0::numeric, t.amount - COALESCE(st.receivable_reimbursable, 0))
            ELSE 0
          END
        ), 0) AS net_true_spend,
        COUNT(*)::int AS period_tx_count
      FROM transactions t
      LEFT JOIN split_totals st ON st.transaction_id = t.id
      WHERE t.user_id = ${userId}::uuid
        AND t.created_at >= ${periodStart.toISOString()}::timestamp
        AND t.created_at < ${periodEnd.toISOString()}::timestamp
    `);

    const row = (res as any).rows?.[0] || {};
    return {
      periodIncome: Number(Number(row.period_income || 0).toFixed(2)),
      grossExpenses: Number(Number(row.gross_expenses || 0).toFixed(2)),
      reimbursements: Number(Number(row.reimbursements || 0).toFixed(2)),
      netTrueSpend: Number(Number(row.net_true_spend || 0).toFixed(2)),
      periodTxCount: Number(row.period_tx_count || 0),
    };
  }

  async create(data: CreateTransactionParams, exec: DbExecutor = db) {
    const sanitizedData = { ...data };
    if (sanitizedData.walletId && !UUID_REGEX.test(sanitizedData.walletId)) {
      try {
        const userWallets = await exec
          .select()
          .from(wallets)
          .where(eq(wallets.userId, sanitizedData.userId));
        if (userWallets.length > 0) {
          const match =
            sanitizedData.walletId === 'Cash'
              ? userWallets.find((w) => w.type === 'Cash') || userWallets[0]
              : userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
                userWallets.find((w) => w.type === 'Bank') ||
                userWallets[0];
          sanitizedData.walletId = match.id;
        } else {
          sanitizedData.walletId = null as any;
        }
      } catch {
        sanitizedData.walletId = null as any;
      }
    }
    if (
      sanitizedData.destinationWalletId &&
      !UUID_REGEX.test(sanitizedData.destinationWalletId)
    ) {
      sanitizedData.destinationWalletId = null;
    }
    const newTx = await exec.insert(transactions).values(sanitizedData).returning();
    return newTx[0];
  }

  async findByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    const result = await exec
      .select()
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
    return result[0] || null;
  }

  async findByPayrollId(payrollId: string, exec: DbExecutor = db) {
    const result = await exec
      .select()
      .from(transactions)
      .where(eq(transactions.payrollId, payrollId));
    return result[0] || null;
  }

  async findByPayrollIds(payrollIds: string[], exec: DbExecutor = db) {
    if (payrollIds.length === 0) return [];
    return await exec
      .select()
      .from(transactions)
      .where(inArray(transactions.payrollId, payrollIds));
  }

  async update(
    id: string,
    userId: string,
    data: Partial<CreateTransactionParams>,
    exec: DbExecutor = db
  ) {
    const sanitizedData = { ...data };
    if (sanitizedData.walletId && !UUID_REGEX.test(sanitizedData.walletId)) {
      try {
        const userWallets = await exec.select().from(wallets).where(eq(wallets.userId, userId));
        if (userWallets.length > 0) {
          const match =
            sanitizedData.walletId === 'Cash'
              ? userWallets.find((w) => w.type === 'Cash') || userWallets[0]
              : userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
                userWallets.find((w) => w.type === 'Bank') ||
                userWallets[0];
          sanitizedData.walletId = match.id;
        } else {
          delete sanitizedData.walletId;
        }
      } catch {
        delete sanitizedData.walletId;
      }
    }
    if (
      sanitizedData.destinationWalletId &&
      !UUID_REGEX.test(sanitizedData.destinationWalletId)
    ) {
      sanitizedData.destinationWalletId = null;
    }
    const result = await exec
      .update(transactions)
      .set(sanitizedData)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
      .returning();
    return result[0] || null;
  }

  async findSplitsByTransactionId(transactionId: string, exec: DbExecutor = db) {
    return await exec.select().from(splits).where(eq(splits.transactionId, transactionId));
  }

  async findSplitsByTransactionIds(transactionIds: string[], exec: DbExecutor = db) {
    if (transactionIds.length === 0) return [];
    return await exec.select().from(splits).where(inArray(splits.transactionId, transactionIds));
  }

  async createSplit(data: CreateSplitParams, exec: DbExecutor = db) {
    const newSplit = await exec.insert(splits).values(data).returning();
    return newSplit[0];
  }

  async createSplitsBatch(dataList: CreateSplitParams[], exec: DbExecutor = db) {
    if (dataList.length === 0) return [];
    return await exec.insert(splits).values(dataList).returning();
  }

  async deleteSplitsByTransactionId(transactionId: string, exec: DbExecutor = db) {
    await exec.delete(splits).where(eq(splits.transactionId, transactionId));
  }

  async updateSplit(id: string, data: Partial<CreateSplitParams>, exec: DbExecutor = db) {
    const result = await exec.update(splits).set(data).where(eq(splits.id, id)).returning();
    return result[0] || null;
  }

  async deleteSplitById(id: string, exec: DbExecutor = db) {
    await exec.delete(splits).where(eq(splits.id, id));
  }

  async findSplitsByDebtId(debtId: string, exec: DbExecutor = db) {
    return exec.select().from(splits).where(eq(splits.linkedContactId, debtId));
  }

  async findSplitsByDebtIds(debtIds: string[], exec: DbExecutor = db) {
    const cleanIds = Array.from(new Set(debtIds.filter(Boolean)));
    if (cleanIds.length === 0) return [];
    return await exec.select().from(splits).where(inArray(splits.linkedContactId, cleanIds));
  }

  async deleteByIdAndUserId(id: string, userId: string, exec: DbExecutor = db) {
    await exec
      .delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }

  async deleteAllByUserId(userId: string) {
    await db.delete(transactions).where(eq(transactions.userId, userId));
  }

  async deleteAllSplits() {
    await db.delete(splits);
  }
}

export const transactionRepository = new TransactionRepository();
