import { and, eq, ne } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { categoryBudgets, financialPlans, goals, investmentEvents, planAllocations, transactions, wallets } from '../../src/db/schema.js';
import type { FinancialPlan, FinancialSnapshot, PlanAllocation } from '../../src/types/index.js';
import { financialPlanRepository } from '../repositories/FinancialPlanRepository.js';
import { budgetCategoryPreferenceRepository } from '../repositories/BudgetCategoryPreferenceRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { proposeSalaryPlan, validatePlanAllocationTotal } from './FinancialPlanningEngine.js';
import { financialSnapshotService } from './FinancialSnapshotService.js';

const money = (value: number) => Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;
const value = (amount: string | number | null | undefined) => Number(amount ?? 0) || 0;

type DbUser = { id: string; emergencyBuffer: string | number; salary: string | number };
type DraftInput = { incomeAmount: number; payrollId?: string; sourceTransactionId?: string; periodStart?: string; periodEnd?: string };
type AllocationEdit = Pick<PlanAllocation, 'id'> & Partial<Pick<PlanAllocation, 'amount' | 'category' | 'goalId' | 'investmentAccountId' | 'sourceWalletId' | 'destinationWalletId' | 'name'>>;
type BudgetProposal = {
  category: string;
  currentBudget: number;
  spent: number;
  proposedBudget: number;
  remainingToReserve: number;
  classification: 'essential' | 'flexible' | 'growth' | 'excluded';
  isLocked: boolean;
  neverAutoChange: boolean;
};

export class FinancialPlanService {
  private async serialize(plan: typeof financialPlans.$inferSelect) {
    const allocations = await financialPlanRepository.findAllocations(plan.id, plan.userId);
    return { ...plan, allocations };
  }

  async list(userId: string) {
    const plans = await financialPlanRepository.findAllByUserId(userId);
    return Promise.all(plans.map((plan) => this.serialize(plan)));
  }

  async get(userId: string, id: string) {
    const plan = await financialPlanRepository.findByIdAndUserId(id, userId);
    if (!plan) throw new Error('Financial plan not found.');
    return this.serialize(plan);
  }

  async createDraft(dbUser: DbUser, input: Partial<DraftInput> = {}) {
    const userId = dbUser.id;
    let incomeAmount = Number(input.incomeAmount);
    let payrollId = input.payrollId;

    if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
      if (payrollId) {
        const p = await payrollRepository.findByIdAndUserId(payrollId, userId);
        if (p && Number(p.amount) > 0) incomeAmount = Number(p.amount);
      }

      if (!incomeAmount || incomeAmount <= 0) {
        const userPayrolls = await payrollRepository.findAllByUserId(userId);
        if (userPayrolls.length > 0) {
          const sorted = [...userPayrolls].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
          const now = new Date();
          const upcoming = sorted.find((p) => new Date(p.scheduledFor) >= new Date(now.getFullYear(), now.getMonth(), 1));
          const selected = upcoming || sorted[sorted.length - 1];
          if (selected && Number(selected.amount) > 0) {
            incomeAmount = Number(selected.amount);
            payrollId = selected.id;
          }
        }
      }

      if ((!incomeAmount || incomeAmount <= 0) && Number(dbUser.salary) > 0) {
        incomeAmount = Number(dbUser.salary);
      }

      if (!Number.isFinite(incomeAmount) || incomeAmount <= 0) {
        throw new Error('Income amount must be greater than zero. Please configure a payroll in your Financial Calendar or enter an income amount.');
      }
    }

    if (payrollId && !await payrollRepository.findByIdAndUserId(payrollId, userId)) throw new Error('Payroll not found.');
    if (input.sourceTransactionId && !await transactionRepository.findByIdAndUserId(input.sourceTransactionId, userId)) throw new Error('Income transaction not found.');
    const { snapshot, profile, budgets, budgetPreferences, transactions } = await financialSnapshotService.build(dbUser);
    const budgetProposal = this.buildBudgetProposal(snapshot, budgets, budgetPreferences, transactions);
    const draft = proposeSalaryPlan(snapshot, incomeAmount, profile, { recommendedBudgetReserve: budgetProposal.total });
    const allGoals = await goalRepository.findAllByUserId(userId);
    const goalLines = this.splitGoalAllocation(draft.allocations.find((line) => line.type === 'Goal')?.amount || 0, allGoals, snapshot.asOf);
    const allocations: Array<Omit<typeof planAllocations.$inferInsert, 'planId'>> = [];
    for (const line of draft.allocations) {
      if (line.type === 'Goal' && goalLines.length) {
        allocations.push(...goalLines);
      } else if (line.type === 'Budget' && budgetProposal.lines.length) {
        allocations.push(...this.splitBudgetAllocation(line.amount, budgetProposal.lines, userId));
      } else {
        allocations.push({ userId, type: line.type, name: line.name, amount: String(line.amount), status: 'Planned', priority: line.priority,
          category: line.category || null, rationale: line.rationale, evidenceJson: line.evidence });
      }
    }
    const periodStart = input.periodStart ? new Date(input.periodStart) : snapshot.financialPeriod.start ? new Date(snapshot.financialPeriod.start) : null;
    const periodEnd = input.periodEnd ? new Date(input.periodEnd) : snapshot.financialPeriod.end ? new Date(snapshot.financialPeriod.end) : null;
    const created = await financialPlanRepository.create({ userId, payrollId: payrollId || null, sourceTransactionId: input.sourceTransactionId || null,
      status: 'Draft', periodStart, periodEnd, incomeAmount: String(incomeAmount), baseCurrency: profile.baseCurrency, snapshotJson: { ...snapshot, warnings: draft.warnings, shortfall: draft.shortfall }, engineVersion: 'v2.0' }, allocations);
    return { ...created.plan, allocations: created.allocations, warnings: draft.warnings, shortfall: draft.shortfall };
  }

  /**
   * Creates a transparent, bounded budget proposal. Calendar-month budget
   * records stay authoritative; the plan stores the remaining reserve for the
   * financial period and only changes a calendar budget after explicit approval.
   */
  private buildBudgetProposal(
    snapshot: FinancialSnapshot,
    budgets: Array<typeof categoryBudgets.$inferSelect>,
    preferences: Array<{ category: string; classification: 'essential' | 'flexible' | 'growth' | 'excluded'; isLocked: boolean; neverAutoChange: boolean }>,
    transactions: Array<{ type: string; category: string | null; amount: string; createdAt: Date }>,
  ) {
    const preferenceByCategory = new Map(preferences.map((preference) => [preference.category, preference]));
    const pacingByCategory = new Map<string, { spent: number }>(snapshot.budgetPacing.map((item: any) => [item.category, item]));
    const historyStart = new Date(new Date(snapshot.asOf).getTime() - 90 * 86_400_000);
    const historical = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'Expense' || !transaction.category || transaction.createdAt < historyStart) continue;
      historical.set(transaction.category, (historical.get(transaction.category) || 0) + value(transaction.amount));
    }
    const currentByCategory = new Map(budgets.map((budget) => [budget.category, value(budget.amount)]));
    const categories = new Set([...currentByCategory.keys(), ...historical.keys()]);
    const lines: BudgetProposal[] = [...categories].sort().map((category) => {
      const preference = preferenceByCategory.get(category);
      const currentBudget = currentByCategory.get(category) || 0;
      const spent = pacingByCategory.get(category)?.spent || 0;
      const historicalMonthly = money((historical.get(category) || 0) / 3);
      const classification = preference?.classification || 'flexible';
      const policyLocked = Boolean(preference?.isLocked || preference?.neverAutoChange || classification === 'excluded');
      // Locked / excluded categories retain their recorded calendar budget.
      // Other categories use three months of actual expense history, with the
      // current budget retained when there is insufficient history.
      const historicalTarget = historicalMonthly > 0 ? historicalMonthly : currentBudget;
      const adjustedTarget = classification === 'growth' ? historicalTarget * 0.9 : historicalTarget;
      const proposedBudget = money(Math.max(0, policyLocked ? currentBudget : adjustedTarget));
      return {
        category,
        currentBudget,
        spent,
        proposedBudget,
        remainingToReserve: money(Math.max(0, proposedBudget - spent)),
        classification,
        isLocked: Boolean(preference?.isLocked),
        neverAutoChange: Boolean(preference?.neverAutoChange),
      };
    });
    return { lines, total: money(lines.reduce((sum, line) => sum + line.remainingToReserve, 0)) };
  }

  private splitBudgetAllocation(total: number, proposal: BudgetProposal[], userId: string) {
    let remaining = money(total);
    // Preserve locked/essential envelope first if income cannot fund every
    // discretionary category. This is an allocation priority, not a silent
    // mutation of the existing calendar budget.
    const ordered = [...proposal].sort((left, right) => {
      const rank = (line: BudgetProposal) => line.isLocked || line.neverAutoChange || line.classification === 'essential' ? 0 : line.classification === 'flexible' ? 1 : line.classification === 'growth' ? 2 : 3;
      return rank(left) - rank(right) || left.category.localeCompare(right.category);
    });
    const lines = ordered.map((item) => {
      const allocated = money(Math.min(remaining, item.remainingToReserve));
      remaining = money(remaining - allocated);
      const protectedByPolicy = item.isLocked || item.neverAutoChange || item.classification === 'excluded';
      return {
        userId,
        type: 'Budget' as const,
        name: `Budget: ${item.category}`,
        amount: String(allocated),
        status: 'Planned' as const,
        priority: item.classification === 'essential' ? 4 : 5,
        category: item.category,
        rationale: protectedByPolicy
          ? 'This category is preserved by your budget policy and will never be changed automatically.'
          : 'This category reserve uses recent spending history and can be edited before approval.',
        evidenceJson: {
          rule: 'adaptive-category-budget',
          classification: item.classification,
          currentBudget: item.currentBudget,
          spent: item.spent,
          proposedBudget: item.proposedBudget,
          isLocked: item.isLocked,
          neverAutoChange: item.neverAutoChange,
        },
      };
    });
    if (remaining > 0.01) {
      lines.push({ userId, type: 'Budget' as const, name: 'Flexible category budgets', amount: String(remaining), status: 'Planned' as const, priority: 5,
        category: null, rationale: 'No category history is available for this remaining flexible reserve.', evidenceJson: { rule: 'adaptive-category-budget', classification: 'flexible', currentBudget: 0, spent: 0, proposedBudget: remaining, isLocked: false, neverAutoChange: false } });
    }
    return lines;
  }

  private splitGoalAllocation(total: number, goalsForUser: Array<typeof goals.$inferSelect>, asOf: string) {
    const now = new Date(asOf);
    const needs = goalsForUser.map((goal) => {
      const remaining = Math.max(0, value(goal.targetAmount) - value(goal.currentAmount));
      const periods = goal.deadline ? Math.max(1, Math.ceil((goal.deadline.getTime() - now.getTime()) / (30.4375 * 86_400_000))) : 1;
      return { goal, desired: remaining / periods };
    }).filter((item) => item.desired > 0);
    let remaining = total;
    return needs.map((item) => {
      const allocated = money(Math.min(remaining, item.desired)); remaining = money(remaining - allocated);
      return { userId: item.goal.userId, type: 'Goal' as const, name: `Goal: ${item.goal.name}`, amount: String(allocated), status: 'Planned' as const,
        priority: 4, goalId: item.goal.id, destinationWalletId: item.goal.walletId || null,
        rationale: 'This contribution keeps the goal moving toward its recorded deadline.', evidenceJson: { rule: 'fund-time-bound-goals', target: value(item.goal.targetAmount), current: value(item.goal.currentAmount), desired: item.desired } };
    }).filter((item) => value(item.amount) > 0);
  }

  async edit(userId: string, planId: string, edits: AllocationEdit[]) {
    const plan = await financialPlanRepository.findByIdAndUserId(planId, userId);
    if (!plan) throw new Error('Financial plan not found.');
    if (plan.status !== 'Draft') throw new Error('Active plans must be revised with Replan to preserve their history.');
    const existing = await financialPlanRepository.findAllocations(planId, userId);
    if (!edits.length) return this.serialize(plan);
    const allowed = new Set(existing.map((line) => line.id));
    if (edits.some((edit) => !allowed.has(edit.id))) throw new Error('One or more plan allocations were not found.');
    const projected = existing.map((line) => {
      const edit = edits.find((candidate) => candidate.id === line.id);
      return { ...line, ...edit, amount: edit?.amount === undefined ? line.amount : String(edit.amount) };
    });
    const validation = validatePlanAllocationTotal(projected, value(plan.incomeAmount));
    if (!validation.valid) throw new Error(`Allocation total must equal the income amount (${value(plan.incomeAmount).toFixed(2)}); received ${validation.total.toFixed(2)}.`);
    for (const edit of edits) {
      if (edit.amount !== undefined && (!Number.isFinite(value(edit.amount)) || value(edit.amount) < 0)) throw new Error('Allocation amounts must be non-negative.');
      await financialPlanRepository.updateAllocation(edit.id, planId, userId, { ...edit, amount: edit.amount === undefined ? undefined : String(edit.amount), status: 'Changed' });
    }
    return this.get(userId, planId);
  }

  async approve(userId: string, planId: string, allocationIds: string[], sourceWalletId: string | undefined, confirmWarnings: string[] = []) {
    const plan = await financialPlanRepository.findByIdAndUserId(planId, userId);
    if (!plan) throw new Error('Financial plan not found.');
    if (!['Draft', 'Active'].includes(plan.status)) throw new Error('Only draft or active plans can be approved.');
    const all = await financialPlanRepository.findAllocations(planId, userId);
    const selected = allocationIds.length ? all.filter((line) => allocationIds.includes(line.id)) : all.filter((line) => line.status === 'Planned' || line.status === 'Changed');
    if (!selected.length) throw new Error('Select at least one planned allocation.');
    if (selected.some((line) => line.type === 'Investment' && value(line.amount) > 0)) {
      const snapshot = plan.snapshotJson as unknown as FinancialSnapshot;
      if (snapshot.buffer.current < snapshot.buffer.target && !confirmWarnings.includes('investment-before-target-buffer')) {
        throw new Error('Confirm the investment-before-target-buffer warning to approve this investment allocation.');
      }
    }
    const defaultSource = sourceWalletId || selected.find((line) => line.sourceWalletId)?.sourceWalletId || undefined;
    if (selected.some((line) => ['EmergencyBuffer', 'Goal', 'Investment'].includes(line.type) && value(line.amount) > 0) && !defaultSource) throw new Error('Select a source wallet for cash-moving allocations.');

    await db.transaction(async (tx) => {
      if (defaultSource) {
        const source = (await tx.select().from(wallets).where(and(eq(wallets.id, defaultSource), eq(wallets.userId, userId))).limit(1))[0];
        if (!source) throw new Error('Source wallet not found.');
      }
      for (const line of selected) {
        let executedTransactionId: string | null = null;
        let executed = false;
        const sourceId = line.sourceWalletId || defaultSource || null;
        if (line.type === 'EmergencyBuffer' && line.destinationWalletId && sourceId && value(line.amount) > 0) {
          const transaction = (await tx.insert(transactions).values({ userId, walletId: sourceId, destinationWalletId: line.destinationWalletId, amount: line.amount, type: 'Transfer', category: 'Emergency Buffer', notes: '[Plan execution] Emergency buffer transfer' }).returning())[0];
          executedTransactionId = transaction.id; executed = true;
        }
        if (line.type === 'Goal' && line.goalId && sourceId && value(line.amount) > 0) {
          const goal = (await tx.select().from(goals).where(and(eq(goals.id, line.goalId), eq(goals.userId, userId))).limit(1))[0];
          if (!goal) throw new Error('Goal allocation points to a missing goal.');
          const transaction = goal.walletId
            ? (await tx.insert(transactions).values({ userId, walletId: sourceId, destinationWalletId: goal.walletId, amount: line.amount, type: 'Transfer', category: 'Goal Contribution', notes: `[Plan execution] ${goal.name}` }).returning())[0]
            : null;
          await tx.update(goals).set({ currentAmount: String(value(goal.currentAmount) + value(line.amount)), updatedAt: new Date() }).where(eq(goals.id, goal.id));
          executedTransactionId = transaction?.id || null; executed = true;
        }
        if (line.type === 'Investment' && line.investmentAccountId && sourceId && value(line.amount) > 0) {
          const transaction = (await tx.insert(transactions).values({ userId, walletId: sourceId, amount: line.amount, type: 'Transfer', category: 'Investment Funding', notes: '[Investment funding] Salary plan' }).returning())[0];
          await tx.insert(investmentEvents).values({ userId, investmentAccountId: line.investmentAccountId, type: 'Funding', tradeDate: new Date(), quoteCurrency: plan.baseCurrency,
            grossAmount: line.amount, feeAmount: '0', feeCurrency: plan.baseCurrency, exchangeRateToBase: '1', baseAmount: line.amount, linkedTransactionId: transaction.id, notes: '[Plan execution] Investment funding' });
          executedTransactionId = transaction.id; executed = true;
        }
        if (line.type === 'Budget' && line.category && value(line.amount) > 0) {
          const period = plan.periodStart || new Date();
          const preference = await budgetCategoryPreferenceRepository.find(userId, line.category);
          const evidence = line.evidenceJson as { spent?: number; proposedBudget?: number };
          const userEdited = line.status === 'Changed';
          // A locked / excluded category remains untouched by generated plans.
          // An explicit draft edit is still a user-approved change.
          if (!preference?.isLocked && !preference?.neverAutoChange || userEdited) {
            const targetBudget = money((Number(evidence.spent) || 0) + value(line.amount));
            await tx.insert(categoryBudgets).values({ userId, category: line.category, year: period.getUTCFullYear(), month: period.getUTCMonth() + 1, amount: String(targetBudget) })
              .onConflictDoUpdate({ target: [categoryBudgets.userId, categoryBudgets.category, categoryBudgets.year, categoryBudgets.month], set: { amount: String(targetBudget), updatedAt: new Date() } });
          }
          executed = true;
        }
        await tx.update(planAllocations).set({ sourceWalletId: sourceId, status: executed ? 'Executed' : 'Approved', executedTransactionId, executedAt: executed ? new Date() : null, updatedAt: new Date() })
          .where(and(eq(planAllocations.id, line.id), eq(planAllocations.planId, planId), eq(planAllocations.userId, userId)));
      }
      // Keep a single active plan per user so snapshot reservations and
      // recommendations can never double-count separate plan versions.
      await tx.update(financialPlans).set({ status: 'Superseded', completedAt: new Date(), updatedAt: new Date() })
        .where(and(eq(financialPlans.userId, userId), eq(financialPlans.status, 'Active'), ne(financialPlans.id, planId)));
      await tx.update(financialPlans).set({ status: 'Active', approvedAt: new Date(), updatedAt: new Date() }).where(and(eq(financialPlans.id, planId), eq(financialPlans.userId, userId)));
    });
    return this.get(userId, planId);
  }

  async replan(dbUser: DbUser, planId: string) {
    const previous = await financialPlanRepository.findByIdAndUserId(planId, dbUser.id);
    if (!previous) throw new Error('Financial plan not found.');
    const draft = await this.createDraft(dbUser, { incomeAmount: value(previous.incomeAmount), payrollId: previous.payrollId || undefined, sourceTransactionId: previous.sourceTransactionId || undefined,
      periodStart: previous.periodStart?.toISOString(), periodEnd: previous.periodEnd?.toISOString() });
    await financialPlanRepository.updatePlan(previous.id, dbUser.id, { status: 'Superseded', completedAt: new Date() });
    await financialPlanRepository.updatePlan(draft.id, dbUser.id, { parentPlanId: previous.id });
    return this.get(dbUser.id, draft.id);
  }

  async cancel(userId: string, planId: string) {
    const plan = await financialPlanRepository.findByIdAndUserId(planId, userId);
    if (!plan) throw new Error('Financial plan not found.');
    if (['Completed', 'Cancelled', 'Superseded'].includes(plan.status)) throw new Error('This plan cannot be cancelled.');
    await financialPlanRepository.updatePlan(planId, userId, { status: 'Cancelled', completedAt: new Date() });
    return this.get(userId, planId);
  }
}

export const financialPlanService = new FinancialPlanService();
