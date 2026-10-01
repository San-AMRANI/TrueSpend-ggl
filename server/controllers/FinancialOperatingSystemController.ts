import type { Response } from 'express';
import type { AuthRequest } from '../../src/middleware/auth.js';
import { budgetCategoryPreferenceRepository } from '../repositories/BudgetCategoryPreferenceRepository.js';
import { recommendationRepository } from '../repositories/RecommendationRepository.js';
import { financialPlanRepository } from '../repositories/FinancialPlanRepository.js';
import { financialSnapshotRepository } from '../repositories/FinancialSnapshotRepository.js';
import { financialPlanService } from '../services/FinancialPlanService.js';
import { financialSnapshotService } from '../services/FinancialSnapshotService.js';
import { investmentService } from '../services/InvestmentService.js';
import { marketDataService } from '../services/MarketDataService.js';
import { recommendationService } from '../services/RecommendationService.js';

const sendError = (res: Response, error: unknown, fallback: string, status = 400) => {
  const message = error instanceof Error ? error.message : fallback;
  res.status(status).json({ error: message });
};

export class FinancialOperatingSystemController {
  async getProfile(req: AuthRequest, res: Response) { try { const profile = await financialSnapshotService.getProfile(req.dbUser.id); res.json({ profile, isComplete: Boolean(profile.id) }); } catch (error) { sendError(res, error, 'Unable to load financial profile', 500); } }
  async updateProfile(req: AuthRequest, res: Response) { try { res.json(await financialSnapshotService.updateProfile(req.dbUser.id, req.body)); } catch (error) { sendError(res, error, 'Unable to update financial profile'); } }
  async checkup(req: AuthRequest, res: Response) { try { res.json({ profile: await financialSnapshotService.updateProfile(req.dbUser.id, req.body), completed: true }); } catch (error) { sendError(res, error, 'Unable to save financial checkup'); } }
  async listBudgetPreferences(req: AuthRequest, res: Response) { try { res.json(await budgetCategoryPreferenceRepository.findAllByUserId(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load budget category preferences', 500); } }
  async updateBudgetPreference(req: AuthRequest, res: Response) {
    try {
      const category = typeof req.body.category === 'string' ? req.body.category.trim() : '';
      const classification = req.body.classification;
      if (!category) throw new Error('A budget category is required.');
      if (!['essential', 'flexible', 'growth', 'excluded'].includes(classification)) throw new Error('Invalid budget classification.');
      res.json(await budgetCategoryPreferenceRepository.upsert(req.dbUser.id, {
        category,
        classification,
        isLocked: Boolean(req.body.isLocked),
        neverAutoChange: Boolean(req.body.neverAutoChange),
      }));
    } catch (error) { sendError(res, error, 'Unable to save budget category preference'); }
  }

  async financialHome(req: AuthRequest, res: Response) {
    try {
      let data = await financialSnapshotService.build(req.dbUser);
      // A recorded payroll income is the one automatic draft trigger. It does
      // not execute, alter budgets, or create transfers; it only creates a
      // reviewable draft tied to that immutable income transaction.
      const periodStart = data.snapshot.financialPeriod.start ? new Date(data.snapshot.financialPeriod.start) : null;
      const payrollIncome = data.transactions
        .filter((transaction) => transaction.type === 'Income' && transaction.payrollId && (!periodStart || transaction.createdAt >= periodStart))
        .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())[0];
      if (payrollIncome && !data.activePlan) {
        const existing = await financialPlanRepository.findBySourceTransactionId(req.dbUser.id, payrollIncome.id);
        if (!existing) {
          await financialPlanService.createDraft(req.dbUser, {
            incomeAmount: Number(payrollIncome.amount),
            payrollId: payrollIncome.payrollId || undefined,
            sourceTransactionId: payrollIncome.id,
            periodStart: data.snapshot.financialPeriod.start || undefined,
            periodEnd: data.snapshot.financialPeriod.end || undefined,
          });
          data = await financialSnapshotService.build(req.dbUser);
        }
      }
      await recommendationService.generate(req.dbUser.id, data.snapshot, Boolean(data.activePlan), {
        goals: data.goals,
        debts: data.debts,
        portfolio: await investmentService.portfolio(req.dbUser.id, data.profile.baseCurrency),
      });
      const recommendations = (await recommendationService.active(req.dbUser.id)).slice(0, 3);
      res.json({ snapshot: data.snapshot, profile: data.profile, activePlan: data.activePlan, recommendations, dataCompleteness: data.dataCompleteness });
    } catch (error) { sendError(res, error, 'Unable to load financial home', 500); }
  }
  async listSnapshots(req: AuthRequest, res: Response) { try { res.json(await financialSnapshotRepository.between(req.dbUser.id, typeof req.query.from === 'string' ? req.query.from : undefined, typeof req.query.to === 'string' ? req.query.to : undefined)); } catch (error) { sendError(res, error, 'Unable to load financial snapshots', 500); } }
  async refreshSnapshot(req: AuthRequest, res: Response) { try { res.status(201).json(await financialSnapshotService.saveDaily(req.dbUser)); } catch (error) { sendError(res, error, 'Unable to refresh financial snapshot', 500); } }

  async listPlans(req: AuthRequest, res: Response) { try { res.json(await financialPlanService.list(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load financial plans', 500); } }
  async getPlan(req: AuthRequest, res: Response) { try { res.json(await financialPlanService.get(req.dbUser.id, req.params.id)); } catch (error) { sendError(res, error, 'Financial plan not found', 404); } }
  async draftPlan(req: AuthRequest, res: Response) { try { res.status(201).json(await financialPlanService.createDraft(req.dbUser, req.body)); } catch (error) { sendError(res, error, 'Unable to create financial plan draft'); } }
  async editPlan(req: AuthRequest, res: Response) { try { res.json(await financialPlanService.edit(req.dbUser.id, req.params.id, req.body.allocations || [])); } catch (error) { sendError(res, error, 'Unable to edit financial plan'); } }
  async approvePlan(req: AuthRequest, res: Response) { try { res.json(await financialPlanService.approve(req.dbUser.id, req.params.id, req.body.allocationIds || [], req.body.sourceWalletId, req.body.confirmWarnings || [])); } catch (error) { sendError(res, error, 'Unable to approve financial plan'); } }
  async replan(req: AuthRequest, res: Response) { try { res.status(201).json(await financialPlanService.replan(req.dbUser, req.params.id)); } catch (error) { sendError(res, error, 'Unable to replan'); } }
  async cancelPlan(req: AuthRequest, res: Response) { try { res.json(await financialPlanService.cancel(req.dbUser.id, req.params.id)); } catch (error) { sendError(res, error, 'Unable to cancel financial plan'); } }

  async recommendations(req: AuthRequest, res: Response) { try { res.json(await recommendationService.active(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load recommendations', 500); } }
  async recommendationStatus(req: AuthRequest, res: Response, status: 'Viewed' | 'Approved' | 'Dismissed' | 'Snoozed') { try { res.json(await recommendationService.changeStatus(req.dbUser.id, req.params.id, status, req.body?.until)); } catch (error) { sendError(res, error, 'Recommendation not found', 404); } }
  async approveRecommendation(req: AuthRequest, res: Response) {
    try {
      const recommendation = await recommendationRepository.findByIdAndUserId(req.params.id, req.dbUser.id);
      if (!recommendation) throw new Error('Recommendation not found.');
      const action = (recommendation.actionPayload as { action?: string; planId?: string }).action;
      // Only deterministic, already-supported plan actions may be executed
      // from a recommendation. Advice-only recommendations remain reviewable
      // and never cause a financial mutation by themselves.
      if (action === 'replan_financial_plan' && (recommendation.actionPayload as { planId?: string }).planId) {
        await financialPlanService.replan(req.dbUser, (recommendation.actionPayload as { planId: string }).planId);
      }
      if (action === 'create_financial_plan_draft') {
        const incomeAmount = req.body?.incomeAmount ? Number(req.body.incomeAmount) : undefined;
        await financialPlanService.createDraft(req.dbUser, { incomeAmount, payrollId: req.body?.payrollId, sourceTransactionId: req.body?.sourceTransactionId });
      }
      res.json(await recommendationService.changeStatus(req.dbUser.id, req.params.id, 'Approved'));
    } catch (error) { sendError(res, error, 'Unable to approve recommendation'); }
  }

  async listAccounts(req: AuthRequest, res: Response) { try { res.json(await investmentService.listAccounts(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load investment accounts', 500); } }
  async createAccount(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.createAccount(req.dbUser.id, req.body)); } catch (error) { sendError(res, error, 'Unable to create investment account'); } }
  async updateAccount(req: AuthRequest, res: Response) { try { res.json(await investmentService.updateAccount(req.dbUser.id, req.params.id, req.body)); } catch (error) { sendError(res, error, 'Investment account not found', 404); } }
  async archiveAccount(req: AuthRequest, res: Response) { try { res.json(await investmentService.updateAccount(req.dbUser.id, req.params.id, { isArchived: true })); } catch (error) { sendError(res, error, 'Investment account not found', 404); } }
  async fundAccount(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.fundAccount(req.dbUser.id, req.params.id, req.body.sourceWalletId, Number(req.body.amount), req.body.date, req.body.note)); } catch (error) { sendError(res, error, 'Unable to fund investment account'); } }
  async withdrawAccount(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.withdrawAccount(req.dbUser.id, req.params.id, req.body.destinationWalletId, Number(req.body.amount), req.body.date, req.body.note)); } catch (error) { sendError(res, error, 'Unable to withdraw from investment account'); } }
  async listAssets(req: AuthRequest, res: Response) { try { res.json(await investmentService.listAssets(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load investment assets', 500); } }
  async createAsset(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.createAsset(req.dbUser.id, req.body)); } catch (error) { sendError(res, error, 'Unable to create investment asset'); } }
  async listEvents(req: AuthRequest, res: Response) { try { res.json(await investmentService.listEvents(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load investment events', 500); } }
  async createEvent(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.createEvent(req.dbUser.id, req.body)); } catch (error) { sendError(res, error, 'Unable to create investment event'); } }
  async correctEvent(req: AuthRequest, res: Response) { try { const event = await investmentService.listEvents(req.dbUser.id).then((events) => events.find((item) => item.id === req.params.id)); if (!event) throw new Error('Investment event not found.'); res.status(201).json(await investmentService.createEvent(req.dbUser.id, { ...req.body, investmentAccountId: event.investmentAccountId, assetId: event.assetId, type: 'Adjustment' })); } catch (error) { sendError(res, error, 'Unable to correct investment event'); } }
  async portfolio(req: AuthRequest, res: Response) { try { res.json(await investmentService.portfolio(req.dbUser.id)); } catch (error) { sendError(res, error, 'Unable to load portfolio', 500); } }
  async portfolioPerformance(req: AuthRequest, res: Response) { try { res.json(await financialSnapshotRepository.between(req.dbUser.id, typeof req.query.from === 'string' ? req.query.from : undefined, typeof req.query.to === 'string' ? req.query.to : undefined)); } catch (error) { sendError(res, error, 'Unable to load portfolio performance', 500); } }
  async manualPrice(req: AuthRequest, res: Response) { try { res.status(201).json(await investmentService.recordManualPrice(req.dbUser.id, req.body.assetId, Number(req.body.price), req.body.currency || 'MAD', req.body.capturedAt)); } catch (error) { sendError(res, error, 'Unable to record manual price'); } }

  async searchMarketAssets(req: AuthRequest, res: Response) { try { res.json(await marketDataService.search(String(req.query.q || ''))); } catch (error) { sendError(res, error, 'Market-data search unavailable', 503); } }
  async marketAsset(req: AuthRequest, res: Response) { try { res.json(await marketDataService.asset(req.params.coinGeckoId, typeof req.query.currency === 'string' ? req.query.currency : 'mad')); } catch (error) { sendError(res, error, 'Market-data asset unavailable', 503); } }
  async refreshPrices(req: AuthRequest, res: Response) { try { const profile = await financialSnapshotService.getProfile(req.dbUser.id); res.json(await marketDataService.refreshUserCryptoPrices(req.dbUser.id, profile.baseCurrency)); } catch (error) { sendError(res, error, 'Unable to refresh prices', 503); } }
  async marketHistory(req: AuthRequest, res: Response) { try { const profile = await financialSnapshotService.getProfile(req.dbUser.id); res.json(await marketDataService.history(req.dbUser.id, req.params.coinGeckoId, typeof req.query.from === 'string' ? req.query.from : undefined, typeof req.query.to === 'string' ? req.query.to : undefined, typeof req.query.currency === 'string' ? req.query.currency : profile.baseCurrency)); } catch (error) { sendError(res, error, 'Market-data history unavailable', 503); } }
  async marketStatus(_req: AuthRequest, res: Response) { res.json(marketDataService.status()); }
}

export const financialOperatingSystemController = new FinancialOperatingSystemController();
