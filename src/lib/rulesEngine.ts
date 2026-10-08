import { FinancialEngineInput, computeFinancialState } from './financialEngine.js';

export interface FinancialRuleEvent {
  type: 'BUDGET_EXCEEDED' | 'SALARY_RECEIVED' | 'RECURRING_INCREASE' | 'GOAL_BEHIND' | 'ANOMALY_DETECTED';
  payload: any;
}

export function evaluateFinancialRules(input: FinancialEngineInput, events: FinancialRuleEvent[]) {
  const state = computeFinancialState(input);
  const actions: string[] = [];

  for (const event of events) {
    switch (event.type) {
      case 'BUDGET_EXCEEDED':
        if (event.payload.usedPercent > 80) {
          actions.push(`Notify: Budget for ${event.payload.category} is ${event.payload.usedPercent}% used.`);
        }
        break;
      case 'SALARY_RECEIVED':
        actions.push('Generate paycheck allocation proposal (Paycheck Planning).');
        break;
      case 'RECURRING_INCREASE':
        if (event.payload.increasePercent > 15) {
          actions.push(`Create review item: ${event.payload.merchant} increased by ${event.payload.increasePercent}%.`);
        }
        break;
      case 'GOAL_BEHIND':
        actions.push(`Recalculate required contribution for goal: ${event.payload.goalName}.`);
        break;
      case 'ANOMALY_DETECTED':
        actions.push(`Add to Transaction Intelligence Inbox: Anomaly detected for ${event.payload.merchant}.`);
        break;
    }
  }

  return actions;
}
