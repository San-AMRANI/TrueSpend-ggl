import { Response } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { financialContexts } from '../../src/db/schema.js';
import { AuthRequest } from '../../src/middleware/auth.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { goalService } from '../services/GoalService.js';
import { investmentService } from '../services/InvestmentService.js';
import { kpiService } from '../services/KpiService.js';
import { payrollService } from '../services/PayrollService.js';
import { settingsService } from '../services/SettingsService.js';
import { subscriptionService } from '../services/SubscriptionService.js';
import { transactionService } from '../services/TransactionService.js';
import { walletService } from '../services/WalletService.js';
import { coreAuditService } from '../services/CoreAuditService.js';
import { resolveContextStatusFromDates } from './ContextController.js';

import { sliceTransactionsWindow } from '../../src/lib/bootstrapScopes.js';

export class KpiController {
  async getKpis(req: AuthRequest, res: Response) {
    try {
      const kpis = await kpiService.getKpisForUser(req.dbUser);
      res.json(kpis);
    } catch (e: any) {
      console.error(e);
      res.status(500).json({ error: 'Internal Server Error', details: e?.message, stack: e?.stack });
    }
  }

  private async buildOperationalRadar(userId: string) {
    const now = new Date();
    const todayIso = now.toISOString().slice(0, 10);
    const twoWeeksIso = new Date(now.getTime() + 14 * 86400000).toISOString().slice(0, 10);

    const [occList, revList, extWealth] = await Promise.all([
      coreAuditService.syncAndGetCommitmentOccurrences(userId).catch(() => []),
      coreAuditService.getReviewInbox(userId).catch(() => []),
      coreAuditService.getExternalWealthItems(userId).catch(() => null),
    ]);

    // Reuse already-fetched extWealth so getFinancialIntegrityReport does not query external_wealth_* twice
    const integritySummary = await coreAuditService
      .getFinancialIntegrityReport(userId, { preloadedExternalWealth: extWealth })
      .catch(() => null);

    const upcomingCommitments = (Array.isArray(occList) ? occList : [])
      .filter(
        (o: any) =>
          (o.status === 'scheduled' || o.status === 'overdue' || o.status === 'partial') &&
          o.expectedDate >= todayIso &&
          o.expectedDate <= twoWeeksIso
      )
      .sort((a: any, b: any) => String(a.expectedDate).localeCompare(String(b.expectedDate)));

    const pendingReviews = (Array.isArray(revList) ? revList : []).filter(
      (item: any) => item.status === 'Captured' || item.status === 'Needs Review'
    );

    const externalWealthSummary = extWealth
      ? (() => {
          const items = Array.isArray((extWealth as any).items) ? (extWealth as any).items : [];
          return {
            items,
            totalExternalAssetsMad: Number((extWealth as any).totalExternalAssetsMad) || 0,
            totalExternalLiabilitiesMad: Number((extWealth as any).totalExternalLiabilitiesMad) || 0,
            netExternalWealthMad: Number((extWealth as any).netExternalWealthMad) || 0,
            staleCount: items.filter((item: any) => item.isStaleEstimate).length,
          };
        })()
      : null;

    return {
      upcomingCommitments,
      pendingReviews,
      integritySummary,
      externalWealthSummary,
    };
  }

  private async loadResolvedContexts(userId: string) {
    const userContexts = await db
      .select()
      .from(financialContexts)
      .where(eq(financialContexts.userId, userId))
      .orderBy(desc(financialContexts.createdAt))
      .catch(() => []);
    const now = new Date();
    return Promise.all(
      userContexts.map(async (ctx: any) => {
        if (!ctx.startDate && !ctx.endDate) return ctx;
        const computedStatus = resolveContextStatusFromDates(
          ctx.startDate,
          ctx.endDate,
          (ctx.status as any) || 'Planned',
          now
        );
        if (computedStatus !== ctx.status) {
          try {
            const [updated] = await db
              .update(financialContexts)
              .set({ status: computedStatus, updatedAt: now })
              .where(and(eq(financialContexts.id, ctx.id), eq(financialContexts.userId, userId)))
              .returning();
            return updated || { ...ctx, status: computedStatus };
          } catch {
            return { ...ctx, status: computedStatus };
          }
        }
        return ctx;
      })
    );
  }

  async getBootstrapData(req: AuthRequest, res: Response) {
    try {
      const dbUser = req.dbUser;
      const userId = dbUser.id;
      const scope = String(req.query.scope || 'core').toLowerCase();
      const liveMarket = req.query.liveMarket === '1';
      const includeFullHistory = req.query.full === '1';
      const isAdvanced = (dbUser.experienceTier || 'advanced') === 'advanced';

      if (scope === 'radar') {
        if (!isAdvanced) {
          return res.json({ scope: 'radar', operationalRadar: null });
        }
        const operationalRadar = await this.buildOperationalRadar(userId);
        return res.json({ scope: 'radar', operationalRadar });
      }

      if (scope === 'history') {
        const [rawTransactions, allSplits, debts, contexts] = await Promise.all([
          transactionRepository.findAllByUserId(userId),
          transactionRepository.findSplitsByUserId(userId),
          debtRepository.findAllByUserId(userId),
          isAdvanced ? this.loadResolvedContexts(userId) : Promise.resolve([]),
        ]);
        const transactions = await transactionService.getTransactionsForUser(userId, {
          rawTransactions,
          allSplits,
          allDebts: debts,
        });
        return res.json({
          scope: 'history',
          transactions,
          transactionsWindow: {
            isPartial: false,
            totalCount: transactions.length,
            loadedCount: transactions.length,
            windowDays: 0,
            oldestLoadedDate:
              transactions.length > 0
                ? new Date(transactions[transactions.length - 1].createdAt).toISOString()
                : null,
          },
          contexts,
        });
      }

      // 1. Ensure default wallets and reconcile any due payrolls in parallel
      const [userWallets] = await Promise.all([
        walletService.getWallets(userId),
        payrollService.reconcileDuePayrolls(userId),
      ]);

      if (scope === 'ledger') {
        const [rawTransactions, allSplits, debts, payrolls, budgets] = await Promise.all([
          transactionRepository.findAllByUserId(userId),
          transactionRepository.findSplitsByUserId(userId),
          debtRepository.findAllByUserId(userId),
          payrollRepository.findAllByUserId(userId),
          categoryBudgetRepository.findAllByUserId(userId),
        ]);

        const fullTransactions = await transactionService.getTransactionsForUser(userId, {
          rawTransactions,
          allSplits,
          allDebts: debts,
        });

        const kpis = await kpiService.getKpisForUser(dbUser, {
          wallets: userWallets,
          transactions: fullTransactions,
          payrolls,
          debts,
          budgets,
          skipPayrollReconcile: true,
        });

        const txSlice = includeFullHistory
          ? {
              transactions: fullTransactions,
              meta: {
                isPartial: false,
                totalCount: fullTransactions.length,
                loadedCount: fullTransactions.length,
                windowDays: 0,
                oldestLoadedDate:
                  fullTransactions.length > 0
                    ? new Date(fullTransactions[fullTransactions.length - 1].createdAt).toISOString()
                    : null,
              },
            }
          : sliceTransactionsWindow(fullTransactions);

        return res.json({
          scope: 'ledger',
          kpis,
          transactions: txSlice.transactions,
          transactionsWindow: txSlice.meta,
          debts,
          payrolls,
          budgets,
        });
      }

      // Core bootstrap load (fast Frame-1 Overview): query core ledger + settings + goals + subs
      const [
        rawTransactions,
        allSplits,
        debts,
        payrolls,
        budgets,
        settings,
        goals,
        subscriptions,
      ] = await Promise.all([
        transactionRepository.findAllByUserId(userId),
        transactionRepository.findSplitsByUserId(userId),
        debtRepository.findAllByUserId(userId),
        payrollRepository.findAllByUserId(userId),
        categoryBudgetRepository.findAllByUserId(userId),
        settingsService.getSettings(dbUser),
        goalService.getGoalsForUser(userId),
        subscriptionService.getSubscriptionsForUser(userId, userWallets),
      ]);

      const fullTransactions = await transactionService.getTransactionsForUser(userId, {
        rawTransactions,
        allSplits,
        allDebts: debts,
      });

      const kpis = await kpiService.getKpisForUser(dbUser, {
        wallets: userWallets,
        transactions: fullTransactions,
        payrolls,
        debts,
        budgets,
        skipPayrollReconcile: true,
      });

      if (scope === 'core') {
        const txSlice = sliceTransactionsWindow(fullTransactions);
        return res.json({
          scope: 'core',
          kpis,
          transactions: txSlice.transactions,
          transactionsWindow: txSlice.meta,
          debts,
          payrolls,
          budgets,
          settings,
          goals,
          subscriptions,
        });
      }

      // Legacy scope=all fallback (retained for backwards compatibility)
      const [contexts, investmentsData, operationalRadar] = await Promise.all([
        isAdvanced ? this.loadResolvedContexts(userId) : Promise.resolve([]),
        isAdvanced
          ? investmentService
              .getInvestmentsData(userId, {
                fastMode: !liveMarket,
                preloaded: {
                  dbUser,
                  kpis,
                  subscriptions,
                  transactions: rawTransactions,
                },
              })
              .catch(() => null)
          : Promise.resolve(null),
        isAdvanced ? this.buildOperationalRadar(userId) : Promise.resolve(null),
      ]);

      return res.json({
        scope: 'all',
        kpis,
        transactions: fullTransactions,
        transactionsWindow: {
          isPartial: false,
          totalCount: fullTransactions.length,
          loadedCount: fullTransactions.length,
          windowDays: 0,
          oldestLoadedDate:
            fullTransactions.length > 0
              ? new Date(fullTransactions[fullTransactions.length - 1].createdAt).toISOString()
              : null,
        },
        debts,
        payrolls,
        budgets,
        settings,
        goals,
        subscriptions,
        contexts,
        investmentsData,
        operationalRadar,
      });
    } catch (e: any) {
      console.error('[Bootstrap] Error loading dashboard bootstrap:', e);
      res.status(500).json({ error: 'Internal Server Error', details: e?.message });
    }
  }
}

export const kpiController = new KpiController();
