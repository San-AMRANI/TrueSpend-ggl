import { categoryBudgetService } from './CategoryBudgetService.js';
import { debtService } from './DebtService.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { settingsService } from './SettingsService.js';
import { transactionService } from './TransactionService.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';

export type AiActionType =
  | 'create_transaction'
  | 'update_transaction'
  | 'delete_transaction'
  | 'create_debt'
  | 'update_debt'
  | 'settle_debt'
  | 'delete_debt'
  | 'set_category_budget'
  | 'update_settings';

export type AiAction = {
  type: AiActionType;
  parameters: Record<string, unknown>;
  summary: string;
};

const permitted = new Set<AiActionType>([
  'create_transaction', 'update_transaction', 'delete_transaction',
  'create_debt', 'update_debt', 'settle_debt', 'delete_debt',
  'set_category_budget', 'update_settings',
]);

const hasOwn = (value: Record<string, unknown>, key: string) =>
  Object.prototype.hasOwnProperty.call(value, key);
const asRecord = (value: unknown) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const requiredText = (value: unknown, field: string) => {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${field} is required`);
  return value.trim();
};
const optionalText = (value: unknown, field: string) => {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== 'string') throw new Error(`${field} must be text`);
  return value.trim();
};
const requiredPositiveNumber = (value: unknown, field: string) => {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount <= 0) throw new Error(`${field} must be greater than zero`);
  return amount;
};
const optionalNumber = (value: unknown, field: string) => {
  if (value === undefined || value === null) return undefined;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${field} must be a number`);
  return number;
};
const optionalDate = (value: unknown, field: string) => {
  if (value === undefined || value === null || value === '') return undefined;
  const date = requiredText(value, field);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`${field} must use YYYY-MM-DD`);
  const parsed = new Date(`${date}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) throw new Error(`${field} must be a valid date`);
  return date;
};
const actionId = (value: unknown, field: string) => {
  const id = requiredText(value, field);
  if (id.length > 100) throw new Error(`${field} is invalid`);
  return id;
};

/** Removes unrecognised operation types before an action is stored for approval. */
export const sanitizeAiActions = (value: unknown): AiAction[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap((item): AiAction[] => {
    const candidate = asRecord(item);
    if (!candidate || typeof candidate.type !== 'string' || !permitted.has(candidate.type as AiActionType)) return [];
    const suppliedParameters = asRecord(candidate.parameters);
    const { type, summary, parameters: _parameters, ...flatParameters } = candidate;
    return [{
      type: type as AiActionType,
      parameters: suppliedParameters || flatParameters,
      summary: typeof summary === 'string' && summary.trim()
        ? summary.trim().slice(0, 240)
        : `Proposed ${type.replace(/_/g, ' ')}`,
    }];
  });
};

async function prepareAction(userId: string, action: AiAction) {
  const p = asRecord(action.parameters);
  if (!p) throw new Error('Action parameters are invalid');

  if (action.type === 'create_transaction') {
    const amount = requiredPositiveNumber(p.amount, 'amount');
    const type = requiredText(p.type, 'type');
    const source_wallet = requiredText(p.source_wallet, 'source_wallet');
    const category = requiredText(p.category, 'category');
    if (!['Income', 'Expense', 'Transfer', 'Debt Repayment'].includes(type)) throw new Error('Transaction type is invalid');
    if (!['Bank', 'Cash'].includes(source_wallet)) throw new Error('Transaction wallet is invalid');
    const reimbursable_amount = optionalNumber(p.reimbursable_amount, 'reimbursable_amount');
    if (reimbursable_amount !== undefined && (reimbursable_amount < 0 || reimbursable_amount > amount)) throw new Error('reimbursable_amount must be between zero and the transaction amount');
    const linked_contact_name = optionalText(p.linked_contact_name, 'linked_contact_name');
    if (reimbursable_amount && !linked_contact_name) throw new Error('linked_contact_name is required for a reimbursable transaction');
    const notes = optionalText(p.notes, 'notes');
    const transaction_date = optionalDate(p.transaction_date, 'transaction_date');
    return { ...action, parameters: { amount, type, source_wallet, category, ...(notes !== undefined ? { notes } : {}), ...(transaction_date ? { transaction_date } : {}), ...(reimbursable_amount !== undefined ? { reimbursable_amount } : {}), ...(linked_contact_name ? { linked_contact_name } : {}) } };
  }

  if (action.type === 'update_transaction') {
    const transaction_id = actionId(p.transaction_id, 'transaction_id');
    const current = await transactionRepository.findByIdAndUserId(transaction_id, userId);
    if (!current) throw new Error('Transaction not found');
    if (!['amount', 'source_wallet', 'category', 'notes', 'transaction_date'].some((field) => hasOwn(p, field))) throw new Error('Choose at least one transaction field to update');
    const amount = hasOwn(p, 'amount') ? requiredPositiveNumber(p.amount, 'amount') : Number(current.amount);
    const source_wallet = hasOwn(p, 'source_wallet') ? requiredText(p.source_wallet, 'source_wallet') : current.sourceWallet;
    const category = hasOwn(p, 'category') ? requiredText(p.category, 'category') : (current.category || '');
    if (!['Bank', 'Cash'].includes(source_wallet)) throw new Error('Transaction wallet is invalid');
    if (!category) throw new Error('Transaction category is required');
    const notes = hasOwn(p, 'notes') ? optionalText(p.notes, 'notes') : current.notes || undefined;
    const transaction_date = hasOwn(p, 'transaction_date') ? optionalDate(p.transaction_date, 'transaction_date') : undefined;
    return { ...action, parameters: { transaction_id, amount, source_wallet, category, notes, ...(transaction_date ? { transaction_date } : {}) } };
  }

  if (action.type === 'delete_transaction') {
    const transaction_id = actionId(p.transaction_id, 'transaction_id');
    if (!await transactionRepository.findByIdAndUserId(transaction_id, userId)) throw new Error('Transaction not found');
    return { ...action, parameters: { transaction_id } };
  }

  if (action.type === 'create_debt') {
    const amount = requiredPositiveNumber(p.amount, 'amount');
    const contact = requiredText(p.contact, 'contact');
    const type = requiredText(p.type, 'type');
    if (!['Receivable', 'Payable'].includes(type)) throw new Error('Debt type is invalid');
    const due_date = optionalDate(p.due_date, 'due_date');
    return { ...action, parameters: { amount, contact, type, ...(due_date ? { due_date } : {}) } };
  }

  if (action.type === 'update_debt') {
    const debt_id = actionId(p.debt_id, 'debt_id');
    const current = await debtRepository.findByIdAndUserId(debt_id, userId);
    if (!current) throw new Error('Debt not found');
    if (!['amount', 'contact', 'type', 'due_date'].some((field) => hasOwn(p, field))) throw new Error('Choose at least one debt field to update');
    const amount = hasOwn(p, 'amount') ? requiredPositiveNumber(p.amount, 'amount') : Number(current.originalAmount);
    const contact = hasOwn(p, 'contact') ? requiredText(p.contact, 'contact') : current.contactName;
    const type = hasOwn(p, 'type') ? requiredText(p.type, 'type') : current.type;
    if (!['Receivable', 'Payable'].includes(type)) throw new Error('Debt type is invalid');
    const due_date = hasOwn(p, 'due_date') ? optionalDate(p.due_date, 'due_date') : undefined;
    return { ...action, parameters: { debt_id, amount, contact, type, ...(hasOwn(p, 'due_date') ? { due_date } : {}) } };
  }

  if (action.type === 'settle_debt') {
    const debt_id = actionId(p.debt_id, 'debt_id');
    const amount = requiredPositiveNumber(p.amount, 'amount');
    const current = await debtRepository.findByIdAndUserId(debt_id, userId);
    if (!current) throw new Error('Debt not found');
    if (amount > Number(current.remainingBalance)) throw new Error('Settlement cannot exceed the remaining debt balance');
    return { ...action, parameters: { debt_id, amount } };
  }

  if (action.type === 'delete_debt') {
    const debt_id = actionId(p.debt_id, 'debt_id');
    if (!await debtRepository.findByIdAndUserId(debt_id, userId)) throw new Error('Debt not found');
    return { ...action, parameters: { debt_id } };
  }

  if (action.type === 'set_category_budget') {
    const now = new Date();
    const category = requiredText(p.category, 'category');
    const amount = optionalNumber(p.amount, 'amount');
    const year = hasOwn(p, 'year') ? optionalNumber(p.year, 'year') : now.getFullYear();
    const month = hasOwn(p, 'month') ? optionalNumber(p.month, 'month') : now.getMonth() + 1;
    if (amount === undefined || amount < 0) throw new Error('amount must be zero or greater');
    if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error('Budget year is invalid');
    if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Budget month is invalid');
    return { ...action, parameters: { category, amount, year, month } };
  }

  if (action.type === 'update_settings') {
    const payday = optionalNumber(p.payday, 'payday');
    const emergencyBuffer = optionalNumber(p.emergencyBuffer, 'emergencyBuffer');
    if (payday === undefined && emergencyBuffer === undefined) throw new Error('Settings proposal has no changes');
    if (payday !== undefined && (!Number.isInteger(payday) || payday < 1 || payday > 31)) throw new Error('payday must be between 1 and 31');
    if (emergencyBuffer !== undefined && emergencyBuffer < 0) throw new Error('emergencyBuffer must be zero or greater');
    return { ...action, parameters: { ...(payday !== undefined ? { payday } : {}), ...(emergencyBuffer !== undefined ? { emergencyBuffer } : {}) } };
  }

  throw new Error('This action is not permitted');
}

/** Validates every action before any write starts, then runs approved writes in order. */
export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');
  const prepared = await Promise.all(safe.map((action) => prepareAction(userId, action)));
  const results: Array<{ type: AiActionType; summary: string; result: unknown }> = [];

  for (const action of prepared) {
    const p = action.parameters as Record<string, any>;
    let result: unknown;
    switch (action.type) {
      case 'create_transaction': result = await transactionService.createTransaction(userId, p); break;
      case 'update_transaction': result = await transactionService.updateTransaction(userId, p.transaction_id, p); break;
      case 'delete_transaction': result = await transactionService.deleteTransaction(userId, p.transaction_id); break;
      case 'create_debt':
      case 'settle_debt': result = await debtService.processDebt(userId, p); break;
      case 'update_debt': result = await debtService.updateDebt(userId, p.debt_id, p); break;
      case 'delete_debt': result = await debtService.deleteDebt(userId, p.debt_id); break;
      case 'set_category_budget': result = await categoryBudgetService.upsertBudget(userId, p); break;
      case 'update_settings': result = await settingsService.updateSettings(userId, p); break;
    }
    results.push({ type: action.type, summary: action.summary, result });
  }
  return results;
}
