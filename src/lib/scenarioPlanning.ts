import { FinancialEngineInput, computeFinancialState } from './financialEngine.js';
import { Transaction } from '../types/index.js';

export interface Scenario {
  name: string;
  additionalTransactions: Transaction[];
}

export function compareScenarios(baseInput: FinancialEngineInput, scenarios: Scenario[]) {
  const baseState = computeFinancialState(baseInput);
  
  const results = scenarios.map(scenario => {
    const scenarioInput = {
      ...baseInput,
      transactions: [...baseInput.transactions, ...scenario.additionalTransactions]
    };
    const state = computeFinancialState(scenarioInput);
    return {
      name: scenario.name,
      safeToSpend: state.safeToSpend,
      forecastedEndBalance: state.forecast.expected,
      dailyAllowance: state.dailyAllowance,
      runwayDays: state.runwayDays
    };
  });

  return {
    base: {
      name: 'Baseline',
      safeToSpend: baseState.safeToSpend,
      forecastedEndBalance: baseState.forecast.expected,
      dailyAllowance: baseState.dailyAllowance,
      runwayDays: baseState.runwayDays
    },
    scenarios: results
  };
}
