import { FinancialEngineInput, computeFinancialState } from './financialEngine.js';

export interface MonthlyCloseReport {
  periodId: string;
  openingBalance: number;
  closingBalance: number;
  totalIncome: number;
  totalExpenses: number;
  savingsRate: number;
  isClosed: boolean;
}

export function generateMonthlyClose(input: FinancialEngineInput, periodId: string): MonthlyCloseReport {
  const state = computeFinancialState(input);
  
  const openingBalance = state.totalLiquidity - state.monthlyIncome + state.monthlyExpenses; // simplistic back-calculation for demonstration
  const closingBalance = state.totalLiquidity;
  
  return {
    periodId,
    openingBalance,
    closingBalance,
    totalIncome: state.monthlyIncome,
    totalExpenses: state.monthlyExpenses,
    savingsRate: state.monthlyIncome > 0 ? (state.monthlyIncome - state.monthlyExpenses) / state.monthlyIncome * 100 : 0,
    isClosed: true
  };
}
