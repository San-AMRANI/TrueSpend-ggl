import { transactionRepository } from '../repositories/TransactionRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { payrollService } from './PayrollService.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;
    await payrollService.reconcileDuePayrolls(userId);

    const [allTx, payrolls, allDebts, allBudgets, allGoals] = await Promise.all([
      transactionRepository.findAllByUserId(userId),
      payrollRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
      goalRepository.findAllByUserId(userId),
    ]);

    return computeFinancialState({
      transactions: allTx as any,
      payrolls: payrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      goals: allGoals as any,
      userSettings: {
        emergencyBuffer: parseFloat(dbUser.emergencyBuffer as unknown as string) || 0,
        salary: parseFloat(dbUser.salary as unknown as string) || 0,
      }
    });
  }
}
export const kpiService = new KpiService();
