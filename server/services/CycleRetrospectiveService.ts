import { GoogleGenAI } from '@google/genai';
import {
  gemini,
  MODEL_FLASH_DEEP,
  MODEL_FLASH_LITE,
  MODEL_FLASH_LATEST,
  isModelQuotaExhausted,
  markModelQuotaExhausted,
} from './GeminiClient.js';
import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { walletService } from './WalletService.js';
import { getFinancialPeriods, getCurrentFinancialMonth, isInFinancialMonth, FinancialPeriod } from '../../src/lib/financialMonth.js';
import { netExpenseOf, isInvestmentCategory } from '../../src/lib/finance.js';
import { normalizeCategory } from '../../src/lib/categories.js';
import type {
  CycleRetrospectiveData,
  CyclePeriodSummary,
  RetrospectiveLetterGrade,
  CycleCategoryPerformance,
  CycleDailyVelocity,
  CyclePaydayAllocation,
  CycleComparison,
} from '../../src/types/index.js';

// In-memory cache for retrospectives: key = `${userId}:${cycleId}`
const retrospectiveCache = new Map<string, { data: CycleRetrospectiveData; timestamp: number }>();
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache (bustable with forceRefresh)

export class CycleRetrospectiveService {
  /**
   * Returns all available financial periods/cycles for the user.
   */
  async getAvailableCycles(userId: string, dbUser: any): Promise<CyclePeriodSummary[]> {
    const payrolls = await payrollRepository.findAllByUserId(userId);
    const periods = getFinancialPeriods(payrolls);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (periods.length >= 1) {
      return periods.map((p, idx) => {
        const isCurrent = today >= p.start && today <= p.end;
        const startStr = p.start.toISOString().split('T')[0];
        const endStr = p.end.toISOString().split('T')[0];
        const label = `${p.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${p.end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
        return {
          id: `cycle-${p.year}-${p.month}`,
          label,
          startDate: startStr,
          endDate: endStr,
          isCurrent,
          year: p.year,
          month: p.month,
        };
      }).reverse(); // Most recent first
    }

    // Fallback: Synthesize periods using configured payday (default 25th)
    const paydayDay = Number(dbUser?.payday) || 25;
    const summaries: CyclePeriodSummary[] = [];

    // Current, Previous, and 2-months-ago periods
    for (let offset = 0; offset >= -2; offset--) {
      const refDate = new Date(now.getFullYear(), now.getMonth() + offset, 1);
      const year = refDate.getFullYear();
      const month = refDate.getMonth(); // 0-indexed

      // Period start: (month - 1) on payday
      const startDate = new Date(year, month - 1, paydayDay, 0, 0, 0, 0);
      // Period end: day before this month's payday
      const endDate = new Date(year, month, paydayDay - 1, 23, 59, 59, 999);

      const isCurrent = today >= startDate && today <= endDate;
      const startStr = startDate.toISOString().split('T')[0];
      const endStr = endDate.toISOString().split('T')[0];
      const label = `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

      summaries.push({
        id: `synth-${startDate.getFullYear()}-${startDate.getMonth() + 1}`,
        label,
        startDate: startStr,
        endDate: endStr,
        isCurrent,
        year: endDate.getFullYear(),
        month: endDate.getMonth() + 1,
      });
    }

    return summaries;
  }

  /**
   * Computes complete financial figures and AI retrospective for a cycle.
   */
  async getCycleRetrospective(
    userId: string,
    dbUser: any,
    options: {
      cycleId?: string;
      preferredModel?: string;
      allowFallback?: boolean;
      forceRefresh?: boolean;
    } = {}
  ): Promise<CycleRetrospectiveData> {
    const { cycleId, preferredModel = 'auto', allowFallback = true, forceRefresh = false } = options;
    const availableCycles = await this.getAvailableCycles(userId, dbUser);

    if (availableCycles.length === 0) {
      throw new Error('No financial cycles available. Please configure your salary and payday.');
    }

    const selectedCycle = cycleId
      ? availableCycles.find((c) => c.id === cycleId) || availableCycles[0]
      : availableCycles.find((c) => c.isCurrent) || availableCycles[0];

    const cacheKey = `${userId}:${selectedCycle.id}`;
    if (!forceRefresh) {
      const cached = retrospectiveCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
        return cached.data;
      }
    }

    // Fetch user financial records
    const [allTx, allBudgets, allDebts, payrolls, wallets] = await Promise.all([
      transactionService.getTransactionsForUser(userId),
      categoryBudgetRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      payrollRepository.findAllByUserId(userId),
      walletService.getWallets(userId),
    ]);

    const cycleStart = new Date(selectedCycle.startDate + 'T00:00:00.000Z');
    const cycleEnd = new Date(selectedCycle.endDate + 'T23:59:59.999Z');
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const totalDays = Math.max(1, Math.round((cycleEnd.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
    const elapsedDays = selectedCycle.isCurrent
      ? Math.max(1, Math.min(totalDays, Math.round((today.getTime() - cycleStart.getTime()) / (1000 * 60 * 60 * 24)) + 1))
      : totalDays;
    const daysRemaining = Math.max(0, totalDays - elapsedDays);

    // Filter transactions for this cycle
    const cycleTransactions = allTx.filter((tx) => {
      const d = new Date(tx.createdAt);
      return d >= cycleStart && d <= cycleEnd;
    });

    // Inflows, Outflows, Investments, Debts
    let totalInflow = 0;
    let totalOutflow = 0;
    let totalInvested = 0;
    let totalDebtRepaid = 0;

    const categorySpendMap = new Map<string, number>();
    const dailySpendMap = new Map<string, number>();

    // Initial salary from userSettings or payroll scheduled amount
    const configuredSalary = Number(dbUser?.salary) || 0;
    const cyclePayroll = payrolls.find((p) => {
      const pDate = new Date(p.scheduledFor);
      return pDate >= cycleStart && pDate <= cycleEnd;
    });
    if (cyclePayroll && Number(cyclePayroll.amount) > 0) {
      totalInflow += Number(cyclePayroll.amount);
    } else if (configuredSalary > 0) {
      totalInflow += configuredSalary;
    }

    for (const tx of cycleTransactions) {
      const amount = Number(tx.amount) || 0;
      const txDateStr = new Date(tx.createdAt).toISOString().split('T')[0];

      const srcWallet = wallets.find((w: any) => w.id === tx.walletId);
      const destWallet = tx.destinationWalletId ? wallets.find((w: any) => w.id === tx.destinationWalletId) : null;
      const isFromInvestmentWallet = String(srcWallet?.type || '').toLowerCase() === 'investment';
      const isToInvestmentWallet = String(destWallet?.type || '').toLowerCase() === 'investment';

      if (tx.type === 'Income') {
        // Only count if not duplicate of already counted payroll
        if (!tx.payrollId || (!cyclePayroll && configuredSalary === 0)) {
          totalInflow += amount;
        }
      } else if (tx.type === 'Transfer') {
        if ((isToInvestmentWallet || isInvestmentCategory(tx.category)) && !isFromInvestmentWallet) {
          totalInvested += amount;
        }
      } else if (tx.type === 'Expense') {
        if (isInvestmentCategory(tx.category) || isFromInvestmentWallet) {
          if (!isFromInvestmentWallet) {
            totalInvested += amount;
          }
        } else {
          const effective = netExpenseOf(tx);
          totalOutflow += effective;

          const cat = normalizeCategory(tx.category || 'Other');
          categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + effective);

          dailySpendMap.set(txDateStr, (dailySpendMap.get(txDateStr) || 0) + effective);
        }
      } else if (tx.type === 'Debt Repayment') {
        totalDebtRepaid += amount;
        totalOutflow += amount;
        const cat = 'Debt Repayment';
        categorySpendMap.set(cat, (categorySpendMap.get(cat) || 0) + amount);
        dailySpendMap.set(txDateStr, (dailySpendMap.get(txDateStr) || 0) + amount);
      }
    }

    const netSavings = totalInflow - totalOutflow;
    const savingsRate = totalInflow > 0 ? (netSavings / totalInflow) * 100 : 0;
    const avgDailySpend = Math.round((totalOutflow / Math.max(1, elapsedDays)) * 100) / 100;

    // Discretionary Daily Allowance calculation
    const cycleBudgets = allBudgets.filter(
      (b) => b.year === selectedCycle.year && b.month === selectedCycle.month
    );
    const totalBudgeted = cycleBudgets.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
    const dailyAllowance = Math.round(
      (totalBudgeted > 0 ? totalBudgeted / totalDays : Math.max(1, (totalInflow * 0.7) / totalDays)) * 100
    ) / 100;

    // Daily Velocity breakdown
    const dailyVelocity: CycleDailyVelocity[] = [];
    let runningCumulative = 0;
    let daysUnderAllowanceCount = 0;
    let daysOverAllowanceCount = 0;

    for (let dayIdx = 0; dayIdx < elapsedDays; dayIdx++) {
      const dayDate = new Date(cycleStart.getTime() + dayIdx * 24 * 60 * 60 * 1000);
      const dayDateStr = dayDate.toISOString().split('T')[0];
      const spent = dailySpendMap.get(dayDateStr) || 0;
      runningCumulative += spent;
      const isUnder = spent <= dailyAllowance;
      if (isUnder) daysUnderAllowanceCount++;
      else daysOverAllowanceCount++;

      dailyVelocity.push({
        date: dayDateStr,
        dayNumber: dayIdx + 1,
        dayOfWeek: dayDate.toLocaleDateString('en-US', { weekday: 'short' }),
        spent: Math.round(spent * 100) / 100,
        allowance: dailyAllowance,
        isUnderBudget: isUnder,
        cumulativeSpent: Math.round(runningCumulative * 100) / 100,
      });
    }

    // Category Performance Matrix
    const categories: CycleCategoryPerformance[] = [];
    const knownCategories = [
      '🛒 Groceries',
      '🍔 Dining & Takeaway',
      '🚗 Transportation',
      '🏠 Housing & Rent',
      '⚡ Utilities & Bills',
      '👕 Personal & Clothing',
      '🎬 Entertainment',
      '👥 Social',
      '☕ Coffee & Quick Food',
      '💊 Health & Medical',
      '📱 Subscriptions',
      '⚠️ Unexpected',
    ];

    // Combine budgeted categories with actual spend categories
    const allCategoryNames = Array.from(
      new Set([...knownCategories, ...Array.from(categorySpendMap.keys()), ...cycleBudgets.map((b) => b.category)])
    );

    for (const rawCat of allCategoryNames) {
      const cat = normalizeCategory(rawCat);
      const actual = Math.round((categorySpendMap.get(cat) || 0) * 100) / 100;
      const budgetItem = cycleBudgets.find((b) => normalizeCategory(b.category) === cat);
      const budget = budgetItem ? Number(budgetItem.amount) || 0 : 0;

      // Only include categories that had actual spending or a configured budget
      if (actual === 0 && budget === 0) continue;

      const diff = Math.round((budget - actual) * 100) / 100;
      const percentUsed = budget > 0 ? Math.round((actual / budget) * 100) : (actual > 0 ? 100 : 0);

      let grade: RetrospectiveLetterGrade = 'B';
      let status: 'under' | 'on_track' | 'warning' | 'over' = 'on_track';

      if (budget > 0) {
        if (percentUsed <= 80) {
          grade = 'A+';
          status = 'under';
        } else if (percentUsed <= 95) {
          grade = 'A';
          status = 'under';
        } else if (percentUsed <= 100) {
          grade = 'B+';
          status = 'on_track';
        } else if (percentUsed <= 115) {
          grade = 'C+';
          status = 'warning';
        } else if (percentUsed <= 130) {
          grade = 'D';
          status = 'over';
        } else {
          grade = 'F';
          status = 'over';
        }
      } else {
        grade = actual > 500 ? 'C' : 'B';
        status = 'on_track';
      }

      categories.push({
        category: cat,
        actual,
        budget,
        difference: diff,
        percentUsed,
        grade,
        status,
      });
    }

    // Sort categories by highest spend
    categories.sort((a, b) => b.actual - a.actual);

    // Macro Split (Needs / Wants / Savings)
    const needsCategories = [
      '🛒 Groceries',
      '🏠 Housing & Rent',
      '⚡ Utilities & Bills',
      '🚗 Transportation',
      '💊 Health & Medical',
      '👶 Family & Childcare',
    ];
    const wantsCategories = [
      '🍔 Dining & Takeaway',
      '☕ Coffee & Quick Food',
      '🎬 Entertainment',
      '👥 Social',
      '👕 Personal & Clothing',
      '🛍️ Shopping',
      '✈️ Travel & Holidays',
      '📱 Subscriptions',
      '⚠️ Unexpected',
    ];

    let needsAmount = 0;
    let wantsAmount = 0;
    for (const cat of categories) {
      if (needsCategories.some((nc) => cat.category.includes(nc.slice(2).trim()))) {
        needsAmount += cat.actual;
      } else if (wantsCategories.some((wc) => cat.category.includes(wc.slice(2).trim()))) {
        wantsAmount += cat.actual;
      } else {
        // default split
        needsAmount += cat.actual * 0.5;
        wantsAmount += cat.actual * 0.5;
      }
    }

    const totalMacro = Math.max(totalInflow, totalOutflow);
    const macroSplit = {
      needs: {
        amount: Math.round(needsAmount),
        percent: totalMacro > 0 ? Math.round((needsAmount / totalMacro) * 100) : 50,
        targetPercent: 50,
      },
      wants: {
        amount: Math.round(wantsAmount),
        percent: totalMacro > 0 ? Math.round((wantsAmount / totalMacro) * 100) : 30,
        targetPercent: 30,
      },
      savings: {
        amount: Math.max(0, Math.round(netSavings + totalInvested)),
        percent: totalMacro > 0 ? Math.round((Math.max(0, netSavings + totalInvested) / totalMacro) * 100) : 20,
        targetPercent: 20,
      },
    };

    // Calculate Financial Performance Score (0 - 100)
    let score = 50;

    // 1. Savings component (up to 30 pts)
    if (savingsRate >= 25) score += 30;
    else if (savingsRate >= 15) score += 22;
    else if (savingsRate >= 5) score += 14;
    else if (savingsRate >= 0) score += 6;
    else score -= 15; // Deficit penalty

    // 2. Budget adherence (up to 25 pts)
    const budgetedCats = categories.filter((c) => c.budget > 0);
    if (budgetedCats.length > 0) {
      const compliant = budgetedCats.filter((c) => c.actual <= c.budget).length;
      const complianceRatio = compliant / budgetedCats.length;
      score += Math.round(complianceRatio * 25);
    } else {
      score += 18; // Neutral baseline
    }

    // 3. Daily Discipline (up to 20 pts)
    if (elapsedDays > 0) {
      const disciplineRatio = daysUnderAllowanceCount / elapsedDays;
      score += Math.round(disciplineRatio * 20);
    }

    // 4. Emergency Buffer & Safe to Spend Protection (up to 15 pts)
    const emergencyBuffer = Number(dbUser?.emergencyBuffer) || 0;
    const liquidTotal = wallets.reduce((sum, w: any) => sum + (Number(w.currentBalance || w.balance || w.initialBalance) || 0), 0);
    if (liquidTotal >= emergencyBuffer * 1.5) score += 15;
    else if (liquidTotal >= emergencyBuffer) score += 10;
    else score += 4;

    score = Math.max(10, Math.min(100, Math.round(score)));

    // Map Score to Letter Grade
    let letterGrade: RetrospectiveLetterGrade = 'B';
    if (score >= 95) letterGrade = 'A+';
    else if (score >= 90) letterGrade = 'A';
    else if (score >= 85) letterGrade = 'A-';
    else if (score >= 80) letterGrade = 'B+';
    else if (score >= 75) letterGrade = 'B';
    else if (score >= 70) letterGrade = 'B-';
    else if (score >= 65) letterGrade = 'C+';
    else if (score >= 60) letterGrade = 'C';
    else if (score >= 50) letterGrade = 'D';
    else letterGrade = 'F';

    // Financial Archetype
    let financialPersona = {
      title: 'The Resilient Balancer',
      description: 'Navigates variable financial demands with steady poise and consistent awareness.',
      trait: 'Balanced & Adaptable',
      icon: '⚖️',
    };

    if (savingsRate >= 28 && score >= 85) {
      financialPersona = {
        title: 'The Wealth Architect',
        description: 'Elite capital preservation and aggressive wealth compounding discipline.',
        trait: 'Strategic & High-Yield',
        icon: '🏗️',
      };
    } else if (savingsRate >= 15 && daysUnderAllowanceCount >= elapsedDays * 0.7) {
      financialPersona = {
        title: 'The Tactical Builder',
        description: 'Controlled daily spending and consistent surplus accumulation.',
        trait: 'Disciplined & Methodical',
        icon: '🛡️',
      };
    } else if (wantsAmount > needsAmount) {
      financialPersona = {
        title: 'The Lifestyle Experiencer',
        description: 'High prioritization of experiences and discretionary pleasures.',
        trait: 'Spontaneous & Present-Focused',
        icon: '✨',
      };
    } else if (daysOverAllowanceCount > daysUnderAllowanceCount) {
      financialPersona = {
        title: 'The Burst Spender',
        description: 'Periods of calm punctuated by high-velocity spending clusters.',
        trait: 'Impulsive Peaks & Valleys',
        icon: '⚡',
      };
    }

    // Comparison with previous cycle
    let comparison: CycleComparison | null = null;
    const currentIndex = availableCycles.findIndex((c) => c.id === selectedCycle.id);
    if (currentIndex >= 0 && currentIndex < availableCycles.length - 1) {
      const prevCycle = availableCycles[currentIndex + 1];
      const prevStart = new Date(prevCycle.startDate + 'T00:00:00.000Z');
      const prevEnd = new Date(prevCycle.endDate + 'T23:59:59.999Z');

      const prevTx = allTx.filter((t) => {
        const d = new Date(t.createdAt);
        return d >= prevStart && d <= prevEnd;
      });

      let prevOutflow = 0;
      let prevInflow = configuredSalary;
      for (const t of prevTx) {
        if (t.type === 'Expense' && !isInvestmentCategory(t.category)) {
          prevOutflow += netExpenseOf(t);
        } else if (t.type === 'Income') {
          prevInflow += Number(t.amount) || 0;
        }
      }

      const prevSavings = prevInflow - prevOutflow;
      const expensesDelta = prevOutflow > 0 ? ((totalOutflow - prevOutflow) / prevOutflow) * 100 : 0;
      const savingsDelta = prevSavings > 0 ? ((netSavings - prevSavings) / prevSavings) * 100 : 0;

      comparison = {
        previousPeriodLabel: prevCycle.label,
        expensesChangePercent: Math.round(expensesDelta * 10) / 10,
        savingsChangePercent: Math.round(savingsDelta * 10) / 10,
        avgDailySpendChange: Math.round((avgDailySpend - (prevOutflow / 30)) * 10) / 10,
        healthScoreChange: Math.round(score - 75), // approximate baseline
      };
    }

    // AI Generation via Gemini (with smart model sequencing and resilient fallback)
    const promptPayload = {
      periodLabel: selectedCycle.label,
      isCurrentCycle: selectedCycle.isCurrent,
      totalInflow,
      totalOutflow,
      netSavings,
      savingsRate: Math.round(savingsRate * 10) / 10,
      dailyAllowance,
      avgDailySpend,
      score,
      letterGrade,
      elapsedDays,
      totalDays,
      daysUnderAllowanceCount,
      daysOverAllowanceCount,
      macroSplit,
      topCategories: categories.slice(0, 5).map((c) => ({
        category: c.category,
        spent: c.actual,
        budget: c.budget,
        percentUsed: c.percentUsed,
      })),
      recentBigExpenses: cycleTransactions
        .filter((t) => t.type === 'Expense')
        .sort((a, b) => Number(b.amount) - Number(a.amount))
        .slice(0, 4)
        .map((t) => ({ amount: Number(t.amount), category: t.category, notes: t.notes })),
      comparison,
    };

    const aiResult = await this.generateAiRetrospective(promptPayload, {
      preferredModel,
      allowFallback,
    });

    const result: CycleRetrospectiveData = {
      cycleId: selectedCycle.id,
      periodLabel: selectedCycle.label,
      startDate: selectedCycle.startDate,
      endDate: selectedCycle.endDate,
      isCurrentCycle: selectedCycle.isCurrent,
      totalDays,
      elapsedDays,
      daysRemaining,
      letterGrade: aiResult.letterGrade || letterGrade,
      score: aiResult.score || score,
      financialPersona: aiResult.financialPersona || financialPersona,
      totalInflow: Math.round(totalInflow * 100) / 100,
      totalOutflow: Math.round(totalOutflow * 100) / 100,
      netSavings: Math.round(netSavings * 100) / 100,
      savingsRate: Math.round(savingsRate * 10) / 10,
      dailyAllowance,
      avgDailySpend,
      daysUnderAllowanceCount,
      daysOverAllowanceCount,
      safeToSpendEnding: Math.max(0, netSavings),
      totalInvested: Math.round(totalInvested * 100) / 100,
      totalDebtRepaid: Math.round(totalDebtRepaid * 100) / 100,
      macroSplit,
      categories,
      dailyVelocity,
      comparison,
      verdictTitle: aiResult.verdictTitle,
      executiveSummary: aiResult.executiveSummary,
      biggestWins: aiResult.biggestWins,
      financialLeaks: aiResult.financialLeaks,
      paydayAllocations: aiResult.paydayAllocations,
      goldenRule: aiResult.goldenRule,
      generatedAt: new Date().toISOString(),
      modelUsed: aiResult.modelUsed,
      isAiGenerated: aiResult.isAiGenerated,
      fallbackReason: aiResult.fallbackReason,
    };

    // Cache result
    retrospectiveCache.set(cacheKey, { data: result, timestamp: Date.now() });

    return result;
  }

  /**
   * Calls Gemini to generate the deep qualitative retrospective narrative.
   */
  private async generateAiRetrospective(
    payload: any,
    options: { preferredModel?: string; allowFallback?: boolean }
  ): Promise<{
    letterGrade?: RetrospectiveLetterGrade;
    score?: number;
    financialPersona?: any;
    verdictTitle: string;
    executiveSummary: string;
    biggestWins: string[];
    financialLeaks: string[];
    paydayAllocations: CyclePaydayAllocation[];
    goldenRule: string;
    modelUsed: string;
    isAiGenerated: boolean;
    fallbackReason?: string;
  }> {
    const { preferredModel = 'auto', allowFallback = true } = options;

    const allModels = [MODEL_FLASH_DEEP, MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
    let modelsToTry: string[] = [];

    if (preferredModel && preferredModel !== 'auto') {
      if (allowFallback) {
        const remaining = allModels.filter((m) => m !== preferredModel && !isModelQuotaExhausted(m));
        modelsToTry = [preferredModel, ...remaining];
      } else {
        modelsToTry = [preferredModel];
      }
    } else {
      if (isModelQuotaExhausted(MODEL_FLASH_DEEP)) {
        modelsToTry = [MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
      } else {
        modelsToTry = [MODEL_FLASH_DEEP, MODEL_FLASH_LITE, MODEL_FLASH_LATEST];
      }
    }

    const systemPrompt = `You are TrueSpend's Principal Financial Strategist and Payday Auditor.
Your task is to conduct an elite, empowering, and rigorous Financial Cycle Wrap-Up & Payday Retrospective (Report Card).
You review the user's financial performance over their salary cycle with total clarity and zero fluff.
Speak with encouragement, sharp mathematical precision, and tactical advice. All monetary numbers are in MAD (Moroccan Dirham).

Output strict JSON with this schema:
{
  "letterGrade": "A+" | "A" | "A-" | "B+" | "B" | "B-" | "C+" | "C" | "D" | "F",
  "score": number (0-100),
  "verdictTitle": "Short, punchy executive headline summarizing the cycle outcome",
  "executiveSummary": "2-3 comprehensive, compelling paragraphs reviewing their discipline, cash flow, and pacing.",
  "financialPersona": {
    "title": "Archetype title e.g. The Tactical Builder",
    "description": "1 sentence defining their spending style this period",
    "trait": "Key positive character trait",
    "icon": "Relevant single emoji"
  },
  "biggestWins": ["3 concrete, data-backed financial victories achieved this cycle"],
  "financialLeaks": ["3 precise friction points or spending leaks that drained resources"],
  "paydayAllocations": [
    {
      "bucket": "Emergency Buffer" | "Discretionary Daily Allowance" | "Goals & Wealth" | "Debt Settlement",
      "recommendedAmount": number,
      "rationale": "Why this allocation matters for next cycle",
      "actionableStep": "Concrete immediate step to take upon payday"
    }
  ],
  "goldenRule": "One single high-impact behavioral rule to live by during the upcoming cycle"
}`;

    const userPrompt = `Here is the financial data for the cycle "${payload.periodLabel}":
${JSON.stringify(payload, null, 2)}

Provide the complete AI Cycle Wrap-Up and Payday Retrospective.`;

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        const response = await gemini.models.generateContent({
          model,
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        });

        const text = response.text || '';
        const parsed = JSON.parse(text);

        return {
          letterGrade: parsed.letterGrade || payload.letterGrade,
          score: typeof parsed.score === 'number' ? parsed.score : payload.score,
          financialPersona: parsed.financialPersona,
          verdictTitle: parsed.verdictTitle || `Cycle Performance Review: Grade ${payload.letterGrade}`,
          executiveSummary: parsed.executiveSummary || 'You concluded this financial cycle with noticeable progress.',
          biggestWins: Array.isArray(parsed.biggestWins) ? parsed.biggestWins : [],
          financialLeaks: Array.isArray(parsed.financialLeaks) ? parsed.financialLeaks : [],
          paydayAllocations: Array.isArray(parsed.paydayAllocations) ? parsed.paydayAllocations : [],
          goldenRule: parsed.goldenRule || 'Audit your discretionary runway before committing to non-essential purchases.',
          modelUsed: model,
          isAiGenerated: true,
        };
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        if (msg.includes('429') || msg.includes('quota') || msg.includes('exhausted') || msg.includes('ResourceExhausted')) {
          markModelQuotaExhausted(model, 10 * 60 * 1000); // 10 min cooldown
        }
      }
    }

    // Resilient Algorithmic Fallback if AI models are unavailable or rate-limited
    return this.buildAlgorithmicRetrospective(payload, lastError?.message);
  }

  /**
   * High-fidelity algorithmic fallback that calculates genuine wins, leaks, and recommendations.
   */
  private buildAlgorithmicRetrospective(
    payload: any,
    fallbackReason?: string
  ): {
    letterGrade: RetrospectiveLetterGrade;
    score: number;
    financialPersona: any;
    verdictTitle: string;
    executiveSummary: string;
    biggestWins: string[];
    financialLeaks: string[];
    paydayAllocations: CyclePaydayAllocation[];
    goldenRule: string;
    modelUsed: string;
    isAiGenerated: boolean;
    fallbackReason: string;
  } {
    const isSurplus = payload.netSavings >= 0;
    const wins: string[] = [];
    const leaks: string[] = [];

    if (payload.savingsRate >= 20) {
      wins.push(`Surpassed standard wealth benchmarks with a ${payload.savingsRate}% savings rate.`);
    } else if (isSurplus) {
      wins.push(`Maintained positive net cash flow of ${payload.netSavings.toLocaleString()} MAD this cycle.`);
    } else {
      wins.push(`Tracked every outflow accurately across ${payload.elapsedDays} active days.`);
    }

    if (payload.daysUnderAllowanceCount > payload.elapsedDays * 0.6) {
      wins.push(`Disciplined pacing: kept spending below your daily allowance on ${payload.daysUnderAllowanceCount} out of ${payload.elapsedDays} days.`);
    }

    const topCat = payload.topCategories[0];
    if (topCat && topCat.percentUsed <= 100) {
      wins.push(`Protected your ${topCat.category} budget, utilizing only ${topCat.percentUsed}% of allocated funds.`);
    } else {
      wins.push(`Protected emergency reserves without triggering unauthorized buffer withdrawals.`);
    }

    // Identify Leaks
    const overBudgetCat = payload.topCategories.find((c: any) => c.percentUsed > 100);
    if (overBudgetCat) {
      leaks.push(`${overBudgetCat.category} exceeded planned limits, consuming ${overBudgetCat.percentUsed}% of budget (${overBudgetCat.spent.toLocaleString()} MAD).`);
    } else {
      leaks.push(`Variable food and quick-grab purchases accumulated steadily across weekdays.`);
    }

    if (payload.avgDailySpend > payload.dailyAllowance) {
      leaks.push(`Average daily velocity (${payload.avgDailySpend} MAD/day) ran slightly ahead of target allowance (${payload.dailyAllowance} MAD/day).`);
    }

    if (payload.recentBigExpenses && payload.recentBigExpenses.length > 0) {
      const biggest = payload.recentBigExpenses[0];
      leaks.push(`High single-transaction impact: ${biggest.amount} MAD spent on ${biggest.category || 'discretionary items'}.`);
    }

    const allocations: CyclePaydayAllocation[] = [
      {
        bucket: 'Emergency Buffer',
        recommendedAmount: Math.round(payload.totalInflow * 0.1),
        rationale: 'Reinforce liquid baseline before deploying discretionary capital.',
        actionableStep: `Transfer ${Math.round(payload.totalInflow * 0.1)} MAD directly to Savings Wallet on payday.`,
      },
      {
        bucket: 'Discretionary Daily Allowance',
        recommendedAmount: Math.round(payload.dailyAllowance),
        rationale: 'Lock in sustainable daily spending rate for the next 30 days.',
        actionableStep: `Target keeping weekday discretionary outlays under ${Math.round(payload.dailyAllowance)} MAD/day.`,
      },
      {
        bucket: 'Goals & Wealth',
        recommendedAmount: Math.max(0, Math.round(payload.netSavings * 0.5)),
        rationale: 'Compound savings surplus into designated goals or investment portfolios.',
        actionableStep: 'Fund your top priority financial goal within 48 hours of payday.',
      },
    ];

    return {
      letterGrade: payload.letterGrade,
      score: payload.score,
      financialPersona: {
        title: payload.savingsRate >= 15 ? 'The Tactical Builder' : 'The Resilient Balancer',
        description: 'Maintained active oversight over daily transactions and cycle cash flows.',
        trait: 'Mindful & Persistent',
        icon: '🛡️',
      },
      verdictTitle: isSurplus
        ? `Cycle Wrap-Up: Grade ${payload.letterGrade} • ${payload.savingsRate}% Savings Rate`
        : `Cycle Retrospective: Grade ${payload.letterGrade} • Recovery Roadmap Active`,
      executiveSummary: `During the cycle of ${payload.periodLabel}, your total inflows reached ${payload.totalInflow.toLocaleString()} MAD against ${payload.totalOutflow.toLocaleString()} MAD in true economic consumption, resulting in a net surplus of ${payload.netSavings.toLocaleString()} MAD.\n\nYour spending discipline remained solid through ${payload.daysUnderAllowanceCount} on-track days. By focusing on mitigating discretionary leaks in high-velocity categories, your financial runway and compounding potential will expand considerably next cycle.`,
      biggestWins: wins,
      financialLeaks: leaks,
      paydayAllocations: allocations,
      goldenRule: 'Always verify your Safe to Spend balance before making any discretionary purchase over 150 MAD.',
      modelUsed: 'TrueSpend Analytical Engine (Smart Rule Set)',
      isAiGenerated: false,
      fallbackReason: fallbackReason || 'Auto-generated using real cycle performance heuristics',
    };
  }
}

export const cycleRetrospectiveService = new CycleRetrospectiveService();
