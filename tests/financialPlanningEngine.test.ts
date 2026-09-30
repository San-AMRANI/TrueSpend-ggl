import assert from 'node:assert/strict';
import { proposeSalaryPlan, validatePlanAllocationTotal } from '../server/services/FinancialPlanningEngine.ts';
import type { FinancialProfile, FinancialSnapshot } from '../src/types/index.ts';

const profile: FinancialProfile = {
  baseCurrency: 'MAD', incomeFrequency: 'monthly', incomeStability: 'stable', strategy: 'Balanced', riskPreference: 'Medium',
  investmentExperience: 'Beginner', investmentHorizon: '5 years', emergencyTargetMonths: '3', minimumUnallocatedAmount: '400',
  minimumUnallocatedPercent: '0', allowCashEquivalentReserve: false,
};
const snapshot: FinancialSnapshot = {
  asOf: new Date().toISOString(), financialPeriod: { start: null, end: null, daysRemaining: 30 }, liquidCash: 5000,
  protectedEmergencyCash: 1000, reservedForCommitments: 2100, reservedForGoals: 700, remainingRequiredBudgetReserve: 1000,
  budgetPacing: [],
  safeToSpend: 1000, safeToSpendBreakdown: [], investmentCapacity: 0, pendingPayables: 300, pendingReceivables: 2000,
  investmentMarketValue: 10000, netWorth: 12700, forecast: { expected: 0, best: 0, worst: 0 },
  buffer: { current: 1000, target: 3000, coverageMonths: 1 }, plan: { unallocatedIncome: 0 }, confidence: 'high', assumptions: [],
};

const draft = proposeSalaryPlan(snapshot, 6000, profile);
assert.equal(validatePlanAllocationTotal(draft.allocations, 6000).valid, true, 'plan allocations must total the income');
assert.equal(draft.allocations.find((item) => item.type === 'Investment')?.amount, 0, 'investment must wait for buffer safety');
assert.ok((draft.allocations.find((item) => item.type === 'Commitment')?.amount || 0) > 0, 'commitments must be first');
assert.ok((draft.allocations.find((item) => item.type === 'Debt')?.amount || 0) > 0, 'debt must be funded before optional allocation');
assert.equal(draft.allocations.find((item) => item.type === 'Investment')?.evidence.investmentCapacity, 0, 'investment value and receivables do not unlock investment capacity');

console.log('financialPlanningEngine tests passed');
