import { FinancialEngineInput, computeFinancialState } from './financialEngine.js';
import { BehavioralPattern } from './financialMemory.js';
import { SecurityAlert } from './securityIntelligence.js';

export interface FinancialBriefing {
  generatedAt: Date;
  summary: string;
  actionItems: string[];
}

export function generateFinancialBriefing(
  input: FinancialEngineInput, 
  patterns: BehavioralPattern[], 
  alerts: SecurityAlert[]
): FinancialBriefing {
  const state = computeFinancialState(input);
  const actionItems: string[] = [];
  
  if (state.safeToSpend < 0) {
    actionItems.push('Your safe-to-spend is negative. Halt discretionary spending immediately.');
  } else if (state.safeToSpend < state.monthlyExpenses * 0.1) {
    actionItems.push('Your safe-to-spend is running low for this period.');
  }

  if (state.safeToInvest && state.safeToInvest > 0) {
    actionItems.push(`You have an estimated surplus of ${state.safeToInvest.toFixed(2)} that is safe to invest or save.`);
  }

  for (const alert of alerts) {
    if (alert.riskLevel === 'HIGH') {
      actionItems.push(`SECURITY: Please review high-risk transaction ${alert.transactionId} (${alert.reason}).`);
    }
  }

  for (const pattern of patterns) {
    if (pattern.type === 'CATEGORY_SPIKE') {
      actionItems.push(`BEHAVIOR: ${pattern.description}`);
    }
  }

  let summary = `Your Net Worth is currently ${state.netWorth?.toFixed(2)} with total liquidity at ${state.totalLiquidity.toFixed(2)}.`;
  
  return {
    generatedAt: new Date(),
    summary,
    actionItems
  };
}
