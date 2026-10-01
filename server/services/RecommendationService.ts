import type { FinancialSnapshot, RecommendationType } from '../../src/types/index.js';
import { recommendationRepository } from '../repositories/RecommendationRepository.js';

type Candidate = { type: RecommendationType; score: number; title: string; summary: string; rationale: string; confidence: 'low' | 'medium' | 'high'; actionPayload: Record<string, unknown>; evidenceJson: Record<string, unknown>; dedupeKey: string };
type RecommendationContext = {
  goals?: Array<{ id: string; name: string; targetAmount: string; currentAmount: string; deadline: Date | null }>;
  debts?: Array<{ id: string; contactName: string; type: string; remainingBalance: string; dueDate: Date | null; status: string }>;
  portfolio?: { marketValue: number; riskConcentration: Array<{ risk: string; percent: number }> };
};
const number = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const dayMs = 86_400_000;

export class RecommendationService {
  async generate(userId: string, snapshot: FinancialSnapshot, hasActivePlan: boolean, context: RecommendationContext = {}) {
    const candidates: Candidate[] = [];
    if (!hasActivePlan && snapshot.financialPeriod.start) candidates.push({ type: 'SalaryPlanReady', score: 100, title: 'Create your salary plan',
      summary: 'Give this financial period’s income clear jobs before it gets spent by default.', rationale: 'A payroll-defined period exists without an active plan.',
      confidence: snapshot.confidence, actionPayload: { action: 'create_financial_plan_draft' }, evidenceJson: { period: snapshot.financialPeriod, safeToSpend: snapshot.safeToSpend }, dedupeKey: `salary-plan:${snapshot.financialPeriod.start}` });
    const bufferGap = Math.max(0, snapshot.buffer.target - snapshot.buffer.current);
    if (bufferGap > 0) candidates.push({ type: 'EmergencyBufferGap', score: 90, title: 'Strengthen your emergency buffer',
      summary: `${bufferGap.toFixed(2)} remains before your protected cash-buffer target is covered.`, rationale: 'The buffer target is based on recorded essential commitments and your strategy.',
      confidence: snapshot.confidence, actionPayload: { action: 'create_financial_plan_draft', focus: 'emergency-buffer' }, evidenceJson: { current: snapshot.buffer.current, target: snapshot.buffer.target }, dedupeKey: `buffer-gap:${snapshot.buffer.target.toFixed(2)}` });
    if (snapshot.reservedForCommitments > snapshot.safeToSpend) candidates.push({ type: 'BillReserveRequired', score: 95, title: 'Protect upcoming bills',
      summary: `${snapshot.reservedForCommitments.toFixed(2)} is needed for known commitments before the next income.`, rationale: 'Commitments are ranked above flexible spending.',
      confidence: snapshot.confidence, actionPayload: { action: 'create_financial_plan_draft', focus: 'commitments' }, evidenceJson: { commitments: snapshot.reservedForCommitments, safeToSpend: snapshot.safeToSpend }, dedupeKey: `bill-reserve:${snapshot.financialPeriod.end || 'unknown'}` });
    if (hasActivePlan && snapshot.plan.unallocatedIncome > 0.01) candidates.push({ type: 'UnallocatedIncome', score: 68, title: 'Give your remaining plan money a job',
      summary: `${snapshot.plan.unallocatedIncome.toFixed(2)} remains intentionally unassigned in the active plan.`, rationale: 'A visible margin is healthy, but an unusually large unallocated amount should be reviewed deliberately.',
      confidence: snapshot.confidence, actionPayload: { action: 'replan_financial_plan', planId: snapshot.plan.activePlanId }, evidenceJson: { unallocatedIncome: snapshot.plan.unallocatedIncome, policy: 'leave-margin' }, dedupeKey: `unallocated:${snapshot.plan.activePlanId}` });
    const paceRisks = snapshot.budgetPacing.filter((budget) => budget.atRisk && budget.classification !== 'excluded');
    if (paceRisks.length) candidates.push({ type: 'BudgetPaceRisk', score: 82, title: 'Review budget pace',
      summary: `${paceRisks.map((budget) => budget.category).slice(0, 2).join(' and ')} ${paceRisks.length > 1 ? 'are' : 'is'} on pace to exceed the current budget.`, rationale: 'Budget pacing divides the remaining approved category amount by the remaining days in the financial period.',
      confidence: snapshot.confidence, actionPayload: { action: 'review_budget_pacing', categories: paceRisks.map((budget) => budget.category) }, evidenceJson: { categories: paceRisks }, dedupeKey: `budget-pace:${snapshot.financialPeriod.start || 'no-period'}:${paceRisks.map((budget) => budget.category).sort().join('|')}` });
    const now = Date.now();
    const goalAtRisk = (context.goals || []).filter((goal) => {
      const remaining = Math.max(0, number(goal.targetAmount) - number(goal.currentAmount));
      const daysToDeadline = goal.deadline ? (goal.deadline.getTime() - now) / dayMs : Infinity;
      return remaining > 0 && daysToDeadline >= 0 && daysToDeadline <= 90 && remaining > snapshot.safeToSpend;
    });
    if (goalAtRisk.length) candidates.push({ type: 'GoalAtRisk', score: 78, title: 'A goal may miss its deadline',
      summary: `${goalAtRisk[0].name} needs more reserved cash than is currently safe to spend before its deadline.`, rationale: 'Time-bound goals are compared with protected cash and the remaining period before their recorded deadline.',
      confidence: snapshot.confidence, actionPayload: { action: 'create_financial_plan_draft', focus: 'goals', goalIds: goalAtRisk.map((goal) => goal.id) }, evidenceJson: { goals: goalAtRisk.map((goal) => ({ id: goal.id, name: goal.name, deadline: goal.deadline, remaining: number(goal.targetAmount) - number(goal.currentAmount) })) }, dedupeKey: `goal-risk:${goalAtRisk.map((goal) => goal.id).sort().join('|')}` });
    const debtDueSoon = (context.debts || []).filter((debt) => debt.type === 'Payable' && debt.status === 'Pending' && debt.dueDate && debt.dueDate.getTime() >= now && debt.dueDate.getTime() - now <= 7 * dayMs);
    if (debtDueSoon.length) candidates.push({ type: 'DebtDueSoon', score: 97, title: 'A debt payment is due soon',
      summary: `${debtDueSoon[0].contactName} is due within seven days.`, rationale: 'Known payables are protected before discretionary spending or investing.',
      confidence: snapshot.confidence, actionPayload: { action: 'review_debt', debtIds: debtDueSoon.map((debt) => debt.id) }, evidenceJson: { debts: debtDueSoon.map((debt) => ({ id: debt.id, dueDate: debt.dueDate, remaining: debt.remainingBalance })) }, dedupeKey: `debt-due:${debtDueSoon.map((debt) => debt.id).sort().join('|')}` });
    if (snapshot.investmentCapacity > 0 && bufferGap === 0) candidates.push({ type: 'InvestmentCapacityAvailable', score: 35, title: 'Review investment capacity',
      summary: `Up to ${snapshot.investmentCapacity.toFixed(2)} is safely available to consider—not a requirement to invest.`, rationale: 'The capacity excludes protected cash, known commitments, debt, goals, budgets, and your safety margin.',
      confidence: snapshot.confidence, actionPayload: { action: 'create_financial_plan_draft', focus: 'investment' }, evidenceJson: { investmentCapacity: snapshot.investmentCapacity }, dedupeKey: `investment-capacity:${snapshot.financialPeriod.end || 'unknown'}` });
    const highRiskShare = context.portfolio?.riskConcentration.filter((risk) => risk.risk === 'High' || risk.risk === 'VeryHigh').reduce((sum, risk) => sum + risk.percent, 0) || 0;
    if (context.portfolio && highRiskShare > 50) candidates.push({ type: 'AllocationDrift', score: 58, title: 'Portfolio risk concentration is high',
      summary: `${highRiskShare.toFixed(1)}% of your priced portfolio is in High or VeryHigh risk assets.`, rationale: 'This is a diversification and loss-risk observation, not a recommendation to buy or sell any asset.',
      confidence: snapshot.confidence, actionPayload: { action: 'review_portfolio_risk' }, evidenceJson: { highRiskShare, riskConcentration: context.portfolio.riskConcentration }, dedupeKey: `allocation-drift:${Math.floor(highRiskShare / 10)}` });
    const overspent = snapshot.budgetPacing.filter((budget) => budget.spent > budget.budget && budget.classification !== 'excluded');
    if (overspent.length) candidates.push({ type: 'UnusualSpending', score: 74, title: 'Spending exceeded a category budget',
      summary: `${overspent[0].category} is ${Math.max(0, overspent[0].spent - overspent[0].budget).toFixed(2)} over its budget.`, rationale: 'This is an observed budget fact; it does not alter the budget or assign blame.',
      confidence: snapshot.confidence, actionPayload: { action: 'review_budget_pacing', categories: overspent.map((budget) => budget.category) }, evidenceJson: { categories: overspent }, dedupeKey: `unusual-spending:${snapshot.financialPeriod.start || 'no-period'}:${overspent.map((budget) => budget.category).sort().join('|')}` });
    if (hasActivePlan && (snapshot.forecast.expected < 0 || snapshot.safeToSpend === 0)) candidates.push({ type: 'PlanReviewRequired', score: 88, title: 'Your active plan needs a controlled review',
      summary: 'The current forecast or spendable-cash protection indicates a possible shortfall.', rationale: 'Plans are never silently changed after approval; a replan preserves history and keeps you in control.',
      confidence: snapshot.confidence, actionPayload: { action: 'replan_financial_plan', planId: snapshot.plan.activePlanId }, evidenceJson: { forecast: snapshot.forecast, safeToSpend: snapshot.safeToSpend }, dedupeKey: `plan-review:${snapshot.plan.activePlanId}:${snapshot.financialPeriod.end || 'unknown'}` });

    const persisted = [];
    for (const candidate of candidates) {
      const existing = await recommendationRepository.findByDedupeKey(userId, candidate.dedupeKey);
      if (existing?.status === 'Snoozed' && existing.snoozedUntil && existing.snoozedUntil.getTime() > Date.now()) continue;
      // Dismissals use a finite cooldown instead of permanently suppressing a
      // materially changed financial risk.
      if (existing?.status === 'Dismissed' && existing.actedAt && Date.now() - existing.actedAt.getTime() < 21 * dayMs) continue;
      persisted.push(await recommendationRepository.upsertByDedupe(userId, { ...candidate, userId, priorityScore: String(candidate.score), status: 'Active' }));
    }
    return persisted;
  }

  async active(userId: string) { return recommendationRepository.findActiveByUserId(userId); }
  async changeStatus(userId: string, id: string, status: 'Viewed' | 'Approved' | 'Dismissed' | 'Snoozed', until?: string) {
    const result = await recommendationRepository.updateStatus(id, userId, status, until ? new Date(until) : null);
    if (!result) throw new Error('Recommendation not found.');
    return result;
  }
}

export const recommendationService = new RecommendationService();
