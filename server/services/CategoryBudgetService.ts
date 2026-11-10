import { Type } from '@google/genai';
import { expenseCategories, normalizeCategory } from '../../src/lib/categories.js';
import {
  buildChronologicalPeriodPatternSummary,
  getCategoryPillar,
  monthLabel,
} from '../../src/lib/finance.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { goalRepository } from '../repositories/GoalRepository.js';
import { transactionService } from './TransactionService.js';
import { walletService } from './WalletService.js';
import {
  gemini,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_FAST,
  MODEL_FLASH_LITE_PREVIEW,
  MODEL_FLASH_LATEST,
  isModelUnavailable,
  markModelQuotaExhausted,
  markModelTemporaryOverload,
} from './GeminiClient.js';

export interface UpsertCategoryBudgetDTO {
  category: string;
  year: number;
  month: number;
  amount: number;
}

export interface GenerateSpexBudgetPlanDTO {
  year: number;
  month: number;
  userNotes?: string;
  targetIncomeMad?: number;
}

export class CategoryBudgetService {
  async getBudgetsForUser(userId: string) {
    return categoryBudgetRepository.findAllByUserId(userId);
  }

  async upsertBudget(userId: string, dto: UpsertCategoryBudgetDTO) {
    const category = normalizeCategory(dto.category);
    if (!category) throw new Error('A category is required');
    if (!Number.isInteger(dto.year) || dto.year < 2000 || dto.year > 2200) throw new Error('Invalid budget year');
    if (!Number.isInteger(dto.month) || dto.month < 1 || dto.month > 12) throw new Error('Invalid budget month');
    if (!Number.isFinite(dto.amount) || dto.amount < 0) throw new Error('Budget amount must be zero or greater');

    return categoryBudgetRepository.upsert({
      userId,
      category,
      year: dto.year,
      month: dto.month,
      amount: String(dto.amount),
    });
  }

  async copyPreviousMonth(userId: string, year: number, month: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Invalid budget month');
    }
    const previous = month === 1 ? { year: year - 1, month: 12 } : { year, month: month - 1 };
    const [previousBudgets, currentBudgets] = await Promise.all([
      categoryBudgetRepository.findByMonth(userId, previous.year, previous.month),
      categoryBudgetRepository.findByMonth(userId, year, month),
    ]);
    const currentCategories = new Set(currentBudgets.map((budget) => budget.category));
    const copied = [];
    for (const budget of previousBudgets) {
      if (!currentCategories.has(budget.category)) {
        copied.push(await categoryBudgetRepository.upsert({
          userId,
          category: budget.category,
          year,
          month,
          amount: String(budget.amount),
        }));
      }
    }
    return { copied: copied.length };
  }

  async deleteBudget(userId: string, id: string) {
    const deleted = await categoryBudgetRepository.deleteById(id, userId);
    if (!deleted) throw new Error('Budget not found or not owned by user');
    return deleted;
  }

  async batchUpsertBudgets(userId: string, budgets: { category: string; year: number; month: number; amount: number }[]) {
    if (!Array.isArray(budgets)) throw new Error('Budgets must be an array');
    
    const validBudgets = budgets.map((b) => {
      if (!b.category || typeof b.category !== 'string') throw new Error('Invalid category in batch');
      if (!Number.isInteger(b.year) || !Number.isInteger(b.month) || b.month < 1 || b.month > 12) {
        throw new Error(`Invalid year/month for category ${b.category}`);
      }
      if (typeof b.amount !== 'number' || b.amount < 0) {
        throw new Error(`Invalid amount for category ${b.category}`);
      }
      return {
        ...b,
        amount: String(b.amount),
      };
    });

    if (validBudgets.length === 0) return [];
    return categoryBudgetRepository.batchUpsert(userId, validBudgets);
  }

  async clearMonthBudgets(userId: string, year: number, month: number) {
    if (!Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error('Invalid budget month');
    }
    return categoryBudgetRepository.deleteAllByMonth(userId, year, month);
  }

  /**
   * Generates a personalized Spex AI Auto-Budget Plan synthesized across all historical
   * Financial Periods (sorted chronologically from OLDEST to CURRENT), active Subscriptions,
   * Payable Debts, Savings Goals, and optional user comments for the target month.
   * Strictly excludes reimbursements from income and uses net expenses (after deducting linked reimbursements).
   */
  async generateSpexPatternBudgetPlan(userId: string, dto: GenerateSpexBudgetPlanDTO) {
    const year = Number(dto.year) || new Date().getFullYear();
    const month = Number(dto.month) || new Date().getMonth() + 1;
    const userNotes = typeof dto.userNotes === 'string' ? dto.userNotes.trim() : '';

    const [transactions, payrolls, subscriptions, debts, goals, wallets] = await Promise.all([
      transactionService.getTransactionsForUser(userId),
      payrollRepository.findAllByUserId(userId),
      subscriptionRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      goalRepository.findAllByUserId(userId),
      walletService.getWallets(userId),
    ]);

    const patternAnalysis = buildChronologicalPeriodPatternSummary({
      transactions: transactions as any,
      payrolls: payrolls as any,
      targetYear: year,
      targetMonth: month,
      targetIncomeMad: dto.targetIncomeMad,
      subscriptions: subscriptions as any,
      debts: debts as any,
      wallets: wallets as any,
    });

    const targetIncome = patternAnalysis.targetIncomeBaselineMad;
    const activeSubs = subscriptions
      .filter((s) => !s.status || s.status === 'active' || s.status === 'planned')
      .map((s) => ({
        name: s.name,
        amountMad: Number(s.amount) || 0,
        billingCycle: s.billingCycle || 'monthly',
        category: normalizeCategory(s.category || '📱 Telecom & Subscriptions'),
        nextBillingDate: s.nextBillingDate ? new Date(s.nextBillingDate).toISOString().slice(0, 10) : null,
      }));

    const pendingPayableDebts = debts
      .filter((d) => d.type === 'Payable' && d.status === 'Pending')
      .map((d) => ({
        contactName: d.contactName,
        remainingMad: Number(d.remainingBalance) || 0,
        dueDate: d.dueDate ? new Date(d.dueDate).toISOString().slice(0, 10) : null,
      }));

    const activeGoals = goals.map((g) => ({
      name: g.name,
      targetMad: Number(g.targetAmount) || 0,
      currentMad: Number(g.currentAmount) || 0,
      remainingMad: Math.max(0, (Number(g.targetAmount) || 0) - (Number(g.currentAmount) || 0)),
      deadline: g.deadline ? new Date(g.deadline).toISOString().slice(0, 10) : null,
    }));

    // Build compact, high-signal chronological period-by-period payload for Spex AI
    const chronologicalPeriodsPayload = patternAnalysis.periodsOldestToCurrent.map((p) => ({
      order: `Period #${p.periodIndex} (${p.isCurrentPeriod ? 'Current Active Cycle' : 'Completed Historical Cycle'})`,
      periodRange: p.periodLabel,
      monthLabel: p.monthName,
      elapsedPct: Math.round(p.elapsedRatio * 100),
      netIncomeMad: p.netIncomeMad,
      reimbursedInflowExcludedMad: p.reimbursedInflowExcludedMad,
      netLivingSpentMad: p.netLivingSpentMad,
      reimbursedExpensesDeductedMad: p.reimbursedExpensesDeductedMad,
      spentOnObligationsMad: p.spentOnObligationsMad,
      spentOnMyselfMad: p.spentOnMyselfMad,
      investedMad: p.investedMad,
      retainedInBankMad: p.retainedInBankMad,
      categoryBreakdownNetMad: Object.fromEntries(
        Object.entries(p.categoryNetSpend).map(([cat, v]) => [
          cat,
          { netMad: Math.round(v.net * 100) / 100, reimbursedDeductedMad: Math.round(v.reimbursed * 100) / 100, txCount: v.count },
        ]),
      ),
    }));

    const categoryPatternsPayload = patternAnalysis.categoryProfiles.map((cp) => ({
      category: cp.category,
      pillar: cp.pillar,
      patternType: cp.patternType,
      activePeriods: `${cp.activePeriodsCount}/${cp.totalPeriodsAnalyzed}`,
      historicalMedianNetMad: cp.historicalMedianNetMad,
      recencyWeightedAvgNetMad: cp.recencyWeightedAvgNetMad,
      minNetMad: cp.minNetMad,
      maxNetMad: cp.maxNetMad,
      totalReimbursedDeductedMad: cp.totalReimbursedDeductedMad,
      trendDirection: cp.trendDirection,
      periodProgressionOldestToCurrent: cp.periodHistory.map(
        (h) => `${h.monthName.split(' ')[0]}: ${h.netSpentMad.toFixed(0)} MAD net${h.reimbursedMad > 0 ? ` (-${h.reimbursedMad.toFixed(0)} reimb)` : ''}`,
      ),
      baselineAlgorithmicSuggestionMad: cp.suggestedPatternBudgetMad,
    }));

    const systemPrompt = `You are Spex — TrueSpend's intelligent financial & budgeting strategist.
Your task is to generate a personalized, bespoke monthly budget plan for **${monthLabel(year, month)}** based on the user's real multi-period behavioral pattern, NOT rigid textbook ratios like 50/30/20 or 70/20/10.

## THE 5 LAWS OF TRUESPEND PERSONAL PATTERN BUDGETING (MANDATORY)
1. **Chronological Period-Over-Period Pattern Law (Oldest -> Current)**:
   - Analyze how the user's spending evolved from the **oldest financial period to the current financial period**.
   - Never judge based on isolated individual transactions; synthesize period-level habits, medians, recency-weighted trajectories, and consistency ratios.
2. **Strict Net-of-Reimbursement Law**:
   - Friend reimbursements and debt settlements are NEVER income.
   - Reimbursed portions of shared expenses (e.g., fronting dining or cinema bills for friends) are ALREADY deducted in \`netSpentMad\`. Base every category budget strictly on true personal **Net Spend** and **Net Income** (${targetIncome.toFixed(2)} MAD).
3. **Obligations & Subscriptions Floor Protection Law**:
   - Essential obligations (\`🏢 Housing & Utilities\`, \`🛒 Groceries\`, \`🚗 Transportation\`, \`📱 Telecom & Subscriptions\`, \`🏠 Household & Family\`, \`🩺 Health & Medical\`, \`🛡️ Insurance / Annual Costs\`) must cover the user's proven multi-period net need and active recurring subscriptions.
   - \`💳 Debt & Obligations\` must reflect actual pending Payable debts (${pendingPayableDebts.length > 0 ? pendingPayableDebts.map((d) => `${d.contactName}: ${d.remainingMad} MAD`).join(', ') : '0 MAD active payable debt'}). Do not allocate money to \`💳 Debt & Obligations\` if all payable debts are cleared unless requested by the user.
4. **Lifestyle Optimization ("Spent on Myself") & Bank-as-Savings Retention Law**:
   - Personal lifestyle categories (\`🍔 Dining & Takeaway\`, \`☕ Coffee & Quick Food\`, \`👕 Personal & Clothing\`, \`🎬 Entertainment\`, \`👥 Social\`) should match the user's realistic personal net habit while gently curbing upward lifestyle creep (trimming 5–15% on categories trending upward).
   - **Bank-as-Savings Architecture**: The user's main bank account IS their savings account. Whatever Net Income is not spent on Obligations, Myself, or \`📈 Investments\` stays automatically in the bank as \`🛟 Emergency & goals Fund\`.
   - The sum of all category allocations (including \`📈 Investments\` and \`🛟 Emergency & goals Fund\`) MUST equal **${Math.round(targetIncome)} MAD** (100% of Net Available Income).
5. **User Next-Month Directive Override Law**:
   - ${userNotes ? `The user provided specific instructions/comments for next month: "${userNotes}". You MUST explicitly honor and incorporate these instructions into the relevant categories, rebalance other categories/savings so the total equals ${Math.round(targetIncome)} MAD, and explain how you applied their comments in \`userNotesApplied\` and per-category \`reasoning\`.` : 'No special next-month comments were provided; build the optimal plan from historical financial periods, subscriptions, and obligations.'}

Allowed canonical category names (use ONLY these exact strings):
${expenseCategories.map((c) => `- "${c}"`).join('\n')}`;

    const userPayload = JSON.stringify(
      {
        targetPeriod: monthLabel(year, month),
        netAvailableIncomeMad: targetIncome,
        totalPassThroughReimbursementsExcludedMad: patternAnalysis.totalReimbursementsStrippedMad,
        userCommentsForNextMonth: userNotes || null,
        chronologicalFinancialPeriodsOldestToCurrent: chronologicalPeriodsPayload,
        categoryPatternProfiles: categoryPatternsPayload,
        activeSubscriptions: activeSubs,
        pendingPayableDebts,
        activeSavingsGoals: activeGoals,
      },
      null,
      2,
    );

    const candidateModels = [
      MODEL_FLASH_DEEP,
      MODEL_FLASH_FAST,
      MODEL_FLASH_LITE_PREVIEW,
      MODEL_FLASH_LATEST,
    ].filter((m) => !isModelUnavailable(m));

    let aiResult: {
      planName?: string;
      executiveSummary?: string;
      patternInsights?: string[];
      userNotesApplied?: string;
      allocations?: { category: string; amount: number; reasoning: string }[];
    } | null = null;
    let modelUsed = 'spex-pattern-engine';

    if (process.env.GEMINI_API_KEY) {
      for (const model of candidateModels) {
        try {
          const response = await gemini.models.generateContent({
            model,
            contents: userPayload,
            config: {
              systemInstruction: systemPrompt,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  planName: {
                    type: Type.STRING,
                    description: 'Short title for this personalized Spex budget plan.',
                  },
                  executiveSummary: {
                    type: Type.STRING,
                    description: '2-3 sentence executive summary explaining the multi-period pattern (oldest to current), net reimbursement filtering, and overall strategy.',
                  },
                  patternInsights: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: '3 to 4 crisp bullet insights citing exact numbers from the chronological financial periods.',
                  },
                  userNotesApplied: {
                    type: Type.STRING,
                    description: 'Explanation of how the user comments for next month were applied (or empty string if none).',
                  },
                  allocations: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        category: { type: Type.STRING },
                        amount: { type: Type.NUMBER },
                        reasoning: { type: Type.STRING },
                      },
                      required: ['category', 'amount', 'reasoning'],
                    },
                  },
                },
                required: ['planName', 'executiveSummary', 'patternInsights', 'allocations'],
              },
            },
          });

          const rawText = (response.text ?? '').trim();
          if (rawText) {
            const parsed = JSON.parse(rawText);
            if (parsed && Array.isArray(parsed.allocations) && parsed.allocations.length > 0) {
              aiResult = parsed;
              modelUsed = model;
              break;
            }
          }
        } catch (err: any) {
          const status = err?.status || err?.code;
          const msg = String(err?.message || '');
          if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
            markModelQuotaExhausted(model);
          } else if (status === 503 || msg.includes('503') || msg.includes('UNAVAILABLE')) {
            markModelTemporaryOverload(model);
          }
          console.warn(`[SpexBudgetPlan] Model ${model} failed, trying fallback:`, msg);
        }
      }
    }

    // Merge & reconcile AI allocations (or deterministic fallback if AI unavailable)
    const profileByCat = new Map(patternAnalysis.categoryProfiles.map((p) => [p.category, p]));
    const finalAllocationsMap = new Map<string, { amount: number; reasoning: string }>();

    if (aiResult && Array.isArray(aiResult.allocations)) {
      for (const item of aiResult.allocations) {
        const normCat = normalizeCategory(item.category);
        if (!(expenseCategories as readonly string[]).includes(normCat)) continue;
        const amt = Math.max(0, Math.round(Number(item.amount) || 0));
        if (amt > 0 || normCat === '🛟 Emergency & goals Fund') {
          finalAllocationsMap.set(normCat, {
            amount: amt,
            reasoning: item.reasoning || profileByCat.get(normCat)?.patternReasoning || 'Pattern-calibrated allocation.',
          });
        }
      }
    }

    // If AI didn't return allocations (e.g., offline/cooldown), use the deterministic pattern analysis
    if (finalAllocationsMap.size === 0) {
      for (const rec of patternAnalysis.recommendedBudgets) {
        finalAllocationsMap.set(rec.category, {
          amount: rec.amount,
          reasoning: rec.reasoning,
        });
      }
    }

    // Reconcile Bank-as-Savings ('🛟 Emergency & goals Fund') so total allocations equal 100% of Net Income
    let nonSavingsSum = 0;
    finalAllocationsMap.forEach((val, cat) => {
      if (cat !== '🛟 Emergency & goals Fund') {
        nonSavingsSum += val.amount;
      }
    });

    if (targetIncome > 0) {
      const bankRetainedRemainder = Math.max(0, Math.round(targetIncome - nonSavingsSum));
      const existingSavings = finalAllocationsMap.get('🛟 Emergency & goals Fund');
      if (bankRetainedRemainder > 0 || existingSavings) {
        const finalSavingsAmt = bankRetainedRemainder > 0 ? bankRetainedRemainder : (existingSavings?.amount || 0);
        finalAllocationsMap.set('🛟 Emergency & goals Fund', {
          amount: finalSavingsAmt,
          reasoning:
            existingSavings?.reasoning ||
            `Bank-as-Savings Zero-Transaction Retention: ${finalSavingsAmt.toFixed(0)} MAD (${((finalSavingsAmt / targetIncome) * 100).toFixed(1)}% of net income) stays protected in your main bank account after all living & investment budgets.`,
        });
      }
    }

    const enrichedAllocations = Array.from(finalAllocationsMap.entries())
      .filter(([_cat, v]) => v.amount > 0)
      .map(([category, v]) => {
        const prof = profileByCat.get(category);
        const pillar = getCategoryPillar(category);
        return {
          category,
          pillar,
          amount: v.amount,
          pctOfIncome: targetIncome > 0 ? Math.round(((v.amount / targetIncome) * 100) * 10) / 10 : 0,
          historicalAvgNetMad: prof?.recencyWeightedAvgNetMad ?? 0,
          historicalMedianNetMad: prof?.historicalMedianNetMad ?? 0,
          totalReimbursedDeductedMad: prof?.totalReimbursedDeductedMad ?? 0,
          activePeriods: prof ? `${prof.activePeriodsCount}/${prof.totalPeriodsAnalyzed}` : '0/1',
          patternType: prof?.patternType ?? 'Regular Variable',
          trendDirection: prof?.trendDirection ?? 'stable',
          reasoning: v.reasoning,
        };
      })
      .sort((a, b) => {
        const order: Record<string, number> = { obligations: 1, myself: 2, investments: 3, savings: 4 };
        if (order[a.pillar] !== order[b.pillar]) return order[a.pillar] - order[b.pillar];
        return b.amount - a.amount;
      });

    const obligationsMad = enrichedAllocations
      .filter((a) => a.pillar === 'obligations')
      .reduce((s, a) => s + a.amount, 0);
    const myselfMad = enrichedAllocations
      .filter((a) => a.pillar === 'myself')
      .reduce((s, a) => s + a.amount, 0);
    const investmentsMad = enrichedAllocations
      .filter((a) => a.pillar === 'investments')
      .reduce((s, a) => s + a.amount, 0);
    const bankRetentionSavingsMad = enrichedAllocations
      .filter((a) => a.pillar === 'savings')
      .reduce((s, a) => s + a.amount, 0);

    const fallbackSummary = `Synthesized across ${patternAnalysis.periodsOldestToCurrent.length} chronological financial period${patternAnalysis.periodsOldestToCurrent.length === 1 ? '' : 's'} (oldest to current), stripping ${patternAnalysis.totalReimbursementsStrippedMad.toFixed(0)} MAD in friend reimbursements & pass-throughs. Allocates ${obligationsMad.toFixed(0)} MAD (${targetIncome > 0 ? ((obligationsMad / targetIncome) * 100).toFixed(1) : 0}%) to Obligations, ${myselfMad.toFixed(0)} MAD (${targetIncome > 0 ? ((myselfMad / targetIncome) * 100).toFixed(1) : 0}%) to Spent on Myself, ${investmentsMad.toFixed(0)} MAD to Investments, and retains ${bankRetentionSavingsMad.toFixed(0)} MAD (${targetIncome > 0 ? ((bankRetentionSavingsMad / targetIncome) * 100).toFixed(1) : 0}%) in your bank account.`;

    const fallbackInsights = [
      `Analyzed ${patternAnalysis.periodsOldestToCurrent.length} financial periods in chronological order (${patternAnalysis.periodsOldestToCurrent.map((p) => p.monthName).join(' → ')}).`,
      `Excluded ${patternAnalysis.totalReimbursementsStrippedMad.toFixed(2)} MAD in friend reimbursements & split settlements so neither your income nor category spend is inflated.`,
      `Protected ${obligationsMad.toFixed(0)} MAD for core Obligations & recurring Subscriptions while calibrating Spent on Myself to ${myselfMad.toFixed(0)} MAD.`,
      `Retains ${bankRetentionSavingsMad.toFixed(0)} MAD (${targetIncome > 0 ? ((bankRetentionSavingsMad / targetIncome) * 100).toFixed(1) : 0}% of net income) directly in your bank account without needing a dummy savings transaction.`,
    ];

    return {
      planName: aiResult?.planName || `Spex Personalized Pattern Plan (${monthLabel(year, month)})`,
      executiveSummary: aiResult?.executiveSummary || fallbackSummary,
      patternInsights:
        aiResult?.patternInsights && aiResult.patternInsights.length > 0
          ? aiResult.patternInsights
          : fallbackInsights,
      userNotesApplied:
        aiResult?.userNotesApplied ||
        (userNotes ? `Applied your note ("${userNotes}") across the relevant categories and rebalanced bank retention.` : ''),
      targetYear: year,
      targetMonth: month,
      targetIncomeMad: targetIncome,
      totalReimbursementsStrippedMad: patternAnalysis.totalReimbursementsStrippedMad,
      periodsAnalyzed: patternAnalysis.periodsOldestToCurrent.map((p) => ({
        periodIndex: p.periodIndex,
        periodLabel: p.periodLabel,
        monthName: p.monthName,
        isCurrentPeriod: p.isCurrentPeriod,
        netIncomeMad: p.netIncomeMad,
        netLivingSpentMad: p.netLivingSpentMad,
        reimbursedStrippedMad: p.reimbursedInflowExcludedMad + p.reimbursedExpensesDeductedMad,
        spentOnObligationsMad: p.spentOnObligationsMad,
        spentOnMyselfMad: p.spentOnMyselfMad,
        investedMad: p.investedMad,
        retainedInBankMad: p.retainedInBankMad,
      })),
      allocations: enrichedAllocations,
      pillarBreakdown: {
        obligationsMad,
        obligationsPct: targetIncome > 0 ? Math.round(((obligationsMad / targetIncome) * 100) * 10) / 10 : 0,
        myselfMad,
        myselfPct: targetIncome > 0 ? Math.round(((myselfMad / targetIncome) * 100) * 10) / 10 : 0,
        investmentsMad,
        investmentsPct: targetIncome > 0 ? Math.round(((investmentsMad / targetIncome) * 100) * 10) / 10 : 0,
        bankRetentionSavingsMad,
        bankRetentionSavingsPct:
          targetIncome > 0 ? Math.round(((bankRetentionSavingsMad / targetIncome) * 100) * 10) / 10 : 0,
      },
      modelUsed,
    };
  }
}

export const categoryBudgetService = new CategoryBudgetService();

