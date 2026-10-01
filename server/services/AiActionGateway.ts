import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { goalService } from './GoalService.js';
import { userRepository } from '../repositories/UserRepository.js';

export type AiAction = {
  type:
    | 'create_transaction'
    | 'create_debt'
    | 'update_settings'
    | 'upsert_budget'
    | 'settle_debt'
    | 'create_goal'
    | 'contribute_goal';
  parameters: Record<string, unknown>;
  summary: string;
};

const permitted = new Set<AiAction['type']>([
  'create_transaction',
  'create_debt',
  'update_settings',
  'upsert_budget',
  'settle_debt',
  'create_goal',
  'contribute_goal',
]);

export const sanitizeAiActions = (value: unknown): AiAction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item: any) => item && permitted.has(item.type))
    .map((item: any) => {
      let parameters = item.parameters;
      if (!parameters || typeof parameters !== 'object') {
        const { type, summary, ...rest } = item;
        parameters = rest;
      }
      return {
        type: item.type,
        parameters: parameters || {},
        summary: typeof item.summary === 'string' ? item.summary : `Proposed action: ${item.type}`,
      };
    });
};

export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');

  const results: unknown[] = [];
  const dbUser = await userRepository.findById(userId);
  if (!dbUser) throw new Error('Authenticated user was not found.');

  for (const action of safe) {
    const p: any = action.parameters;

    if (action.type === 'create_transaction') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.reimbursable_amount !== undefined) p.reimbursable_amount = Number(p.reimbursable_amount);

      if (!Number.isFinite(p.amount) || !['Income', 'Expense', 'Transfer', 'Debt Repayment'].includes(p.type) || !p.walletId || !p.category) {
        throw new Error(`Transaction proposal is missing required fields. Amount: ${p.amount}, Type: ${p.type}, Wallet: ${p.walletId}, Category: ${p.category}`);
      }
      results.push(await transactionService.createTransaction(userId, p));
    }

    if (action.type === 'create_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);

      if (!Number.isFinite(p.amount) || !p.contact || !['Receivable', 'Payable'].includes(p.type)) {
        throw new Error(`Debt proposal is missing required fields. Amount: ${p.amount}, Contact: ${p.contact}, Type: ${p.type}`);
      }
      results.push(await debtService.createDebt(userId, p));
    }

    if (action.type === 'settle_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);

      if (!p.debt_id || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new Error(`Debt settlement requires debt_id and a positive amount.`);
      }
      results.push(await debtService.settleDebt(userId, p.debt_id, p.amount, p.category, p.walletId));
    }

    if (action.type === 'update_settings') {
      if (p.emergencyBuffer !== undefined) p.emergencyBuffer = Number(p.emergencyBuffer);
      if (p.payday !== undefined) p.payday = Number(p.payday);
      if (p.salary !== undefined) p.salary = Number(p.salary);

      results.push(await settingsService.updateSettings(userId, p));
    }

    if (action.type === 'upsert_budget') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.year !== undefined) p.year = Number(p.year);
      if (p.month !== undefined) p.month = Number(p.month);

      if (!p.category || !Number.isFinite(p.amount) || !Number.isFinite(p.year) || !Number.isFinite(p.month)) {
        throw new Error(`Budget proposal requires category, year, month, and numeric amount.`);
      }
      results.push(await categoryBudgetService.saveCategoryBudget(userId, {
        category: p.category,
        year: p.year,
        month: p.month,
        amount: p.amount,
      }));
    }

    if (action.type === 'create_goal') {
      if (p.targetAmount !== undefined) p.targetAmount = Number(p.targetAmount);
      if (!p.name || !Number.isFinite(p.targetAmount) || p.targetAmount <= 0) {
        throw new Error('Goal proposal requires a name and a positive targetAmount.');
      }
      results.push(await goalService.createGoal(userId, {
        name: p.name,
        targetAmount: p.targetAmount,
        targetDate: p.targetDate || null,
        walletId: p.walletId || null,
      }));
    }

    if (action.type === 'contribute_goal') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.goalId || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new Error('Goal contribution requires goalId and a positive amount.');
      }
      results.push(await goalService.contributeToGoal(String(p.goalId), userId, {
        amount: p.amount,
        walletId: p.walletId ? String(p.walletId) : undefined,
        destinationWalletId: p.destinationWalletId ? String(p.destinationWalletId) : undefined,
        note: p.note ? String(p.note) : undefined,
      }));
    }
  }

  return results;
}
