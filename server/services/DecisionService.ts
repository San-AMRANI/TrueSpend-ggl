import { kpiService } from './KpiService.js';
import { goalService } from './GoalService.js';
import { evaluatePurchaseDecision, DecisionContext } from '../../src/lib/decisionEngine.js';
import { compareScenarios, Scenario } from '../../src/lib/scenarioPlanning.js';
import { analyzeForecastAccuracy, ForecastRecord } from '../../src/lib/forecastAccuracy.js';
import { evaluateFinancialRules, FinancialRuleEvent } from '../../src/lib/rulesEngine.js';
import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { CommitmentRepository } from '../repositories/CommitmentRepository.js';
import { walletService } from './WalletService.js';
import { FinancialEngineInput } from '../../src/lib/financialEngine.js';

export class DecisionService {
  private async getEngineInput(userId: string, dbUser: any): Promise<FinancialEngineInput> {
    const userWallets = await walletService.getWallets(userId);
    const mainBank = userWallets.find(w => w.type === 'Bank' && w.isMain) || userWallets.find(w => w.type === 'Bank') || userWallets[0];
    const defaultCash = userWallets.find(w => w.type === 'Cash') || mainBank;

    const commitmentRepo = new CommitmentRepository();
    const [allTx, payrolls, allDebts, allBudgets, allCommitments] = await Promise.all([
      transactionService.getTransactionsForUser(userId),
      payrollRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
      commitmentRepo.getByUserId(userId),
    ]);
    
    const transactions = allTx.map(tx => {
      let wid = tx.walletId as any;
      if (!wid || wid === 'Bank') {
        wid = (tx as any).sourceWallet === 'Cash' ? defaultCash.id : mainBank.id;
      } else if (wid === 'Cash') {
        wid = defaultCash.id;
      }
      return { ...tx, walletId: wid };
    });

    return {
      transactions: transactions as any,
      payrolls: payrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      commitments: allCommitments as any,
      wallets: userWallets.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
      })),
      userSettings: {
        emergencyBuffer: parseFloat(dbUser.emergencyBuffer as unknown as string) || 0,
        salary: parseFloat(dbUser.salary as unknown as string) || 0,
      }
    };
  }

  async evaluatePurchase(userId: string, dbUser: any, decision: DecisionContext) {
    const input = await this.getEngineInput(userId, dbUser);
    const dbGoals = await goalService.getGoalsForUser(userId);
    const goals = dbGoals.map(g => ({
      ...g,
      deadline: g.deadline ? g.deadline.toISOString() : ''
    }));
    
    return evaluatePurchaseDecision(input, goals as any, decision);
  }

  async compareScenarios(userId: string, dbUser: any, scenarios: Scenario[]) {
    const input = await this.getEngineInput(userId, dbUser);
    return compareScenarios(input, scenarios);
  }

  async analyzeAccuracy(userId: string, record: ForecastRecord) {
    // In a real implementation we would fetch historical records from a DB.
    // Here we analyze the provided record.
    return analyzeForecastAccuracy(record);
  }

  async runRules(userId: string, dbUser: any, events: FinancialRuleEvent[]) {
    const input = await this.getEngineInput(userId, dbUser);
    return evaluateFinancialRules(input, events);
  }
}

export const decisionService = new DecisionService();
