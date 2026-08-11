import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';

export type AiAction = { type: 'create_transaction' | 'create_debt' | 'update_settings'; parameters: Record<string, unknown>; summary: string };
const permitted = new Set<AiAction['type']>(['create_transaction', 'create_debt', 'update_settings']);

export const sanitizeAiActions = (value: unknown): AiAction[] => Array.isArray(value) ? value.filter((item: any) => item && permitted.has(item.type) && item.parameters && typeof item.summary === 'string').map((item: any) => ({ type: item.type, parameters: item.parameters, summary: item.summary })) : [];

export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');
  const results: unknown[] = [];
  for (const action of safe) {
    const p: any = action.parameters;
    if (action.type === 'create_transaction') {
      if (!Number.isFinite(p.amount) || !['Income', 'Expense', 'Transfer'].includes(p.type) || !['Bank', 'Cash'].includes(p.source_wallet) || !p.category) throw new Error('Transaction proposal is missing required fields');
      results.push(await transactionService.createTransaction(userId, p));
    }
    if (action.type === 'create_debt') {
      if (!Number.isFinite(p.amount) || !p.contact || !['Receivable', 'Payable'].includes(p.type)) throw new Error('Debt proposal is missing required fields');
      results.push(await debtService.processDebt(userId, p));
    }
    if (action.type === 'update_settings') {
      if (p.payday === undefined && p.emergencyBuffer === undefined) throw new Error('Settings proposal has no changes');
      results.push(await settingsService.updateSettings(userId, p));
    }
  }
  return results;
}
