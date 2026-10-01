import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { goalService } from './GoalService.js';
import { financialPlanService } from './FinancialPlanService.js';
import { financialSnapshotService } from './FinancialSnapshotService.js';
import { investmentService } from './InvestmentService.js';
import { userRepository } from '../repositories/UserRepository.js';

export type AiAction = { type: 'create_transaction' | 'create_debt' | 'update_settings' | 'upsert_budget' | 'settle_debt' | 'create_goal' | 'contribute_goal' | 'create_financial_plan_draft' | 'approve_financial_plan' | 'update_financial_profile' | 'create_investment_account' | 'create_investment_event' | 'record_manual_price' | 'create_decision_scenario'; parameters: Record<string, unknown>; summary: string };

const permitted = new Set<AiAction['type']>(['create_transaction', 'create_debt', 'update_settings', 'upsert_budget', 'settle_debt', 'create_goal', 'contribute_goal', 'create_financial_plan_draft', 'approve_financial_plan', 'update_financial_profile', 'create_investment_account', 'create_investment_event', 'record_manual_price', 'create_decision_scenario']);

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
      results.push(await debtService.processDebt(userId, p));
    }
    
    if (action.type === 'update_settings') {
      if (p.payday !== undefined) p.payday = Number(p.payday);
      if (p.salary !== undefined) p.salary = Number(p.salary);
      
      if (p.payday === undefined && p.salary === undefined) {
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

    if (action.type === 'settle_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.debtId || !Number.isFinite(p.amount) || !p.walletId) {
        throw new Error('Settle debt proposal is missing required fields (debtId, amount, wallet).');
      }
      results.push(await debtService.processDebt(userId, {
        debt_id: String(p.debtId),
        amount: p.amount,
        walletId: String(p.walletId),
      }));
    }

    if (action.type === 'create_goal') {
      if (p.targetAmount !== undefined) p.targetAmount = Number(p.targetAmount);
      if (p.currentAmount !== undefined) p.currentAmount = Number(p.currentAmount);
      if (!p.name || !Number.isFinite(p.targetAmount) || p.targetAmount <= 0) {
        throw new Error('Goal proposal is missing required fields (name, targetAmount).');
      }
      results.push(await goalService.createGoal(userId, {
        name: String(p.name),
        targetAmount: p.targetAmount,
        currentAmount: p.currentAmount,
        walletId: p.walletId ? String(p.walletId) : undefined,
        autoSyncBalance: p.autoSyncBalance !== undefined ? Boolean(p.autoSyncBalance) : undefined,
        deadline: p.deadline ? String(p.deadline) : undefined,
        category: p.category ? String(p.category) : undefined,
        notes: p.notes ? String(p.notes) : undefined,
      }));
    }

    if (action.type === 'contribute_goal') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.goalId || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new Error('Contribute goal proposal is missing required fields (goalId, amount).');
      }
      results.push(await goalService.contributeToGoal(String(p.goalId), userId, {
        amount: p.amount,
        walletId: p.walletId ? String(p.walletId) : undefined,
        destinationWalletId: p.destinationWalletId ? String(p.destinationWalletId) : undefined,
        note: p.note ? String(p.note) : undefined,
      }));
    }

    if (action.type === 'create_financial_plan_draft') {
      if (p.incomeAmount !== undefined) p.incomeAmount = Number(p.incomeAmount);
      if (!Number.isFinite(p.incomeAmount) || p.incomeAmount <= 0) throw new Error('Salary-plan proposal requires a positive incomeAmount.');
      results.push(await financialPlanService.createDraft(dbUser, {
        incomeAmount: p.incomeAmount,
        payrollId: p.payrollId ? String(p.payrollId) : undefined,
        sourceTransactionId: p.sourceTransactionId ? String(p.sourceTransactionId) : undefined,
      }));
    }

    if (action.type === 'approve_financial_plan') {
      if (!p.planId || !Array.isArray(p.allocationIds)) throw new Error('Plan approval requires a planId and allocationIds.');
      results.push(await financialPlanService.approve(userId, String(p.planId), p.allocationIds.map(String), p.sourceWalletId ? String(p.sourceWalletId) : undefined,
        Array.isArray(p.confirmWarnings) ? p.confirmWarnings.map(String) : []));
    }

    if (action.type === 'update_financial_profile') {
      const allowed = ['baseCurrency', 'incomeFrequency', 'incomeStability', 'strategy', 'riskPreference', 'investmentExperience', 'investmentHorizon', 'emergencyTargetMonths', 'minimumUnallocatedAmount', 'minimumUnallocatedPercent', 'allowCashEquivalentReserve'];
      const patch = Object.fromEntries(Object.entries(p).filter(([key]) => allowed.includes(key)));
      if (!Object.keys(patch).length) throw new Error('Financial-profile proposal has no supported changes.');
      results.push(await financialSnapshotService.updateProfile(userId, patch));
    }

    if (action.type === 'create_investment_account') {
      if (!p.name || !p.type || !p.liquidity) throw new Error('Investment-account proposal requires name, type, and liquidity.');
      results.push(await investmentService.createAccount(userId, {
        name: String(p.name), institution: p.institution ? String(p.institution) : null,
        type: p.type as any, baseCurrency: p.baseCurrency ? String(p.baseCurrency) : 'MAD', liquidity: p.liquidity as any,
        includeInNetWorth: p.includeInNetWorth !== false, includeInEmergencyReserve: p.includeInEmergencyReserve === true,
      }));
    }

    if (action.type === 'create_investment_event') {
      if (p.grossAmount !== undefined) p.grossAmount = Number(p.grossAmount);
      if (p.units !== undefined) p.units = Number(p.units);
      if (p.unitPrice !== undefined) p.unitPrice = Number(p.unitPrice);
      if (p.feeAmount !== undefined) p.feeAmount = Number(p.feeAmount);
      if (!p.investmentAccountId || !p.type || !Number.isFinite(p.grossAmount)) throw new Error('Investment-event proposal requires account, type, and grossAmount.');
      results.push(await investmentService.createEvent(userId, {
        investmentAccountId: String(p.investmentAccountId), assetId: p.assetId ? String(p.assetId) : null, type: p.type as any,
        tradeDate: p.tradeDate ? String(p.tradeDate) : undefined, units: p.units, unitPrice: p.unitPrice,
        quoteCurrency: p.quoteCurrency ? String(p.quoteCurrency) : undefined, grossAmount: p.grossAmount, feeAmount: p.feeAmount,
        feeCurrency: p.feeCurrency ? String(p.feeCurrency) : undefined, exchangeRateToBase: p.exchangeRateToBase === undefined ? undefined : Number(p.exchangeRateToBase),
        notes: p.notes ? String(p.notes) : undefined,
      }));
    }

    if (action.type === 'record_manual_price') {
      if (p.price !== undefined) p.price = Number(p.price);
      if (!p.assetId || !Number.isFinite(p.price) || p.price < 0) throw new Error('Manual-price proposal requires assetId and a non-negative price.');
      results.push(await investmentService.recordManualPrice(userId, String(p.assetId), p.price, p.currency ? String(p.currency) : 'MAD', p.capturedAt ? String(p.capturedAt) : undefined));
    }

    if (action.type === 'create_decision_scenario') {
      // Scenarios are deliberately non-mutating. Approval only validates and
      // returns the structured setup for the Decision Lab to display.
      if (!p.type || !Number.isFinite(Number(p.amount))) throw new Error('Decision scenario requires a type and numeric amount.');
      results.push({ scenario: { type: String(p.type), amount: Number(p.amount), label: p.label ? String(p.label) : undefined }, mutatesLiveData: false });
    }
  }
  
  return results;
}
