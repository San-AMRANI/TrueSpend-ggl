import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { goalService } from './GoalService.js';

export type AiAction = { type: 'create_transaction' | 'create_debt' | 'update_settings' | 'upsert_budget' | 'create_goal' | 'contribute_goal' | 'settle_debt'; parameters: Record<string, unknown>; summary: string };

const permitted = new Set<AiAction['type']>(['create_transaction', 'create_debt', 'update_settings', 'upsert_budget', 'create_goal', 'contribute_goal', 'settle_debt']);

export const sanitizeAiActions = (value: unknown): AiAction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && permitted.has(item.type))
    .map((item: any) => {
      // If AI forgot to nest parameters, assume root properties (except type/summary) are parameters
      let parameters = item.parameters;
      if (!parameters || typeof parameters !== 'object') {
        const { type, summary, ...rest } = item;
        parameters = rest;
      }
      return {
        type: item.type,
        parameters: parameters || {},
        summary: typeof item.summary === 'string' ? item.summary : `Proposed action: ${item.type}`
      };
    });
};

export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');
  
  const results: unknown[] = [];
  
  for (const action of safe) {
    const p: any = action.parameters;
    
    if (action.type === 'create_transaction') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.reimbursable_amount !== undefined) p.reimbursable_amount = Number(p.reimbursable_amount);
      
      if (!Number.isFinite(p.amount) || !['Income', 'Expense', 'Transfer', 'Debt Repayment'].includes(p.type) || !['Bank', 'Cash'].includes(p.source_wallet) || !p.category) {
        throw new Error(`Transaction proposal is missing required fields. Amount: ${p.amount}, Type: ${p.type}, Wallet: ${p.source_wallet}, Category: ${p.category}`);
      }
      results.push(await transactionService.createTransaction(userId, p));
    }
    
    if (action.type === 'create_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      
      if (!Number.isFinite(p.amount) || !p.contact || !['Receivable', 'Payable'].includes(p.type)) {
        throw new Error(`Debt proposal is missing required fields. Amount: ${p.amount}, Contact: ${p.contact}, Type: ${p.type}`);
      }
      results.push(await debtService.processDebt(userId, p));
    }
    
    if (action.type === 'update_settings') {
      if (p.payday !== undefined) p.payday = Number(p.payday);
      if (p.emergencyBuffer !== undefined) p.emergencyBuffer = Number(p.emergencyBuffer);
      if (p.salary !== undefined) p.salary = Number(p.salary);
      
      if (p.payday === undefined && p.emergencyBuffer === undefined && p.salary === undefined) {
        throw new Error('Settings proposal has no changes');
      }
      results.push(await settingsService.updateSettings(userId, p));
    }

    if (action.type === 'upsert_budget') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.year !== undefined) p.year = Number(p.year);
      if (p.month !== undefined) p.month = Number(p.month);
      
      if (!Number.isFinite(p.amount) || !Number.isFinite(p.year) || !Number.isFinite(p.month) || !p.category) {
        throw new Error('Budget proposal is missing required fields.');
      }
      results.push(await categoryBudgetService.upsertBudget(userId, p));
    }

    if (action.type === 'create_goal') {
      if (p.targetAmount !== undefined) p.targetAmount = Number(p.targetAmount);
      if (!p.name || !Number.isFinite(p.targetAmount)) {
        throw new Error('Goal proposal is missing required fields (name, targetAmount).');
      }
      results.push(await goalService.createGoal(userId, p));
    }
    
    if (action.type === 'contribute_goal') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.goalId || !Number.isFinite(p.amount)) {
        throw new Error('Contribute to goal proposal is missing required fields (goalId, amount).');
      }
      results.push(await goalService.contributeToGoal(userId, String(p.goalId), p.amount));
    }
    
    if (action.type === 'settle_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.debtId || !Number.isFinite(p.amount) || !['Bank', 'Cash'].includes(p.sourceWallet)) {
        throw new Error('Settle debt proposal is missing required fields (debtId, amount, sourceWallet).');
      }
      results.push(await debtService.processDebt(userId, {
        debt_id: String(p.debtId),
        amount: p.amount,
        wallet: p.sourceWallet as 'Bank' | 'Cash',
      }));
    }

  }
  
  return results;
}
