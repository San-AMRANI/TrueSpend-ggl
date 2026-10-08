import { FinancialEngineInput, computeFinancialState } from './financialEngine.js';
import { Goal } from '../types/index.js';

export interface DecisionContext {
  amount: number;
  category: string;
  isRecurring?: boolean;
}

export function evaluatePurchaseDecision(input: FinancialEngineInput, goals: Goal[], decision: DecisionContext) {
  const currentState = computeFinancialState(input);
  
  const isAffordableToday = currentState.safeToSpend >= decision.amount;
  let affordableMessage = isAffordableToday 
    ? 'Affordable today' 
    : `Not affordable based on safe-to-spend (short by ${(decision.amount - currentState.safeToSpend).toFixed(2)})`;

  let goalImpacts: { name: string, delayWeeks: number }[] = [];
  
  const activeGoals = goals.filter(g => Number(g.targetAmount) > Number(g.currentAmount));
  
  // Distribute surplus proportionally based on remaining target amounts
  const surplus = Math.max(0, currentState.forecast.expected);
  
  if (activeGoals.length > 0 && isAffordableToday && surplus > 0) {
    const surplusAfterPurchase = Math.max(0, surplus - decision.amount);
    const totalRemaining = activeGoals.reduce((sum, g) => sum + (Number(g.targetAmount) - Number(g.currentAmount)), 0);
    
    for (const goal of activeGoals) {
      const remainingTarget = Number(goal.targetAmount) - Number(goal.currentAmount);
      const proportion = remainingTarget / totalRemaining;
      
      const goalMonthlySavingsBefore = surplus * proportion;
      const goalMonthlySavingsAfter = surplusAfterPurchase * proportion;
      
      if (goalMonthlySavingsBefore > 0) {
        const weeksBefore = remainingTarget / (goalMonthlySavingsBefore / 4);
        
        let weeksAfter: number;
        if (goalMonthlySavingsAfter <= 0) {
           weeksAfter = Infinity;
        } else {
           weeksAfter = remainingTarget / (goalMonthlySavingsAfter / 4);
        }
        
        const weeksDelay = Math.max(0, Math.round(weeksAfter - weeksBefore));
        if (weeksDelay > 0 && isFinite(weeksDelay)) {
          goalImpacts.push({ name: goal.name, delayWeeks: weeksDelay });
        } else if (!isFinite(weeksAfter)) {
           goalImpacts.push({ name: goal.name, delayWeeks: -1 });
        }
      }
    }
  }
  
  let goalImpactMessage = '';
  if (goalImpacts.length > 0) {
    const impactsText = goalImpacts.map(g => g.delayWeeks === -1 ? `halts progress on ${g.name}` : `delays ${g.name} by ${g.delayWeeks} weeks`).join(', ');
    goalImpactMessage = `, but it ${impactsText}.`;
  } else if (isAffordableToday && decision.amount > surplus) {
    goalImpactMessage = `, but it consumes your entire savings surplus for the period.`;
  }

  return {
    isAffordable: isAffordableToday,
    message: affordableMessage + goalImpactMessage,
    currentState: {
      safeToSpend: currentState.safeToSpend,
      totalLiquidity: currentState.totalLiquidity,
    },
    goalImpacts
  };
}
