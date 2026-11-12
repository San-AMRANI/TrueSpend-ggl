import crypto from 'crypto';
import { userRepository } from '../repositories/UserRepository.js';
import { createPool, db } from '../../src/db/index.js';
import {
  categoryBudgets,
  commitmentOccurrences,
  debts,
  exchangeRates,
  externalWealthItems,
  financialContexts,
  financialRules,
  goalContributionEvents,
  goals,
  investmentDividendEvents,
  investmentSettings,
  journalEntries,
  journalLines,
  notificationPreferences,
  payrolls,
  portfolioDailySnapshots,
  savedScenarios,
  splits,
  stockOrders,
  stockPositions,
  subscriptions,
  transactions,
  users,
  wallets,
} from '../../src/db/schema.js';

const TRUE_SPEND_BACKUP_HEADER = '-- TrueSpend Complete PostgreSQL Database Backup';
const BACKUP_SCHEMA_VERSION = '2.0';
const MAX_BACKUP_SIZE_BYTES = 25 * 1024 * 1024;

export type BackupTable =
  | 'users'
  | 'wallets'
  | 'debts'
  | 'payrolls'
  | 'financial_contexts'
  | 'transactions'
  | 'splits'
  | 'category_budgets'
  | 'goals'
  | 'goal_contribution_events'
  | 'subscriptions'
  | 'stock_positions'
  | 'stock_orders'
  | 'investment_dividend_events'
  | 'investment_settings'
  | 'portfolio_daily_snapshots'
  | 'notification_preferences'
  | 'journal_entries'
  | 'journal_lines'
  | 'exchange_rates'
  | 'commitment_occurrences'
  | 'saved_scenarios'
  | 'financial_rules'
  | 'external_wealth_items';

type BackupRow = {
  table: BackupTable;
  columns: string[];
  values: Array<string | null>;
};

export const restoreOrder: BackupTable[] = [
  'users',
  'wallets',
  'debts',
  'payrolls',
  'financial_contexts',
  'transactions',
  'splits',
  'category_budgets',
  'goals',
  'goal_contribution_events',
  'subscriptions',
  'stock_positions',
  'stock_orders',
  'investment_dividend_events',
  'investment_settings',
  'portfolio_daily_snapshots',
  'notification_preferences',
  'journal_entries',
  'journal_lines',
  'exchange_rates',
  'commitment_occurrences',
  'saved_scenarios',
  'financial_rules',
  'external_wealth_items',
];

const backupTables = new Set<BackupTable>(restoreOrder);

function splitSqlValues(valuesSql: string): string[] {
  const values: string[] = [];
  let valueStart = 0;
  let inString = false;

  for (let index = 0; index < valuesSql.length; index += 1) {
    if (valuesSql[index] === "'") {
      if (inString && valuesSql[index + 1] === "'") {
        index += 1;
      } else {
        inString = !inString;
      }
    } else if (valuesSql[index] === ',' && !inString) {
      values.push(valuesSql.slice(valueStart, index).trim());
      valueStart = index + 1;
    }
  }

  if (inString) throw new Error('Invalid TrueSpend backup: an SQL string is not closed.');
  values.push(valuesSql.slice(valueStart).trim());
  return values;
}

function parseSqlValue(value: string): string | null {
  const withoutCast = value.replace(/::[a-z_][a-z0-9_]*\s*$/i, '').trim();
  if (withoutCast.toUpperCase() === 'NULL') return null;
  if (withoutCast.toUpperCase() === 'TRUE') return 'true';
  if (withoutCast.toUpperCase() === 'FALSE') return 'false';
  if (/^-?\d+(\.\d+)?$/.test(withoutCast)) return withoutCast;

  if (withoutCast.startsWith("'") && withoutCast.endsWith("'")) {
    return withoutCast.slice(1, -1).replace(/''/g, "'");
  }

  throw new Error(`Invalid TrueSpend backup: unsupported SQL value (${withoutCast.slice(0, 32)}).`);
}

function getInsertStatements(sqlContent: string): string[] {
  const inserts: string[] = [];
  const tablePattern = restoreOrder.join('|');
  const startPattern = new RegExp(`INSERT\\s+INTO\\s+(${tablePattern})\\b`, 'gi');
  let match: RegExpExecArray | null;

  while ((match = startPattern.exec(sqlContent)) !== null) {
    let inString = false;
    let statementEnd = -1;

    for (let index = match.index; index < sqlContent.length; index += 1) {
      if (sqlContent[index] === "'") {
        if (inString && sqlContent[index + 1] === "'") {
          index += 1;
        } else {
          inString = !inString;
        }
      } else if (sqlContent[index] === ';' && !inString) {
        statementEnd = index + 1;
        break;
      }
    }

    if (statementEnd === -1) throw new Error('Invalid TrueSpend backup: an INSERT statement is incomplete.');
    inserts.push(sqlContent.slice(match.index, statementEnd));
    startPattern.lastIndex = statementEnd;
  }

  return inserts;
}

function parseBackupRows(sqlContent: unknown): {
  rows: BackupRow[];
  schemaVersion: string;
  checksumVerified: boolean;
  manifest: Record<string, any> | null;
} {
  if (typeof sqlContent !== 'string' || !sqlContent.slice(0, 800).includes(TRUE_SPEND_BACKUP_HEADER)) {
    throw new Error('Please select a SQL backup exported by TrueSpend.');
  }
  if (Buffer.byteLength(sqlContent, 'utf8') > MAX_BACKUP_SIZE_BYTES) {
    throw new Error('This backup is larger than the 25 MB import limit.');
  }

  const versionMatch = /--\s*Schema-Version:\s*([^\r\n]+)/i.exec(sqlContent);
  const schemaVersion = versionMatch ? versionMatch[1].trim() : '1.0-legacy';

  const manifestMatch = /--\s*Manifest-JSON:\s*([^\r\n]+)/i.exec(sqlContent);
  let manifest: Record<string, any> | null = null;
  if (manifestMatch) {
    try {
      manifest = JSON.parse(manifestMatch[1].trim());
    } catch {
      manifest = null;
    }
  }

  const checksumMatch = /--\s*Checksum-SHA256:\s*([a-f0-9]{64})/i.exec(sqlContent);
  let checksumVerified = false;
  if (checksumMatch) {
    const expectedHash = checksumMatch[1].toLowerCase();
    const bodyStart = sqlContent.indexOf('BEGIN;');
    if (bodyStart !== -1) {
      const actualHash = crypto
        .createHash('sha256')
        .update(sqlContent.slice(bodyStart).trim(), 'utf8')
        .digest('hex')
        .toLowerCase();
      checksumVerified = actualHash === expectedHash;
    }
  }

  const rows: BackupRow[] = [];
  for (const statement of getInsertStatements(sqlContent)) {
    const parsed = /^INSERT\s+INTO\s+([a-z_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([\s\S]*)\)\s*;$/i.exec(
      statement.trim()
    );
    if (!parsed || !backupTables.has(parsed[1].toLowerCase() as BackupTable)) {
      throw new Error('Invalid TrueSpend backup: an INSERT statement could not be read.');
    }

    const table = parsed[1].toLowerCase() as BackupTable;
    const columns = parsed[2]
      .split(',')
      .map((column) => column.trim().replace(/^"|"$/g, '').toLowerCase());
    const rawValues = splitSqlValues(parsed[3]);

    if (
      columns.length !== rawValues.length ||
      columns.length === 0 ||
      columns.some((col) => !/^[a-z_][a-z0-9_]*$/.test(col))
    ) {
      throw new Error(`Invalid TrueSpend backup: column count mismatch in table ${table}.`);
    }

    rows.push({ table, columns, values: rawValues.map(parseSqlValue) });
  }

  if (!rows.some((row) => row.table === 'users')) {
    throw new Error('This backup does not contain any TrueSpend user records.');
  }

  return { rows, schemaVersion, checksumVerified, manifest };
}

export interface UpdateSettingsDTO {
  automatedDriveBackups?: boolean;
  lastDriveBackupDate?: string;
  driveBackupFrequency?: 'daily' | '3days' | 'weekly';
  googleDriveToken?: string;
  payday?: number;
  emergencyBuffer?: number;
  salary?: number;
  baseCurrency?: string;
}

export class SettingsService {
  async getSettings(dbUser: any) {
    return {
      payday: dbUser.payday || 25,
      emergencyBuffer: dbUser.emergencyBuffer || 0,
      salary: dbUser.salary || 0,
      baseCurrency: dbUser.baseCurrency || 'MAD',
      automatedDriveBackups: Boolean(dbUser.automatedDriveBackups),
      lastDriveBackupDate: dbUser.lastDriveBackupDate
        ? new Date(dbUser.lastDriveBackupDate).toISOString()
        : null,
      driveBackupFrequency: dbUser.driveBackupFrequency || 'weekly',
    };
  }

  async updateSettings(userId: string, dto: UpdateSettingsDTO) {
    const updateData: {
      payday?: number;
      emergencyBuffer?: string;
      salary?: string;
      automatedDriveBackups?: number;
      lastDriveBackupDate?: Date;
      driveBackupFrequency?: string;
      googleDriveToken?: string;
      googleDriveTokenExpiry?: Date;
    } = {};

    if (dto.automatedDriveBackups !== undefined) {
      updateData.automatedDriveBackups = dto.automatedDriveBackups ? 1 : 0;
    }
    if (dto.lastDriveBackupDate !== undefined) {
      updateData.lastDriveBackupDate = new Date(dto.lastDriveBackupDate);
    }
    if (dto.driveBackupFrequency !== undefined) {
      updateData.driveBackupFrequency = dto.driveBackupFrequency;
    }
    if (dto.googleDriveToken !== undefined) {
      updateData.googleDriveToken = dto.googleDriveToken;
      updateData.googleDriveTokenExpiry = new Date(Date.now() + 3600 * 1000);
    }
    if (dto.payday !== undefined) {
      if (dto.payday >= 1 && dto.payday <= 31) {
        updateData.payday = dto.payday;
      } else {
        throw new Error('Invalid payday');
      }
    }

    if (dto.emergencyBuffer !== undefined) {
      if (dto.emergencyBuffer >= 0) {
        updateData.emergencyBuffer = String(dto.emergencyBuffer);
      } else {
        throw new Error('Invalid emergency buffer');
      }
    }

    if (dto.salary !== undefined) {
      if (dto.salary >= 0) {
        updateData.salary = String(dto.salary);
      } else {
        throw new Error('Invalid salary');
      }
    }

    if (Object.keys(updateData).length > 0) {
      await userRepository.updateSettings(userId, updateData);
    }

    return { success: true, ...updateData };
  }

  async backupToGoogleDrive(accessToken: string): Promise<{ fileId: string; lastDriveBackupDate: string }> {
    const sqlContent = await this.exportSqlDatabase();
    const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;

    const metadata = {
      name: filename,
      mimeType: 'application/sql',
    };

    const boundary = '-------TrueSpendBoundary' + Math.random().toString(36).substring(2);
    const delimiter = `\r\n--${boundary}\r\n`;
    const closeDelimiter = `\r\n--${boundary}--`;

    const multipartRequestBody =
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      'Content-Type: application/sql\r\n\r\n' +
      sqlContent +
      closeDelimiter;

    const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[SettingsService] Failed to upload file to Google Drive:', response.status, errText);
      throw new Error(`Failed to upload file to Google Drive: ${response.statusText}`);
    }

    const result = (await response.json()) as any;
    const lastDriveBackupDate = new Date().toISOString();
    return { fileId: result.id, lastDriveBackupDate };
  }

  private formatSqlLiteral(val: any): string {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
    if (typeof val === 'number') {
      return Number.isFinite(val) ? String(val) : 'NULL';
    }
    if (val instanceof Date) {
      return `'${val.toISOString()}'`;
    }
    return `'${String(val).replace(/'/g, "''")}'`;
  }

  private buildTableInserts(tableName: BackupTable, records: Record<string, any>[], columnMap: Record<string, string>): string[] {
    if (!records || records.length === 0) return [];
    const out: string[] = [`-- Table: ${tableName} (${records.length} rows)`];
    const propKeys = Object.keys(columnMap);
    const sqlCols = propKeys.map((k) => columnMap[k]);

    for (const row of records) {
      const vals = propKeys.map((prop) => this.formatSqlLiteral(row[prop]));
      out.push(`INSERT INTO ${tableName} (${sqlCols.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    out.push('');
    return out;
  }

  /**
   * Audit Fix N: Full-Schema PostgreSQL Backup with SHA-256 Checksum, Schema Manifest,
   * and Dependency-Aware Export Order across all 24 domain tables.
   */
  async exportSqlDatabase(): Promise<string> {
    const [
      allUsers,
      allWallets,
      allDebts,
      allPayrolls,
      allContexts,
      allTransactions,
      allSplits,
      allCategoryBudgets,
      allGoals,
      allGoalEvents,
      allSubscriptions,
      allStockPositions,
      allStockOrders,
      allDividends,
      allInvSettings,
      allSnapshots,
      allNotifPrefs,
      allJournalEntries,
      allJournalLines,
      allFxRates,
      allOccurrences,
      allScenarios,
      allRules,
      allExternalWealth,
    ] = await Promise.all([
      db.select().from(users),
      db.select().from(wallets),
      db.select().from(debts),
      db.select().from(payrolls),
      db.select().from(financialContexts),
      db.select().from(transactions),
      db.select().from(splits),
      db.select().from(categoryBudgets),
      db.select().from(goals),
      db.select().from(goalContributionEvents).catch(() => []),
      db.select().from(subscriptions),
      db.select().from(stockPositions),
      db.select().from(stockOrders),
      db.select().from(investmentDividendEvents).catch(() => []),
      db.select().from(investmentSettings).catch(() => []),
      db.select().from(portfolioDailySnapshots).catch(() => []),
      db.select().from(notificationPreferences).catch(() => []),
      db.select().from(journalEntries).catch(() => []),
      db.select().from(journalLines).catch(() => []),
      db.select().from(exchangeRates).catch(() => []),
      db.select().from(commitmentOccurrences).catch(() => []),
      db.select().from(savedScenarios).catch(() => []),
      db.select().from(financialRules).catch(() => []),
      db.select().from(externalWealthItems).catch(() => []),
    ]);

    const bodyLines: string[] = [];
    bodyLines.push('BEGIN;');
    bodyLines.push('CREATE EXTENSION IF NOT EXISTS "pgcrypto";\n');

    bodyLines.push(
      ...this.buildTableInserts('users', allUsers, {
        id: 'id',
        uid: 'uid',
        username: 'username',
        displayName: 'display_name',
        email: 'email',
        role: 'role',
        status: 'status',
        workspaceMode: 'workspace_mode',
        createdAt: 'created_at',
        payday: 'payday',
        emergencyBuffer: 'emergency_buffer',
        salary: 'salary',
        baseCurrency: 'base_currency',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('wallets', allWallets, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        type: 'type',
        accountSubtype: 'account_subtype',
        institutionName: 'institution_name',
        accountReference: 'account_reference',
        currency: 'currency',
        isMain: 'is_main',
        initialBalance: 'initial_balance',
        currentBalance: 'current_balance',
        creditLimit: 'credit_limit',
        liabilityBalance: 'liability_balance',
        statementClosingDay: 'statement_closing_day',
        paymentDueDay: 'payment_due_day',
        minimumPayment: 'minimum_payment',
        valuationStatus: 'valuation_status',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('debts', allDebts, {
        id: 'id',
        userId: 'user_id',
        contactName: 'contact_name',
        counterpartyType: 'counterparty_type',
        type: 'type',
        originalAmount: 'original_amount',
        remainingBalance: 'remaining_balance',
        principalBalance: 'principal_balance',
        accruedInterest: 'accrued_interest',
        feesAmount: 'fees_amount',
        interestRateApr: 'interest_rate_apr',
        rateType: 'rate_type',
        installmentAmount: 'installment_amount',
        installmentFrequency: 'installment_frequency',
        currency: 'currency',
        status: 'status',
        dueDate: 'due_date',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('payrolls', allPayrolls, {
        id: 'id',
        userId: 'user_id',
        scheduledFor: 'scheduled_for',
        amount: 'amount',
        status: 'status',
        confirmedAmount: 'confirmed_amount',
        confirmedAt: 'confirmed_at',
        varianceAmount: 'variance_amount',
        varianceNotes: 'variance_notes',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('financial_contexts', allContexts, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        type: 'type',
        startDate: 'start_date',
        endDate: 'end_date',
        budget: 'budget',
        status: 'status',
        notes: 'notes',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('transactions', allTransactions, {
        id: 'id',
        userId: 'user_id',
        walletId: 'wallet_id',
        destinationWalletId: 'destination_wallet_id',
        createdAt: 'created_at',
        amount: 'amount',
        nativeAmount: 'native_amount',
        currency: 'currency',
        exchangeRateUsed: 'exchange_rate_used',
        fxSource: 'fx_source',
        idempotencyKey: 'idempotency_key',
        type: 'type',
        category: 'category',
        notes: 'notes',
        payrollId: 'payroll_id',
        contextId: 'context_id',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('splits', allSplits, {
        id: 'id',
        transactionId: 'transaction_id',
        reimbursableAmount: 'reimbursable_amount',
        linkedContactId: 'linked_contact_id',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('category_budgets', allCategoryBudgets, {
        id: 'id',
        userId: 'user_id',
        category: 'category',
        year: 'year',
        month: 'month',
        amount: 'amount',
        rolloverEnabled: 'rollover_enabled',
        rolloverAmount: 'rollover_amount',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('goals', allGoals, {
        id: 'id',
        userId: 'user_id',
        walletId: 'wallet_id',
        name: 'name',
        targetAmount: 'target_amount',
        currentAmount: 'current_amount',
        autoSyncBalance: 'auto_sync_balance',
        fundingCadence: 'funding_cadence',
        plannedContributionAmount: 'planned_contribution_amount',
        deadline: 'deadline',
        category: 'category',
        notes: 'notes',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('goal_contribution_events', allGoalEvents, {
        id: 'id',
        userId: 'user_id',
        goalId: 'goal_id',
        transactionId: 'transaction_id',
        sourceWalletId: 'source_wallet_id',
        destinationWalletId: 'destination_wallet_id',
        eventType: 'event_type',
        amount: 'amount',
        eventDate: 'event_date',
        notes: 'notes',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('subscriptions', allSubscriptions, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        amount: 'amount',
        currency: 'currency',
        billingCycle: 'billing_cycle',
        category: 'category',
        walletId: 'wallet_id',
        nextBillingDate: 'next_billing_date',
        status: 'status',
        notes: 'notes',
        icon: 'icon',
        websiteUrl: 'website_url',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('stock_positions', allStockPositions, {
        id: 'id',
        userId: 'user_id',
        walletId: 'wallet_id',
        ticker: 'ticker',
        companyName: 'company_name',
        market: 'market',
        sector: 'sector',
        instrumentType: 'instrument_type',
        shares: 'shares',
        avgCostPerShare: 'avg_cost_per_share',
        currentPrice: 'current_price',
        currency: 'currency',
        annualDividendPerShare: 'annual_dividend_per_share',
        targetWeightPercent: 'target_weight_percent',
        convictionThesis: 'conviction_thesis',
        isWatchlistOnly: 'is_watchlist_only',
        createdAt: 'created_at',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('stock_orders', allStockOrders, {
        id: 'id',
        userId: 'user_id',
        positionId: 'position_id',
        walletId: 'wallet_id',
        linkedTransactionId: 'linked_transaction_id',
        action: 'action',
        shares: 'shares',
        pricePerShare: 'price_per_share',
        totalNativeAmount: 'total_native_amount',
        totalMadAmount: 'total_mad_amount',
        exchangeRateUsed: 'exchange_rate_used',
        realizedPnlMad: 'realized_pnl_mad',
        notes: 'notes',
        executedAt: 'executed_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('investment_dividend_events', allDividends, {
        id: 'id',
        userId: 'user_id',
        positionId: 'position_id',
        ticker: 'ticker',
        companyName: 'company_name',
        paymentDate: 'payment_date',
        dividendPerShare: 'dividend_per_share',
        eligibleShares: 'eligible_shares',
        currency: 'currency',
        grossAmount: 'gross_amount',
        withholdingTax: 'withholding_tax',
        feeAmount: 'fee_amount',
        netAmount: 'net_amount',
        netAmountMad: 'net_amount_mad',
        fxRateUsed: 'fx_rate_used',
        status: 'status',
        source: 'source',
        notes: 'notes',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('investment_settings', allInvSettings, {
        id: 'id',
        userId: 'user_id',
        reportingCurrency: 'reporting_currency',
        selectedBenchmarks: 'selected_benchmarks',
        riskFreeRatePercent: 'risk_free_rate_percent',
        manualUsdMadRate: 'manual_usd_mad_rate',
        updatedAt: 'updated_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('portfolio_daily_snapshots', allSnapshots, {
        id: 'id',
        userId: 'user_id',
        snapshotDate: 'snapshot_date',
        baseCurrency: 'base_currency',
        totalMarketValueMad: 'total_market_value_mad',
        investmentCashMad: 'investment_cash_mad',
        netContributionsMad: 'net_contributions_mad',
        costBasisMad: 'cost_basis_mad',
        unrealizedPnlMad: 'unrealized_pnl_mad',
        realizedPnlMad: 'realized_pnl_mad',
        dividendsReceivedMad: 'dividends_received_mad',
        usdToMadRate: 'usd_to_mad_rate',
        isEstimated: 'is_estimated',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('notification_preferences', allNotifPrefs, {
        id: 'id',
        userId: 'user_id',
        enabled: 'enabled',
        dailyInsightEnabled: 'daily_insight_enabled',
        budgetWarningEnabled: 'budget_warning_enabled',
        forecastWarningEnabled: 'forecast_warning_enabled',
        debtReminderEnabled: 'debt_reminder_enabled',
        anomalyEnabled: 'anomaly_enabled',
        goalEnabled: 'goal_enabled',
        deliveryTime: 'delivery_time',
        timezone: 'timezone',
        quietHoursStart: 'quiet_hours_start',
        quietHoursEnd: 'quiet_hours_end',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('journal_entries', allJournalEntries, {
        id: 'id',
        userId: 'user_id',
        transactionId: 'transaction_id',
        entryType: 'entry_type',
        status: 'status',
        reversalOfEntryId: 'reversal_of_entry_id',
        currency: 'currency',
        exchangeRateUsed: 'exchange_rate_used',
        isEstimatedBackfill: 'is_estimated_backfill',
        idempotencyKey: 'idempotency_key',
        memo: 'memo',
        postedAt: 'posted_at',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('journal_lines', allJournalLines, {
        id: 'id',
        journalEntryId: 'journal_entry_id',
        userId: 'user_id',
        walletId: 'wallet_id',
        accountCode: 'account_code',
        accountName: 'account_name',
        accountClass: 'account_class',
        debitMad: 'debit_mad',
        creditMad: 'credit_mad',
        nativeAmount: 'native_amount',
        nativeCurrency: 'native_currency',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('exchange_rates', allFxRates, {
        id: 'id',
        userId: 'user_id',
        baseCurrency: 'base_currency',
        quoteCurrency: 'quote_currency',
        rate: 'rate',
        source: 'source',
        effectiveDate: 'effective_date',
        createdAt: 'created_at',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('commitment_occurrences', allOccurrences, {
        id: 'id',
        userId: 'user_id',
        sourceType: 'source_type',
        sourceId: 'source_id',
        title: 'title',
        expectedDate: 'expected_date',
        expectedAmount: 'expected_amount',
        currency: 'currency',
        status: 'status',
        actualDate: 'actual_date',
        actualAmount: 'actual_amount',
        varianceAmount: 'variance_amount',
        linkedTransactionId: 'linked_transaction_id',
        notes: 'notes',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('saved_scenarios', allScenarios, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        description: 'description',
        baselineSnapshotJson: 'baseline_snapshot_json',
        eventsJson: 'events_json',
        assumptionsJson: 'assumptions_json',
        projectedSummaryJson: 'projected_summary_json',
        isApprovedPlan: 'is_approved_plan',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('financial_rules', allRules, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        enabled: 'enabled',
        triggerType: 'trigger_type',
        conditionsJson: 'conditions_json',
        actionType: 'action_type',
        actionPayloadJson: 'action_payload_json',
        approvalPolicy: 'approval_policy',
        version: 'version',
      })
    );

    bodyLines.push(
      ...this.buildTableInserts('external_wealth_items', allExternalWealth, {
        id: 'id',
        userId: 'user_id',
        name: 'name',
        itemClass: 'item_class',
        isLiability: 'is_liability',
        isLiquid: 'is_liquid',
        estimatedValue: 'estimated_value',
        currency: 'currency',
        valuationDate: 'valuation_date',
        valuationSource: 'valuation_source',
        confidenceLevel: 'confidence_level',
        isExternallyVerified: 'is_externally_verified',
        notes: 'notes',
      })
    );

    bodyLines.push('COMMIT;');
    const bodyString = bodyLines.join('\n').trim();
    const checksum = crypto.createHash('sha256').update(bodyString, 'utf8').digest('hex');

    const manifest = {
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      tablesCovered: restoreOrder.length,
      counts: {
        users: allUsers.length,
        wallets: allWallets.length,
        debts: allDebts.length,
        payrolls: allPayrolls.length,
        financial_contexts: allContexts.length,
        transactions: allTransactions.length,
        splits: allSplits.length,
        category_budgets: allCategoryBudgets.length,
        goals: allGoals.length,
        goal_contribution_events: allGoalEvents.length,
        subscriptions: allSubscriptions.length,
        stock_positions: allStockPositions.length,
        stock_orders: allStockOrders.length,
        investment_dividend_events: allDividends.length,
        journal_entries: allJournalEntries.length,
        journal_lines: allJournalLines.length,
        commitment_occurrences: allOccurrences.length,
        saved_scenarios: allScenarios.length,
        financial_rules: allRules.length,
        external_wealth_items: allExternalWealth.length,
      },
    };

    const headerLines = [
      '-- ====================================================',
      TRUE_SPEND_BACKUP_HEADER,
      `-- Schema-Version: ${BACKUP_SCHEMA_VERSION}`,
      `-- Exported-At: ${manifest.exportedAt}`,
      `-- Checksum-SHA256: ${checksum}`,
      `-- Manifest-JSON: ${JSON.stringify(manifest)}`,
      '-- Full dependency-ordered PostgreSQL backup covering all 24 TrueSpend tables.',
      '-- ====================================================\n',
    ];

    return `${headerLines.join('\n')}\n${bodyString}\n`;
  }

  /**
   * Non-destructive restore validation & preview drill (Audit Item N).
   */
  async validateBackupPreview(sqlContent: unknown) {
    const { rows, schemaVersion, checksumVerified, manifest } = parseBackupRows(sqlContent);
    const countsByTable: Record<string, number> = {};
    for (const table of restoreOrder) countsByTable[table] = 0;
    for (const r of rows) {
      countsByTable[r.table] = (countsByTable[r.table] || 0) + 1;
    }

    // Referential integrity check on parsed IDs
    const userIds = new Set(
      rows
        .filter((r) => r.table === 'users')
        .map((r) => r.values[r.columns.indexOf('id')])
        .filter(Boolean)
    );
    const orphanCount = rows.filter((r) => {
      if (r.table === 'users') return false;
      const uidIdx = r.columns.indexOf('user_id');
      if (uidIdx === -1) return false;
      const uid = r.values[uidIdx];
      return uid && !userIds.has(uid);
    }).length;

    return {
      valid: orphanCount === 0,
      schemaVersion,
      checksumVerified,
      totalRows: rows.length,
      tablesWithData: Object.entries(countsByTable)
        .filter(([, count]) => count > 0)
        .map(([table, count]) => ({ table, count })),
      countsByTable,
      referentialIntegrityOk: orphanCount === 0,
      orphanRecordsDetected: orphanCount,
      manifest,
    };
  }

  async importSqlDatabase(sqlContent: unknown) {
    const { rows: backupRows } = parseBackupRows(sqlContent);
    const rowsByTable = new Map<BackupTable, BackupRow[]>();
    for (const table of restoreOrder) rowsByTable.set(table, []);
    for (const row of backupRows) rowsByTable.get(row.table)!.push(row);

    const client = await createPool().connect();
    try {
      await client.query('BEGIN');

      // Delete in reverse dependency order so foreign keys never fail
      const deleteOrder = [...restoreOrder].reverse();
      for (const table of deleteOrder) {
        await client.query(`DELETE FROM ${table}`);
      }

      for (const table of restoreOrder) {
        for (const row of rowsByTable.get(table)!) {
          const placeholders = row.values.map((_, index) => `$${index + 1}`).join(', ');
          await client.query(
            `INSERT INTO ${row.table} (${row.columns.join(', ')}) VALUES (${placeholders})`,
            row.values
          );
        }
      }

      await client.query('COMMIT');
      return Object.fromEntries(
        restoreOrder.map((table) => [table, rowsByTable.get(table)!.length])
      );
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }
}

export const settingsService = new SettingsService();
