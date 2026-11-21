import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.js';
import { users, financialContexts } from '../../src/db/schema.js';
import { transactionService } from './TransactionService.js';
import { debtService } from './DebtService.js';
import { settingsService } from './SettingsService.js';
import { categoryBudgetService } from './CategoryBudgetService.js';
import { goalService } from './GoalService.js';
import { investmentService } from './InvestmentService.js';
import { walletService } from './WalletService.js';
import { payrollService } from './PayrollService.js';
import { subscriptionService } from './SubscriptionService.js';
import { coreAuditService } from './CoreAuditService.js';
import { resolveContextStatusFromDates } from '../controllers/ContextController.js';
import { KpiService } from './KpiService.js';

const kpiService = new KpiService();

export type AiAction = {
  type:
    | 'create_transaction'
    | 'create_debt'
    | 'update_settings'
    | 'upsert_budget'
    | 'rollover_budgets'
    | 'settle_debt'
    | 'forgive_debt'
    | 'create_goal'
    | 'contribute_goal'
    | 'withdraw_goal'
    | 'buy_stock'
    | 'sell_stock'
    | 'record_dividend'
    | 'fund_investment_wallet'
    | 'confirm_payroll'
    | 'create_payroll'
    | 'create_subscription'
    | 'pay_subscription'
    | 'update_subscription'
    | 'create_wallet'
    | 'create_context'
    | 'declare_external_asset'
    | 'create_financial_rule';
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
  'rollover_budgets',
  'settle_debt',
  'forgive_debt',
  'create_goal',
  'contribute_goal',
  'withdraw_goal',
  'buy_stock',
  'sell_stock',
  'record_dividend',
  'fund_investment_wallet',
  'confirm_payroll',
  'create_payroll',
  'create_subscription',
  'pay_subscription',
  'update_subscription',
  'create_wallet',
  'create_context',
  'declare_external_asset',
  'create_financial_rule',
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
 * Pre-execution simulation for SPEX actions.
 * Evaluates the impact of proposed actions on Safe-to-Spend, wallet balances, liquidity,
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
  before: {
    safeToSpendMad: number;
    dailyAllowanceMad: number;
    totalLiquidityMad: number;
  };
  after: {
    safeToSpendMad: number;
    dailyAllowanceMad: number;
    totalLiquidityMad: number;
  };
  deltaSafeToSpendMad: number;
  deltaDailyAllowanceMad: number;
  deltaLiquidityMad: number;
  breachesEmergencyBuffer: boolean;
  warnings: string[];
  simulations: AiActionSimulationResult[];
}> {
  const safe = sanitizeAiActions(actions);
  const [userRow] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!userRow) {
    throw new Error('User not found for action simulation');
  }

  const kpis = await kpiService.getKpisForUser(userRow);
  const baselineSafeToSpend = Number(kpis.safeToSpend || 0);
  const baselineLiquidity = Number(kpis.totalLiquidity || 0);
  const daysUntilPayday = Math.max(1, Number(kpis.daysUntilPayday || 1));
  const emergencyBuffer = Number(kpis.emergencyBuffer || 0);
  const accounts = (kpis.accounts || []) as Array<{ id: string; name: string; balance: number; type: string }>;

  let runningSafeToSpend = baselineSafeToSpend;
  let runningLiquidity = baselineLiquidity;
  const simulations: AiActionSimulationResult[] = [];
  const allWarnings: string[] = [];

  for (const action of safe) {
    const p: any = action.parameters || {};
    const amt = Math.abs(
      Number(p.amount ?? p.amountMad ?? p.confirmedAmount ?? p.totalNativeAmount ?? p.estimatedValue ?? p.targetAmount ?? 0)
    );
    const beforeSts = runningSafeToSpend;
    let deltaSts = 0;
    let deltaLiq = 0;
    const warnings: string[] = [];

    const matchedWallet = accounts.find(
      (a) =>
        a.id === p.walletId ||
        a.id === p.sourceWalletId ||
        a.name.toLowerCase() === String(p.walletId || p.sourceWalletId || '').toLowerCase()
    );
    const beforeWalletBal = matchedWallet?.balance;
    let afterWalletBal = beforeWalletBal;

    if (action.type === 'create_transaction') {
      if (p.type === 'Expense' || p.type === 'Debt Repayment') {
        deltaSts = -amt;
        deltaLiq = -amt;
        if (afterWalletBal !== undefined) afterWalletBal -= amt;
      } else if (p.type === 'Income') {
        deltaSts = amt;
        deltaLiq = amt;
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
      deltaLiq = action.type === 'buy_stock' ? -outlay : 0;
      if (afterWalletBal !== undefined) afterWalletBal -= outlay;
    } else if (action.type === 'withdraw_goal') {
      deltaSts = amt;
      if (afterWalletBal !== undefined) afterWalletBal += amt;
    } else if (action.type === 'sell_stock') {
      const proceeds = Number(p.shares || 0) * Number(p.pricePerShare || 100) * 9.95;
      deltaSts = proceeds;
      deltaLiq = proceeds;
      if (afterWalletBal !== undefined) afterWalletBal += proceeds;
    } else if (action.type === 'fund_investment_wallet') {
      // Moves cash into protected Investment Reserve (reduces Safe-to-Spend, keeps total liquidity unchanged)
      deltaSts = -amt;
      if (afterWalletBal !== undefined) afterWalletBal -= amt;
    } else if (action.type === 'settle_debt') {
      deltaSts = -amt;
      deltaLiq = -amt;
      if (afterWalletBal !== undefined) afterWalletBal -= amt;
    } else if (action.type === 'pay_subscription') {
      deltaSts = -amt;
      deltaLiq = -amt;
      if (afterWalletBal !== undefined) afterWalletBal -= amt;
    } else if (action.type === 'create_subscription' && p.recordInitialPayment) {
      deltaSts = -amt;
      deltaLiq = -amt;
      if (afterWalletBal !== undefined) afterWalletBal -= amt;
    } else if (action.type === 'confirm_payroll' || action.type === 'record_dividend') {
      deltaSts = amt;
      deltaLiq = amt;
      if (afterWalletBal !== undefined) afterWalletBal += amt;
    } else if (action.type === 'create_wallet') {
      const initBal = Number(p.initialBalance || 0);
      if (initBal > 0 && p.type !== 'Investment') {
        deltaSts = initBal;
        deltaLiq = initBal;
      } else if (initBal > 0) {
        deltaLiq = initBal;
      }
    } else if (action.type === 'create_debt' && p.type === 'Payable') {
      deltaSts = -amt;
    }

    const afterSts = beforeSts + deltaSts;
    runningSafeToSpend = afterSts;
    runningLiquidity += deltaLiq;

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

    allWarnings.push(...warnings);

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

  const beforeDaily = Number((Math.max(0, baselineSafeToSpend) / daysUntilPayday).toFixed(2));
  const afterDaily = Number((Math.max(0, runningSafeToSpend) / daysUntilPayday).toFixed(2));
  const netCashImpact = Number((runningSafeToSpend - baselineSafeToSpend).toFixed(2));
  const deltaLiquidity = Number((runningLiquidity - baselineLiquidity).toFixed(2));

  return {
    baselineSafeToSpendMad: Number(baselineSafeToSpend.toFixed(2)),
    projectedSafeToSpendMad: Number(runningSafeToSpend.toFixed(2)),
    netCashImpactMad: netCashImpact,
    daysUntilPayday,
    emergencyBufferMad: emergencyBuffer,
    before: {
      safeToSpendMad: Number(baselineSafeToSpend.toFixed(2)),
      dailyAllowanceMad: beforeDaily,
      totalLiquidityMad: Number(baselineLiquidity.toFixed(2)),
    },
    after: {
      safeToSpendMad: Number(runningSafeToSpend.toFixed(2)),
      dailyAllowanceMad: afterDaily,
      totalLiquidityMad: Number(runningLiquidity.toFixed(2)),
    },
    deltaSafeToSpendMad: netCashImpact,
    deltaDailyAllowanceMad: Number((afterDaily - beforeDaily).toFixed(2)),
    deltaLiquidityMad: deltaLiquidity,
    breachesEmergencyBuffer: runningSafeToSpend < 0,
    warnings: Array.from(new Set(allWarnings)),
    simulations,
  };
}

export async function executeApprovedAiActions(userId: string, actions: AiAction[]) {
  const safe = sanitizeAiActions(actions);
  if (!safe.length) throw new Error('No valid actions to approve');

  const results: unknown[] = [];

  for (const action of safe) {
    const p: any = { ...(action.parameters || {}) };

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

      if (
        p.payday !== undefined ||
        p.salary !== undefined ||
        p.emergency_buffer !== undefined ||
        p.employmentType !== undefined ||
        p.financialCycleMode !== undefined ||
        p.baseCurrency !== undefined
      ) {
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

    if (action.type === 'rollover_budgets') {
      const now = new Date();
      const year = Number(p.year || now.getFullYear());
      const month = Number(p.month || now.getMonth() + 1);
      results.push(await categoryBudgetService.copyPreviousMonth(userId, year, month));
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

    if (action.type === 'forgive_debt') {
      const debtId = String(p.debtId || '').trim();
      if (!debtId) {
        throw new Error('Forgive debt proposal requires debtId.');
      }
      results.push(
        await debtService.forgiveDebt(userId, debtId, {
          amount: p.amount !== undefined ? Number(p.amount) : undefined,
          reason: p.reason ? String(p.reason) : 'Forgiven / Waived',
          note: p.note ? String(p.note) : undefined,
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

    if (action.type === 'withdraw_goal') {
      if (p.amount !== undefined) p.amount = Number(p.amount);
      if (!p.goalId || !Number.isFinite(p.amount) || p.amount <= 0) {
        throw new Error('Withdraw goal proposal requires goalId and positive amount.');
      }
      results.push(
        await goalService.withdrawFromGoal(String(p.goalId), userId, {
          amount: p.amount,
          walletId: p.walletId ? String(p.walletId) : undefined,
          note: p.note ? String(p.note) : undefined,
          date: p.date ? String(p.date) : undefined,
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

    if (action.type === 'sell_stock') {
      const ticker = String(p.ticker || '').toUpperCase().trim();
      const positionId = p.positionId ? String(p.positionId) : undefined;
      const shares = Number(p.shares || 0);
      const pricePerShare = p.pricePerShare !== undefined ? Number(p.pricePerShare) : undefined;
      if ((!ticker && !positionId) || shares <= 0) {
        throw new Error('Stock sell proposal requires ticker (or positionId) and positive shares.');
      }
      results.push(
        await investmentService.executeOrder(userId, {
          positionId,
          ticker,
          action: 'SELL',
          shares,
          pricePerShare,
          walletId: p.walletId ? String(p.walletId) : undefined,
          syncWithWallet: Boolean(p.walletId),
          notes: p.notes ? String(p.notes) : `AI-assisted sale of ${shares} ${ticker || 'shares'}`,
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

    if (action.type === 'fund_investment_wallet') {
      const amountMad = Number(p.amountMad ?? p.amount ?? 0);
      if (!Number.isFinite(amountMad) || amountMad <= 0) {
        throw new Error('Fund investment wallet proposal requires positive amountMad.');
      }
      results.push(
        await investmentService.fundInvestmentWallet(userId, {
          sourceWalletId: p.sourceWalletId ? String(p.sourceWalletId) : undefined,
          destinationWalletId: p.destinationWalletId ? String(p.destinationWalletId) : undefined,
          amountMad,
          notes: p.notes ? String(p.notes) : undefined,
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

    if (action.type === 'create_payroll') {
      const scheduledFor = String(p.scheduledFor || p.date || '').trim();
      const amount = Number(p.amount || 0);
      if (!scheduledFor || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Create payroll proposal requires scheduledFor (YYYY-MM-DD) and positive amount.');
      }
      results.push(
        await payrollService.createPayroll(userId, {
          scheduledFor,
          amount,
          walletId: p.walletId ? String(p.walletId) : undefined,
        })
      );
    }

    if (action.type === 'create_subscription') {
      const name = String(p.name || '').trim();
      const amount = Number(p.amount || 0);
      if (!name || !Number.isFinite(amount) || amount <= 0) {
        throw new Error('Subscription proposal requires name and positive amount.');
      }
      results.push(
        await subscriptionService.createSubscription(userId, {
          name,
          amount,
          currency: p.currency ? String(p.currency) : 'MAD',
          billingCycle: p.billingCycle ? String(p.billingCycle) : 'monthly',
          category: p.category ? String(p.category) : '📱 Telecom & Subscriptions',
          walletId: p.walletId ? String(p.walletId) : null,
          nextBillingDate: p.nextBillingDate ? String(p.nextBillingDate) : null,
          status: p.status || 'active',
          notes: p.notes ? String(p.notes) : undefined,
          icon: p.icon ? String(p.icon) : undefined,
          recordInitialPayment: Boolean(p.recordInitialPayment),
          initialPaymentDate: p.initialPaymentDate ? String(p.initialPaymentDate) : undefined,
        })
      );
    }

    if (action.type === 'pay_subscription') {
      const subscriptionId = String(p.subscriptionId || '').trim();
      if (!subscriptionId) {
        throw new Error('Pay subscription proposal requires subscriptionId.');
      }
      const overrideAmount =
        p.amount !== undefined && Number(p.amount) > 0 ? Number(p.amount) : undefined;
      results.push(
        await subscriptionService.logSubscriptionPayment(
          userId,
          subscriptionId,
          p.walletId ? String(p.walletId) : undefined,
          p.paymentDate ? String(p.paymentDate) : undefined,
          overrideAmount,
          Boolean(p.updateBaselineAmount)
        )
      );
    }

    if (action.type === 'update_subscription') {
      const subscriptionId = String(p.subscriptionId || '').trim();
      if (!subscriptionId) {
        throw new Error('Update subscription proposal requires subscriptionId.');
      }
      results.push(
        await subscriptionService.updateSubscription(userId, subscriptionId, {
          name: p.name !== undefined ? String(p.name) : undefined,
          amount: p.amount !== undefined ? Number(p.amount) : undefined,
          currency: p.currency !== undefined ? String(p.currency) : undefined,
          billingCycle: p.billingCycle !== undefined ? String(p.billingCycle) : undefined,
          category: p.category !== undefined ? String(p.category) : undefined,
          walletId: p.walletId !== undefined ? (p.walletId ? String(p.walletId) : null) : undefined,
          nextBillingDate:
            p.nextBillingDate !== undefined
              ? p.nextBillingDate
                ? String(p.nextBillingDate)
                : null
              : undefined,
          status: p.status,
          notes: p.notes !== undefined ? String(p.notes) : undefined,
        })
      );
    }

    if (action.type === 'create_wallet') {
      const name = String(p.name || '').trim();
      const type = (p.type || 'Bank') as 'Bank' | 'Cash' | 'Savings' | 'Investment';
      if (!name || !['Bank', 'Cash', 'Savings', 'Investment'].includes(type)) {
        throw new Error('Wallet proposal requires name and valid type (Bank, Cash, Savings, Investment).');
      }
      results.push(
        await walletService.createWallet(userId, {
          name,
          type,
          accountSubtype: p.accountSubtype,
          institutionName: p.institutionName ? String(p.institutionName) : undefined,
          currency: p.currency ? String(p.currency) : 'MAD',
          isMain: Boolean(p.isMain),
          initialBalance: p.initialBalance !== undefined ? Number(p.initialBalance) : 0,
          creditLimit: p.creditLimit !== undefined ? Number(p.creditLimit) : undefined,
          liabilityBalance: p.liabilityBalance !== undefined ? Number(p.liabilityBalance) : undefined,
          statementClosingDay:
            p.statementClosingDay !== undefined ? Number(p.statementClosingDay) : undefined,
          paymentDueDay: p.paymentDueDay !== undefined ? Number(p.paymentDueDay) : undefined,
          minimumPayment: p.minimumPayment !== undefined ? Number(p.minimumPayment) : undefined,
        })
      );
    }

    if (action.type === 'create_context') {
      const name = String(p.name || '').trim();
      if (!name) {
        throw new Error('Context proposal requires a name.');
      }
      const startDateObj = p.startDate ? new Date(String(p.startDate)) : null;
      const endDateObj = p.endDate ? new Date(String(p.endDate)) : null;
      const computedStatus = resolveContextStatusFromDates(
        startDateObj,
        endDateObj,
        (p.status as any) || 'Planned'
      );
      const allowedContextTypes = ['Trip', 'Work / Mission', 'Project', 'Life Event', 'Other'] as const;
      const rawType = String(p.type || 'Trip');
      const contextType = (allowedContextTypes as readonly string[]).includes(rawType)
        ? (rawType as (typeof allowedContextTypes)[number])
        : 'Other';
      const [insertedContext] = await db
        .insert(financialContexts)
        .values({
          userId,
          name,
          type: contextType,
          startDate: startDateObj,
          endDate: endDateObj,
          budget: p.budget !== undefined && p.budget !== null ? String(Number(p.budget)) : null,
          status: computedStatus,
          notes: p.notes ? String(p.notes) : null,
        })
        .returning();
      results.push(insertedContext);
    }

    if (action.type === 'declare_external_asset') {
      const name = String(p.name || '').trim();
      const estimatedValue = Number(p.estimatedValue ?? p.value ?? 0);
      if (!name || !Number.isFinite(estimatedValue) || estimatedValue < 0) {
        throw new Error('External asset proposal requires name and non-negative estimatedValue.');
      }
      results.push(
        await coreAuditService.upsertExternalWealthItem(userId, {
          id: p.id ? String(p.id) : undefined,
          name,
          itemClass: String(p.itemClass || 'Electronics'),
          isLiability: Boolean(p.isLiability),
          isLiquid: Boolean(p.isLiquid),
          estimatedValue,
          currency: p.currency ? String(p.currency) : 'MAD',
          valuationDate: p.valuationDate ? String(p.valuationDate) : undefined,
          valuationSource: p.valuationSource ? String(p.valuationSource) : 'manual_estimate',
          confidenceLevel: p.confidenceLevel ? String(p.confidenceLevel) : 'medium',
          notes: p.notes ? String(p.notes) : undefined,
        })
      );
    }

    if (action.type === 'create_financial_rule') {
      const name = String(p.name || '').trim();
      const triggerType = String(p.triggerType || 'budget_pace_crossed');
      const actionType = String(p.actionType || 'send_notification');
      if (!name) {
        throw new Error('Financial rule proposal requires a name.');
      }
      results.push(
        await coreAuditService.upsertFinancialRule(userId, {
          name,
          enabled: p.enabled !== undefined ? Boolean(p.enabled) : true,
          triggerType,
          conditions: typeof p.conditions === 'object' && p.conditions ? p.conditions : {},
          actionType,
          actionPayload:
            typeof p.actionPayload === 'object' && p.actionPayload ? p.actionPayload : {},
        })
      );
    }
  }

  return results;
}



