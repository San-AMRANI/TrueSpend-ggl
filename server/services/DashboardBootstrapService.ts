import { desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import {
  categoryBudgets,
  debts,
  financialContexts,
  goalContributionEvents,
  goals,
  payrolls,
  subscriptions,
  transactions,
  wallets,
} from '../../src/db/schema.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { payrollService, enrichPayrollsWithLinkedTxs } from './PayrollService.js';
import { buildEnrichedTransactions } from './TransactionService.js';
import { buildDebtsWithSettlements } from './DebtService.js';
import { buildGoalsWithEvents } from './GoalService.js';
import { buildSubscriptionsWithWallets } from './SubscriptionService.js';
import { computeKpisFromInputs } from './KpiService.js';
import { settingsService } from './SettingsService.js';
import { syncContextStatuses } from '../controllers/ContextController.js';

export interface DashboardBootstrapPayload {
  kpis: any;
  transactions: any[];
  debts: any[];
  settings: any;
  categoryBudgets: any[];
  payrolls: any[];
  goals: any[];
  subscriptions: any[];
  contexts: any[];
}

export class DashboardBootstrapService {
  async getBootstrapData(dbUser: any): Promise<DashboardBootstrapPayload> {
    const userId = dbUser.id;
    const isAdvanced = dbUser.experienceTier === 'advanced';

    // 1. Concurrently fetch all base relational records for the authenticated user in 1 parallel round-trip
    const [
      userWallets,
      rawTransactions,
      allDebts,
      initialPayrolls,
      allBudgets,
      rawGoals,
      rawSubs,
      goalEvents,
      rawForfeitLogs,
      rawContexts,
    ] = await Promise.all([
      db.select().from(wallets).where(eq(wallets.userId, userId)),
      transactionRepository.findAllByUserId(userId),
      db.select().from(debts).where(eq(debts.userId, userId)).orderBy(desc(debts.createdAt)),
      payrollRepository.findAllByUserId(userId),
      db.select().from(categoryBudgets).where(eq(categoryBudgets.userId, userId)),
      db.select().from(goals).where(eq(goals.userId, userId)).orderBy(desc(goals.createdAt)),
      db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)),
      db.select().from(goalContributionEvents).where(eq(goalContributionEvents.userId, userId)),
      debtRepository.findForgivenessLogsByUserId(userId),
      isAdvanced
        ? db.select().from(financialContexts).where(eq(financialContexts.userId, userId)).orderBy(desc(financialContexts.createdAt))
        : Promise.resolve([]),
    ]);

    // 2. Reconcile due payrolls if any are in 'expected' status
    const hasExpectedPayrolls = initialPayrolls.some((p) => p.status === 'expected');
    let effectivePayrolls = initialPayrolls;
    if (hasExpectedPayrolls) {
      const syncedCount = await payrollService.reconcileDuePayrolls(userId, new Date(), initialPayrolls);
      if (syncedCount > 0) {
        effectivePayrolls = await payrollRepository.findAllByUserId(userId);
      }
    }

    // 3. Batch fetch transaction splits and linked payroll transactions
    const txIds = rawTransactions.map((t) => t.id);
    const payrollIds = effectivePayrolls.map((p) => p.id);

    const [allSplits, linkedPayrollTxs, syncedContexts] = await Promise.all([
      transactionRepository.findSplitsByTransactionIds(txIds),
      payrollIds.length > 0
        ? transactionRepository.findByPayrollIds(payrollIds)
        : Promise.resolve([]),
      isAdvanced ? syncContextStatuses(userId, rawContexts) : Promise.resolve([]),
    ]);

    // 4. Pure in-memory enrichment with zero duplicate queries
    const enrichedTransactions = buildEnrichedTransactions(rawTransactions, allSplits, allDebts);
    const enrichedDebts = buildDebtsWithSettlements(
      userId,
      allDebts,
      allSplits,
      rawTransactions,
      rawForfeitLogs
    );
    const enrichedPayrolls = enrichPayrollsWithLinkedTxs(effectivePayrolls, userWallets, linkedPayrollTxs);
    const enrichedGoals = buildGoalsWithEvents(rawGoals, goalEvents);
    const enrichedSubs = buildSubscriptionsWithWallets(rawSubs, userWallets);
    const settings = await settingsService.getSettings(dbUser);

    const kpis = computeKpisFromInputs({
      dbUser,
      userWallets,
      transactions: enrichedTransactions,
      payrolls: effectivePayrolls,
      allDebts: enrichedDebts,
      allBudgets,
    });

    return {
      kpis,
      transactions: enrichedTransactions,
      debts: enrichedDebts,
      settings,
      categoryBudgets: allBudgets,
      payrolls: enrichedPayrolls,
      goals: enrichedGoals,
      subscriptions: enrichedSubs,
      contexts: syncedContexts,
    };
  }
}

export const dashboardBootstrapService = new DashboardBootstrapService();
