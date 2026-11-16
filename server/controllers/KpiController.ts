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
import { resolveContextStatusFromDates } from './ContextController.js';

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

  async getBootstrapData(req: AuthRequest, res: Response) {
    try {
      const dbUser = req.dbUser;
      const userId = dbUser.id;
      const scope = String(req.query.scope || 'all').toLowerCase();
      const isAdvanced = (dbUser.experienceTier || 'advanced') === 'advanced';

      // 1. Ensure default wallets and reconcile any due payrolls once
      const userWallets = await walletService.getWallets(userId);
      await payrollService.reconcileDuePayrolls(userId);

      if (scope === 'ledger') {
        const [rawTransactions, allSplits, debts, payrolls, budgets] = await Promise.all([
          transactionRepository.findAllByUserId(userId),
          transactionRepository.findSplitsByUserId(userId),
          debtRepository.findAllByUserId(userId),
          payrollRepository.findAllByUserId(userId),
          categoryBudgetRepository.findAllByUserId(userId),
        ]);

        const transactions = await transactionService.getTransactionsForUser(userId, {
          rawTransactions,
          allSplits,
          allDebts: debts,
        });

        const kpis = await kpiService.getKpisForUser(dbUser, {
          wallets: userWallets,
          transactions,
          payrolls,
          debts,
          budgets,
          skipPayrollReconcile: true,
        });

        return res.json({
          kpis,
          transactions,
          debts,
          payrolls,
          budgets,
        });
      }

      // Full bootstrap load: query each domain table once in parallel
      const [
        rawTransactions,
        allSplits,
        debts,
        payrolls,
        budgets,
        settings,
        goals,
        subscriptions,
        userContexts,
      ] = await Promise.all([
        transactionRepository.findAllByUserId(userId),
        transactionRepository.findSplitsByUserId(userId),
        debtRepository.findAllByUserId(userId),
        payrollRepository.findAllByUserId(userId),
        categoryBudgetRepository.findAllByUserId(userId),
        settingsService.getSettings(dbUser),
        goalService.getGoalsForUser(userId),
        subscriptionService.getSubscriptionsForUser(userId, userWallets),
        isAdvanced
          ? db
              .select()
              .from(financialContexts)
              .where(eq(financialContexts.userId, userId))
              .orderBy(desc(financialContexts.createdAt))
              .catch(() => [])
          : Promise.resolve([]),
      ]);

      const transactions = await transactionService.getTransactionsForUser(userId, {
        rawTransactions,
        allSplits,
        allDebts: debts,
      });

      const kpis = await kpiService.getKpisForUser(dbUser, {
        wallets: userWallets,
        transactions,
        payrolls,
        debts,
        budgets,
        skipPayrollReconcile: true,
      });

      const now = new Date();
      const contextsPromise = isAdvanced
        ? Promise.all(
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
          )
        : Promise.resolve([]);

      const investmentsPromise = isAdvanced
        ? investmentService
            .getInvestmentsData(userId, {
              preloaded: {
                dbUser,
                kpis,
                subscriptions,
                transactions: rawTransactions,
              },
            })
            .catch(() => null)
        : Promise.resolve(null);

      const [contexts, investmentsData] = await Promise.all([contextsPromise, investmentsPromise]);

      return res.json({
        kpis,
        transactions,
        debts,
        payrolls,
        budgets,
        settings,
        goals,
        subscriptions,
        contexts,
        investmentsData,
      });
    } catch (e: any) {
      console.error('[Bootstrap] Error loading dashboard bootstrap:', e);
      res.status(500).json({ error: 'Internal Server Error', details: e?.message });
    }
  }
}

export const kpiController = new KpiController();
