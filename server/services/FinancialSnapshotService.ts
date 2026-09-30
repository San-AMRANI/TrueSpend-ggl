import { getCurrentFinancialMonth, isInFinancialMonth } from '../../src/lib/financialMonth.js';
import type { FinancialProfile, FinancialSnapshot } from '../../src/types/index.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { budgetCategoryPreferenceRepository } from '../repositories/BudgetCategoryPreferenceRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { financialPlanRepository } from '../repositories/FinancialPlanRepository.js';
import { financialProfileRepository } from '../repositories/FinancialProfileRepository.js';
import { financialSnapshotRepository } from '../repositories/FinancialSnapshotRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { KpiService } from './KpiService.js';
import { investmentService } from './InvestmentService.js';

const amount = (value: string | number | null | undefined) => Number(value ?? 0) || 0;
const money = (value: number) => Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;

export const defaultFinancialProfile: FinancialProfile = {
  baseCurrency: 'MAD', incomeFrequency: 'monthly', incomeStability: 'stable', strategy: 'Balanced', riskPreference: 'Medium',
  investmentExperience: 'None', investmentHorizon: 'Not set', emergencyTargetMonths: '3', minimumUnallocatedAmount: '0',
  minimumUnallocatedPercent: '0', allowCashEquivalentReserve: false,
};

const monthlySubscriptionAmount = (subscription: { amount: string; billingCycle: string }) => {
  const value = amount(subscription.amount);
  if (subscription.billingCycle === 'yearly') return value / 12;
  if (subscription.billingCycle === 'quarterly') return value / 3;
  if (subscription.billingCycle === 'weekly') return value * 52 / 12;
  return value;
};

export class FinancialSnapshotService {
  private readonly kpis = new KpiService();

  async getProfile(userId: string): Promise<FinancialProfile> {
    const record = await financialProfileRepository.findByUserId(userId);
    if (!record) return defaultFinancialProfile;
    return {
      id: record.id, userId: record.userId, baseCurrency: record.baseCurrency, incomeFrequency: record.incomeFrequency as FinancialProfile['incomeFrequency'],
      incomeStability: record.incomeStability as FinancialProfile['incomeStability'], strategy: record.strategy as FinancialProfile['strategy'],
      riskPreference: record.riskPreference, investmentExperience: record.investmentExperience as FinancialProfile['investmentExperience'],
      investmentHorizon: record.investmentHorizon, emergencyTargetMonths: record.emergencyTargetMonths, minimumUnallocatedAmount: record.minimumUnallocatedAmount,
      minimumUnallocatedPercent: record.minimumUnallocatedPercent, allowCashEquivalentReserve: record.allowCashEquivalentReserve,
      createdAt: record.createdAt.toISOString(), updatedAt: record.updatedAt.toISOString(),
    };
  }

  async updateProfile(userId: string, patch: Partial<FinancialProfile>) {
    const existing = await this.getProfile(userId);
    const merged = { ...existing, ...patch };
    if (!['monthly', 'weekly', 'irregular'].includes(merged.incomeFrequency)) throw new Error('Invalid income frequency.');
    if (!['stable', 'variable', 'irregular'].includes(merged.incomeStability)) throw new Error('Invalid income stability.');
    if (!['BufferFirst', 'DebtFirst', 'GoalFirst', 'Balanced', 'Custom'].includes(merged.strategy)) throw new Error('Invalid financial strategy.');
    if (!['Low', 'Medium', 'High', 'VeryHigh'].includes(merged.riskPreference)) throw new Error('Invalid risk preference.');
    if (![merged.emergencyTargetMonths, merged.minimumUnallocatedAmount, merged.minimumUnallocatedPercent].every((item) => Number.isFinite(Number(item)) && Number(item) >= 0)) throw new Error('Financial profile amounts must be non-negative.');
    const saved = await financialProfileRepository.upsert(userId, {
      baseCurrency: merged.baseCurrency.toUpperCase(), incomeFrequency: merged.incomeFrequency, incomeStability: merged.incomeStability,
      strategy: merged.strategy, riskPreference: merged.riskPreference, investmentExperience: merged.investmentExperience,
      investmentHorizon: merged.investmentHorizon, emergencyTargetMonths: String(merged.emergencyTargetMonths),
      minimumUnallocatedAmount: String(merged.minimumUnallocatedAmount), minimumUnallocatedPercent: String(merged.minimumUnallocatedPercent),
      allowCashEquivalentReserve: merged.allowCashEquivalentReserve,
    });
    return this.getProfile(saved.userId);
  }

  async build(dbUser: { id: string; emergencyBuffer: string | number; salary: string | number }) {
    const userId = dbUser.id;
    const profile = await this.getProfile(userId);
    const [kpis, budgets, budgetPreferences, goals, debts, subscriptions, payrolls, transactions, activePlan, portfolio] = await Promise.all([
      this.kpis.getKpisForUser(dbUser), categoryBudgetRepository.findAllByUserId(userId),
      budgetCategoryPreferenceRepository.findAllByUserId(userId), goalRepository.findAllByUserId(userId), debtRepository.findAllByUserId(userId),
      subscriptionRepository.findAllByUserId(userId), payrollRepository.findAllByUserId(userId),
      transactionRepository.findAllByUserId(userId), financialPlanRepository.findActiveByUserId(userId), investmentService.portfolio(userId, profile.baseCurrency),
    ]);
    const now = new Date();
    const financialMonth = getCurrentFinancialMonth(payrolls as never[], now);
    const periodStart = financialMonth?.start ?? null;
    const periodEnd = financialMonth?.end ?? null;
    const daysRemaining = financialMonth ? Math.max(0, Math.ceil((financialMonth.end.getTime() - now.getTime()) / 86_400_000)) : 0;
    const currentBudgetRows = financialMonth ? budgets.filter((budget) => budget.year === financialMonth.year && budget.month === financialMonth.month) : [];
    const spentByCategory = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.type !== 'Expense' || !financialMonth || !isInFinancialMonth(new Date(transaction.createdAt), payrolls as never[], financialMonth.year, financialMonth.month)) continue;
      spentByCategory.set(transaction.category || '', (spentByCategory.get(transaction.category || '') || 0) + amount(transaction.amount));
    }
    const preferencesByCategory = new Map(budgetPreferences.map((preference) => [preference.category, preference]));
    const budgetPacing = currentBudgetRows.map((budget) => {
      const spent = money(spentByCategory.get(budget.category) || 0);
      const remaining = money(Math.max(0, amount(budget.amount) - spent));
      const preference = preferencesByCategory.get(budget.category);
      const dailyAllowance = daysRemaining ? money(remaining / daysRemaining) : remaining;
      // A category is pace-risky when its observed period spend has already
      // exceeded its budget, or its daily pace would consume the remainder
      // before the period ends. Excluded categories are surfaced but never
      // altered automatically by the planner.
      const elapsedDays = financialMonth ? Math.max(1, Math.ceil((now.getTime() - financialMonth.start.getTime()) / 86_400_000)) : 1;
      const projectedSpend = money(spent * (elapsedDays + daysRemaining) / elapsedDays);
      return {
        category: budget.category,
        budget: money(amount(budget.amount)),
        spent,
        remaining,
        dailyAllowance,
        classification: preference?.classification || 'flexible' as const,
        isLocked: preference?.isLocked || false,
        neverAutoChange: preference?.neverAutoChange || false,
        atRisk: spent > amount(budget.amount) || projectedSpend > amount(budget.amount),
      };
    });
    const remainingRequiredBudgetReserve = money(currentBudgetRows.reduce((sum, budget) => sum + Math.max(0, amount(budget.amount) - (spentByCategory.get(budget.category) || 0)), 0));
    const reservedForCommitments = money(subscriptions.filter((subscription) => subscription.status === 'active' && (!subscription.nextBillingDate || !periodEnd || subscription.nextBillingDate <= periodEnd))
      .reduce((sum, subscription) => sum + monthlySubscriptionAmount(subscription), 0));
    const monthsToGoal = (deadline: Date | null) => {
      if (!deadline) return 1;
      return Math.max(1, Math.ceil((deadline.getTime() - now.getTime()) / (30.4375 * 86_400_000)));
    };
    const goalReserveFromDeadlines = money(goals.reduce((sum, goal) => sum + Math.max(0, amount(goal.targetAmount) - amount(goal.currentAmount)) / monthsToGoal(goal.deadline), 0));
    const planAllocations = activePlan ? await financialPlanRepository.findAllocations(activePlan.id, userId) : [];
    const approvedGoalReserves = money(planAllocations.filter((line) => line.type === 'Goal' && ['Approved', 'Executed'].includes(line.status)).reduce((sum, line) => sum + amount(line.amount), 0));
    const reservedForGoals = Math.max(goalReserveFromDeadlines, approvedGoalReserves);
    const observedEssentials = Math.max(0, reservedForCommitments + (kpis.remainingFixedBudget || 0));
    const bufferTarget = money(observedEssentials * amount(profile.emergencyTargetMonths));
    const savingsCash = money(kpis.accounts.filter((wallet) => wallet.type === 'Savings').reduce((sum, wallet) => sum + wallet.balance, 0));
    // Savings has a separate balance classification. Only Bank/Cash is
    // immediately liquid by default; this prevents savings being counted as
    // both liquid cash and a protected reserve.
    const liquidCash = money(kpis.accounts.filter((wallet) => wallet.type === 'Bank' || wallet.type === 'Cash').reduce((sum, wallet) => sum + wallet.balance, 0));
    const currentBuffer = money(Math.max(amount(kpis.emergencyBuffer), amount(dbUser.emergencyBuffer)));
    const protectedEmergencyCash = money(Math.min(currentBuffer, bufferTarget));
    const protectedEmergencyWithinLiquid = money(Math.max(0, protectedEmergencyCash - Math.min(protectedEmergencyCash, savingsCash)));
    const pendingPayables = money(kpis.pendingPayables);
    const safeToSpend = money(Math.max(0, liquidCash - protectedEmergencyWithinLiquid - reservedForCommitments - pendingPayables - reservedForGoals - remainingRequiredBudgetReserve));
    const safetyMargin = Math.max(amount(profile.minimumUnallocatedAmount), liquidCash * amount(profile.minimumUnallocatedPercent) / 100);
    const investmentCapacity = money(Math.max(0, liquidCash - protectedEmergencyWithinLiquid - reservedForCommitments - pendingPayables - reservedForGoals - remainingRequiredBudgetReserve - safetyMargin));
    const activeUnallocated = money(planAllocations.filter((line) => line.type === 'UnallocatedMargin' && line.status !== 'Skipped').reduce((sum, line) => sum + amount(line.amount), 0));
    const assumptions: string[] = [];
    if (!financialMonth) assumptions.push('No complete payroll-defined financial period is available yet.');
    if (!subscriptions.length) assumptions.push('No active recurring bills are recorded.');
    if (!profile.id) assumptions.push('Complete the Financial Checkup to personalize your buffer and investment strategy.');
    const snapshot: FinancialSnapshot = {
      asOf: now.toISOString(), financialPeriod: { start: periodStart?.toISOString() ?? null, end: periodEnd?.toISOString() ?? null, daysRemaining }, liquidCash,
      protectedEmergencyCash, reservedForCommitments, reservedForGoals, remainingRequiredBudgetReserve, budgetPacing, safeToSpend,
      safeToSpendBreakdown: [
        { label: 'Liquid cash', amount: liquidCash, purpose: 'Bank, cash, and savings wallets' },
        { label: 'Protected emergency cash in liquid wallets', amount: -protectedEmergencyWithinLiquid, purpose: 'Cash buffer protection; savings are already outside liquid cash' },
        { label: 'Upcoming commitments', amount: -reservedForCommitments, purpose: 'Known recurring bills' },
        { label: 'Pending debt obligations', amount: -pendingPayables, purpose: 'Payables due before next income' },
        { label: 'Goal reserves', amount: -reservedForGoals, purpose: 'Time-bound goal contributions' },
        { label: 'Remaining budget reserve', amount: -remainingRequiredBudgetReserve, purpose: 'Category budgets for this period' },
      ],
      investmentCapacity, pendingPayables, pendingReceivables: money(kpis.pendingReceivables), investmentMarketValue: portfolio.marketValue,
      netWorth: money(liquidCash + savingsCash + portfolio.includedInNetWorthValue + amount(kpis.pendingReceivables) - pendingPayables),
      forecast: { expected: kpis.forecast.expected, best: kpis.forecast.best, worst: kpis.forecast.worst },
      buffer: { current: currentBuffer, target: bufferTarget, coverageMonths: observedEssentials ? money(currentBuffer / observedEssentials) : 0 },
      plan: activePlan ? { activePlanId: activePlan.id, unallocatedIncome: activeUnallocated, status: activePlan.status } : { unallocatedIncome: 0 },
      confidence: assumptions.length === 0 ? 'high' : assumptions.length === 1 ? 'medium' : 'low', assumptions,
    };
    return {
      snapshot,
      profile,
      kpis,
      budgets: currentBudgetRows,
      budgetPreferences,
      goals,
      debts,
      payrolls,
      transactions,
      dataCompleteness: assumptions,
      activePlan: activePlan ? { ...activePlan, allocations: planAllocations } : null,
    };
  }

  async saveDaily(dbUser: { id: string; emergencyBuffer: string | number; salary: string | number }) {
    const result = await this.build(dbUser);
    const snapshot = result.snapshot;
    return financialSnapshotRepository.upsert(dbUser.id, snapshot.asOf.slice(0, 10), {
      liquidCash: String(snapshot.liquidCash), reservedCash: String(snapshot.protectedEmergencyCash + snapshot.reservedForCommitments + snapshot.reservedForGoals),
      safeToSpend: String(snapshot.safeToSpend), investmentValue: String(snapshot.investmentMarketValue), totalDebt: String(snapshot.pendingPayables),
      netWorth: String(snapshot.netWorth), emergencyCoverageMonths: String(snapshot.buffer.coverageMonths), dataJson: snapshot as unknown as Record<string, unknown>,
    });
  }
}

export const financialSnapshotService = new FinancialSnapshotService();
