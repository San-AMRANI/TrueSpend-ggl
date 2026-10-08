import { FinancialEngineInput } from './financialEngine.js';

export function generatePaycheckProposal(input: FinancialEngineInput, expectedSalary: number) {
  const commitments = (input.commitments || []).filter(c => c.status === 'active').reduce((sum, c) => sum + (Number(c.amount) || 0), 0);
  const pendingPayables = input.debts
    .filter(d => d.type === 'Payable' && d.status === 'Pending')
    .reduce((sum, d) => sum + (Number(d.remainingBalance) || 0), 0);
  const totalBudgets = (input.budgets || []).reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
  
  // Example simplistic proposal calculation
  let remaining = expectedSalary;
  
  const allocate = (amount: number) => {
    const allocated = Math.min(remaining, amount);
    remaining -= allocated;
    return allocated;
  };

  const toCommitments = allocate(commitments);
  const toDebts = allocate(pendingPayables);
  const toLivingCosts = allocate(totalBudgets);
  
  // Assuming emergency buffer target vs current
  // In a real scenario we'd calculate the gap, but here we just allocate 10% of remaining to goals and 10% to investments if possible
  const toGoals = allocate(remaining * 0.1);
  const toInvestments = allocate(remaining * 0.1);
  const flexible = remaining;

  return {
    expectedSalary,
    allocations: {
      commitments: toCommitments,
      debts: toDebts,
      livingCosts: toLivingCosts,
      goals: toGoals,
      investments: toInvestments,
      flexible,
    }
  };
}
