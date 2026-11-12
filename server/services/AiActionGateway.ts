import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { users } from '../../src/db/schema.js';
import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { goalService } from './GoalService.js';
import { investmentService } from './InvestmentService.js';
import { walletService } from './WalletService.js';
import { payrollService } from './PayrollService.js';
import { KpiService } from './KpiService.js';

const kpiService = new KpiService();

export type AiAction = {
  type:
    | 'create_transaction'
    | 'create_debt'
    | 'update_settings'
    | 'upsert_budget'
    | 'settle_debt'
    | 'create_goal'
    | 'contribute_goal'
    | 'buy_stock'
    | 'record_dividend'
    | 'confirm_payroll';
  parameters: Record<string, unknown>;
  summary: string;
};

export interface AiActionSimulationResult {
  actionSummary: string;
  actionType: AiAction['type'];
  beforeSafeToSpendMad: number;
  afterSafeToSpendMad: number;
  safeToSpendDeltaMad: number;
  beforeDailyAllowanceMad: number;
  afterDailyAllowanceMad: number;
  sourceWalletName?: string;
  beforeWalletBalanceMad?: number;
  afterWalletBalanceMad?: number;
  emergencyBufferBreached: boolean;
  warnings: string[];
}

const permitted = new Set<AiAction['type']>([
  'create_transaction',
  'create_debt',
  'update_settings',
  'upsert_budget',
  'settle_debt',
  'create_goal',
  'contribute_goal',
  'buy_stock',
  'record_dividend',
  'confirm_payroll',
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

/**
 * Audit Item P: Pre-execution simulation for SPEX actions.
 * Evaluates the impact of proposed actions on Safe-to-Spend, wallet balances, reserves,
 * and payday runway without mutating or reserving funds.
 */
export async function simulateAiActionsImpact(
  userId: string,
  actions: AiAction[]
): Promise<{
  baselineSafeToSpendMad: number;
  projectedSafeToSpendMad: number;
  netCashImpactMad: number;
  daysUntilPayday: number;
  emergencyBufferMad: number;
  simulations: AiActionSimulationResult[];
}> {
  const safe = sanitizeAiActions(actions);
  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) {
    throw new Error('User not found for action simulation');
  }

  const kpis = await kpiService.getKpisForUser(userRow);
  const baselineSafeToSpend = Number(kpis.safeToSpend || 0);
  const daysUntilPayday = Math.max(1, Number(kpis.daysUntilPayday || 1));
  const emergencyBuffer = Number(userRow.emergencyBuffer || 0);
  const accounts = (kpis.accounts || []) as Array<{ id: string; name: string; balance: number; type: string }>;

  let runningSafeToSpend = baselineSafeToSpend;
  const simulations: AiActionSimulationResult[] = [];

  for (const action of safe) {
    const p: any = action.parameters || {};
    const amt = Math.abs(Number(p.amount ?? p.totalNativeAmount ?? p.targetAmount ?? 0));
    const beforeSts = runningSafeToSpend;
    let deltaSts = 0;
    const warnings: string[] = [];

    const matchedWallet = accounts.find(
      (a) => a.id === p.walletId || a.name.toLowerCase() === String(p.walletId || '').toLowerCase()
    );
    const beforeWalletBal = matchedWallet?.balance;
    let afterWalletBal = beforeWalletBal;

    if (action.type === 'create_transaction') {
      if (p.type === 'Expense' || p.type === 'Debt Repayment') {
        deltaSts = -amt;
        if (afterWalletBal !== undefined) afterWalletBal -= amt;
      } else if (p.type === 'Income') {
        deltaSts = amt;
        if (afterWalletBal !== undefined) afterWalletBal += amt;
      } else if (p.type === 'Transfer') {
        if (afterWalletBal !== undefined) afterWalletBal -= amt;
      }
    } else if (action.type === 'contribute_goal' || action.type === 'buy_stock') {
      const outlay =
        action.type === 'buy_stock'
          ? Number(p.shares || 0) * Number(p.pricePerShare || 100) * 9.95
          : amt;
      deltaSts = -outlay;
      if (afterWalletBal !== undefined) afterWalletBal -= outlay;
    } else if (action.type === 'settle_debt') {
      deltaSts = -amt;
      if (afterWalletBal !== undefined) afterWalletBal -= amt;
    } else if (action.type === 'confirm_payroll' || action.type === 'record_dividend') {
      deltaSts = amt;
      if (afterWalletBal !== undefined) afterWalletBal += amt;
    }

    const afterSts = beforeSts + deltaSts;
    runningSafeToSpend = afterSts;

    if (afterSts < 0) {
      warnings.push(
        `This action reduces Safe-to-Spend below zero (${afterSts.toFixed(0)} MAD) and dips into your protected reserve.`
      );
    }
    if (afterWalletBal !== undefined && afterWalletBal < 0) {
      warnings.push(
        `Source account "${matchedWallet?.name}" would go negative (${afterWalletBal.toFixed(0)} MAD).`
      );
    }
    if (deltaSts < 0 && Math.abs(deltaSts) > beforeSts * 0.5 && beforeSts > 0) {
      warnings.push(
        `Consumes ${Math.round((Math.abs(deltaSts) / beforeSts) * 100)}% of your remaining Safe-to-Spend for this payday cycle.`
      );
    }

    simulations.push({
      actionSummary: action.summary,
      actionType: action.type,
      beforeSafeToSpendMad: Number(beforeSts.toFixed(2)),
      afterSafeToSpendMad: Number(afterSts.toFixed(2)),
      safeToSpendDeltaMad: Number(deltaSts.toFixed(2)),
      beforeDailyAllowanceMad: Number((Math.max(0, beforeSts) / daysUntilPayday).toFixed(2)),
      afterDailyAllowanceMad: Number((Math.max(0, afterSts) / daysUntilPayday).toFixed(2)),
      sourceWalletName: matchedWallet?.name,
      beforeWalletBalanceMad:
        beforeWalletBal !== undefined ? Number(beforeWalletBal.toFixed(2)) : undefined,
      afterWalletBalanceMad:
        afterWalletBal !== undefined ? Number(afterWalletBal.toFixed(2)) : undefined,
      emergencyBufferBreached: afterSts < 0,
      warnings,
    });
  }

  return {
    baselineSafeToSpendMad: Number(baselineSafeToSpend.toFixed(2)),
    projectedSafeToSpendMad: Number(runningSafeToSpend.toFixed(2)),
    netCashImpactMad: Number((runningSafeToSpend - baselineSafeToSpend).toFixed(2)),
    daysUntilPayday,
    emergencyBufferMad: emergencyBuffer,
    simulations,
  };
}

export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');

  const results: unknown[] = [];

  for (const action of safe) {
    const p: any = action.parameters;

    if (action.type === 'create_transaction') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.reimbursable_amount !== undefined) p.reimbursable_amount = Number(p.reimbursable_amount);

      if (
        !Number.isFinite(p.amount) ||
        !['Income', 'Expense', 'Transfer', 'Debt Repayment'].includes(p.type) ||
        !p.walletId ||
        !p.category
      ) {
        throw new Error(
          `Transaction proposal is missing required fields. Amount: ${p.amount}, Type: ${p.type}, Wallet: ${p.walletId}, Category: ${p.category}`
        );
      }
      results.push(await transactionService.createTransaction(userId, p));
    }

    if (action.type === 'create_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);

      if (!Number.isFinite(p.amount) || !p.contact || !['Receivable', 'Payable'].includes(p.type)) {
        throw new Error(
          `Debt proposal is missing required fields. Amount: ${p.amount}, Contact: ${p.contact}, Type: ${p.type}`
        );
      }
      results.push(await debtService.processDebt(userId, p));
    }

    if (action.type === 'update_settings') {
      if (p.payday !== undefined) p.payday = Number(p.payday);
      if (p.salary !== undefined) p.salary = Number(p.salary);
      if (p.emergencyBuffer !== undefined && p.emergency_buffer === undefined) {
        p.emergency_buffer = Number(p.emergencyBuffer);
      } else if (p.emergency_buffer !== undefined) {
        p.emergency_buffer = Number(p.emergency_buffer);
      }

      const targetPrimaryWalletId = p.primaryWalletId || p.mainWalletId || p.walletId;
      let updatedPrimary = false;
      if (targetPrimaryWalletId) {
        results.push(
          await walletService.updateWallet(userId, String(targetPrimaryWalletId), {
            isMain: true,
          })
        );
        updatedPrimary = true;
      }

      if (p.payday !== undefined || p.salary !== undefined || p.emergency_buffer !== undefined) {
        results.push(await settingsService.updateSettings(userId, p));
      } else if (!updatedPrimary) {
        throw new Error('Settings proposal has no changes');
      }
    }

    if (action.type === 'upsert_budget') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (p.year !== undefined) p.year = Number(p.year);
      if (p.month !== undefined) p.month = Number(p.month);

      if (
        !Number.isFinite(p.amount) ||
        !Number.isFinite(p.year) ||
        !Number.isFinite(p.month) ||
        !p.category
      ) {
        throw new Error('Budget proposal is missing required fields.');
      }
      results.push(await categoryBudgetService.upsertBudget(userId, p));
    }

    if (action.type === 'settle_debt') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.debtId || !Number.isFinite(p.amount) || !p.walletId) {
        throw new Error('Settle debt proposal is missing required fields (debtId, amount, wallet).');
      }
      results.push(
        await debtService.processDebt(userId, {
          debt_id: String(p.debtId),
          amount: p.amount,
          walletId: String(p.walletId),
        })
      );
    }

    if (action.type === 'create_goal') {
      if (p.targetAmount !== undefined) p.targetAmount = Number(p.targetAmount);
      if (p.currentAmount !== undefined) p.currentAmount = Number(p.currentAmount);
      if (!p.name || !Number.isFinite(p.targetAmount) || p.targetAmount <= 0) {
        throw new Error('Goal proposal is missing required fields (name, targetAmount).');
      }
      results.push(
        await goalService.createGoal(userId, {
          name: String(p.name),
          targetAmount: p.targetAmount,
          currentAmount: p.currentAmount,
          walletId: p.walletId ? String(p.walletId) : undefined,
          autoSyncBalance: p.autoSyncBalance !== undefined ? Boolean(p.autoSyncBalance) : undefined,
          deadline: p.deadline ? String(p.deadline) : undefined,
          category: p.category ? String(p.category) : undefined,
          notes: p.notes ? String(p.notes) : undefined,
        })
      );
    }

    if (action.type === 'contribute_goal') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.goalId || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new Error('Contribute goal proposal is missing required fields (goalId, amount).');
      }
      results.push(
        await goalService.contributeToGoal(String(p.goalId), userId, {
          amount: p.amount,
          walletId: p.walletId ? String(p.walletId) : undefined,
          destinationWalletId: p.destinationWalletId ? String(p.destinationWalletId) : undefined,
          note: p.note ? String(p.note) : undefined,
        })
      );
    }

    if (action.type === 'buy_stock') {
      const ticker = String(p.ticker || '').toUpperCase().trim();
      const shares = Number(p.shares || 0);
      const pricePerShare = p.pricePerShare !== undefined ? Number(p.pricePerShare) : undefined;
      if (!ticker || shares <= 0) {
        throw new Error('Stock buy proposal requires ticker and positive shares.');
      }
      results.push(
        await investmentService.executeOrder(userId, {
          ticker,
          action: 'BUY',
          shares,
          pricePerShare,
          walletId: p.walletId ? String(p.walletId) : undefined,
          syncWithWallet: Boolean(p.walletId),
          notes: p.notes ? String(p.notes) : `AI-assisted purchase of ${shares} ${ticker}`,
        })
      );
    }

    if (action.type === 'record_dividend') {
      const ticker = String(p.ticker || '').toUpperCase().trim();
      const totalNativeAmount = Number(p.amount || p.totalNativeAmount || 0);
      if (!ticker || totalNativeAmount <= 0) {
        throw new Error('Dividend proposal requires ticker and positive amount.');
      }
      results.push(
        await investmentService.executeOrder(userId, {
          ticker,
          action: 'DIVIDEND',
          totalNativeAmount,
          walletId: p.walletId ? String(p.walletId) : undefined,
          syncWithWallet: Boolean(p.walletId),
          notes: p.notes ? String(p.notes) : `Dividend payout from ${ticker}`,
        })
      );
    }

    if (action.type === 'confirm_payroll') {
      const payrollId = String(p.payrollId || '').trim();
      if (!payrollId) {
        throw new Error('Confirm payroll proposal requires payrollId.');
      }
      results.push(
        await payrollService.confirmPayrollReceipt(userId, payrollId, {
          confirmedAmount: p.confirmedAmount !== undefined ? Number(p.confirmedAmount) : undefined,
          confirmedDate: p.confirmedDate ? String(p.confirmedDate) : undefined,
          walletId: p.walletId ? String(p.walletId) : undefined,
          varianceNotes: p.varianceNotes ? String(p.varianceNotes) : undefined,
        })
      );
    }
  }

  return results;
}


