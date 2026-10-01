import type { FinancialProfile, FinancialSnapshot, PlanAllocationType } from '../../src/types/index.js';

export interface ProposedPlanAllocation {
  type: PlanAllocationType;
  name: string;
  amount: number;
  priority: number;
  category?: string;
  rationale: string;
  evidence: Record<string, number | string | boolean>;
}

export interface SalaryPlanDraft {
  allocations: ProposedPlanAllocation[];
  shortfall: number;
  warnings: string[];
}

export interface SalaryPlanOptions {
  /** Remaining category-budget reserve proposed from historical spending and user policies. */
  recommendedBudgetReserve?: number;
}

const roundMoney = (value: number) => Math.round((Math.max(0, value) + Number.EPSILON) * 100) / 100;

/**
 * Pure, deterministic salary-plan allocator.  It never touches persistence and
 * it never treats receivables or investment value as cash available to assign.
 */
export function proposeSalaryPlan(
  snapshot: FinancialSnapshot,
  income: number,
  profile: FinancialProfile,
  options: SalaryPlanOptions = {},
): SalaryPlanDraft {
  if (!Number.isFinite(income) || income <= 0) throw new Error('Income amount must be greater than zero.');

  let remaining = roundMoney(income);
  const allocations: ProposedPlanAllocation[] = [];
  const warnings: string[] = [];

  const allocate = (
    type: PlanAllocationType,
    name: string,
    desired: number,
    priority: number,
    rationale: string,
    evidence: Record<string, number | string | boolean>,
    category?: string,
  ) => {
    const amount = roundMoney(Math.min(remaining, Math.max(0, desired)));
    remaining = roundMoney(remaining - amount);
    allocations.push({ type, name, amount, priority, rationale, evidence: { ...evidence, desired: roundMoney(desired), funded: amount }, category });
    return amount;
  };

  const commitment = allocate(
    'Commitment',
    'Required commitments',
    snapshot.reservedForCommitments,
    1,
    'Known recurring bills due before the next income are protected first.',
    { rule: 'maintain-solvency', commitmentsDue: snapshot.reservedForCommitments },
  );
  const debt = allocate(
    'Debt',
    'Debt obligation',
    snapshot.pendingPayables,
    2,
    'Pending payables are funded before optional goals or investments.',
    { rule: 'meet-obligations', payablesDue: snapshot.pendingPayables },
  );

  const emergencyGap = Math.max(0, snapshot.buffer.target - snapshot.buffer.current);
  const emergency = allocate(
    'EmergencyBuffer',
    'Emergency buffer',
    emergencyGap,
    3,
    emergencyGap > 0
      ? 'This contribution closes part of the protected cash-buffer gap.'
      : 'Your emergency-buffer target is already covered, so no extra contribution is needed.',
    { rule: 'protect-resilience', currentBuffer: snapshot.buffer.current, targetBuffer: snapshot.buffer.target },
  );

  const goals = allocate(
    'Goal',
    'Time-bound goals',
    snapshot.reservedForGoals,
    4,
    'Accepted goal reserves are funded after obligations and the emergency buffer.',
    { rule: 'fund-time-bound-goals', goalReserve: snapshot.reservedForGoals },
  );
  const budget = allocate(
    'Budget',
    'Flexible category budgets',
    options.recommendedBudgetReserve ?? snapshot.remainingRequiredBudgetReserve,
    5,
    'This is the remaining protected category budget for the financial period; it does not create a cash expense.',
    { rule: 'allow-flexible-spending', requiredBudgetReserve: options.recommendedBudgetReserve ?? snapshot.remainingRequiredBudgetReserve },
  );

  const marginFloor = Math.max(
    Number(profile.minimumUnallocatedAmount) || 0,
    income * Math.max(0, Number(profile.minimumUnallocatedPercent) || 0) / 100,
  );
  const bufferAfterPlan = snapshot.buffer.current + emergency;
  const canInvest = bufferAfterPlan >= snapshot.buffer.target && profile.riskPreference !== 'Low';
  const investableAfterMargin = Math.max(0, remaining - marginFloor);
  const strategyRate = profile.strategy === 'GoalFirst' ? 0.25 : profile.strategy === 'DebtFirst' ? 0.35 : 0.5;
  const investmentDesired = canInvest ? investableAfterMargin * strategyRate : 0;
  const investment = allocate(
    'Investment',
    'Investment contribution',
    investmentDesired,
    6,
    canInvest
      ? 'This is a conservative portion of surplus after protections, goals, flexible spending, and a safety margin.'
      : 'Investment is held at zero until the protected emergency-buffer target is met and the risk preference permits it.',
    {
      rule: 'invest-only-after-safety', bufferAfterPlan, targetBuffer: snapshot.buffer.target,
      riskPreference: profile.riskPreference, investmentCapacity: snapshot.investmentCapacity,
    },
  );

  allocate(
    'UnallocatedMargin',
    'Unallocated safety margin',
    remaining,
    7,
    'This remains unassigned intentionally, preserving flexibility for uncertain expenses.',
    { rule: 'leave-margin', minimumMargin: roundMoney(marginFloor), investmentContribution: investment },
  );

  const mandatoryDesired = snapshot.reservedForCommitments + snapshot.pendingPayables;
  const mandatoryFunded = commitment + debt;
  const shortfall = roundMoney(Math.max(0, mandatoryDesired - mandatoryFunded));
  if (shortfall > 0) warnings.push(`Mandatory commitments are short by ${shortfall.toFixed(2)} ${profile.baseCurrency}.`);
  if (!canInvest && emergencyGap > 0) warnings.push('Investment is disabled until the protected emergency buffer is funded.');

  return { allocations, shortfall, warnings };
}

export function validatePlanAllocationTotal(allocations: Array<{ amount: number | string }>, income: number) {
  const total = roundMoney(allocations.reduce((sum, allocation) => sum + Number(allocation.amount || 0), 0));
  return { valid: Math.abs(total - roundMoney(income)) <= 0.01, total };
}
