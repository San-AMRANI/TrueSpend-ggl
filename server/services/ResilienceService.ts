import { resilienceRepository, ResilienceProfileData } from '../repositories/ResilienceRepository.js';
import { transactionRepository } from '../repositories/TransactionRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { subscriptionRepository } from '../repositories/SubscriptionRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export interface StressSimulationInput {
  jobLossMonths?: number;
  emergencyExpense?: number;
  inflationRate?: number;
  freezeSubscriptions?: number; // 0 to 100 percentage
  cutDiscretionary?: number; // 0 to 100 percentage
}

export interface ResiliencePillar {
  id: string;
  name: string;
  score: number;
  maxScore: number;
  weight: string;
  status: 'fortress' | 'good' | 'moderate' | 'warning' | 'critical';
  headline: string;
  description: string;
  metric: string;
}

export interface MicroLeakItem {
  category: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
  sampleNotes: string[];
}

export interface ResilienceAuditResult {
  profile: any;
  overallScore: number;
  grade: string;
  gradeLabel: string;
  verdict: string;
  summary: string;
  baseline: {
    liquidBalance: number;
    savingsBalance: number;
    totalAssets: number;
    totalDebtsPayable: number;
    totalDebtsReceivable: number;
    monthlySalary: number;
    monthlyExpenses: number;
    essentialMonthly: number;
    discretionaryMonthly: number;
    subscriptionMonthly: number;
    netMonthlySurplus: number;
    savingsRatePercent: number;
    runwayMonths: number;
    runwayDays: number;
    targetRunwayMonths: number;
    emergencyTargetAmount: number;
  };
  pillars: ResiliencePillar[];
  stressScenarios: {
    jobLoss: {
      testedMonths: number;
      survives: boolean;
      daysRemaining: number;
      cashRemaining: number;
      deficitAmount: number;
      extendedDaysWithFreeze: number;
      verdict: string;
    };
    emergencyShock: {
      testedAmount: number;
      survives: boolean;
      cashRemaining: number;
      bufferPreservationPercent: number;
      shortfall: number;
      verdict: string;
    };
    inflationSurge: {
      testedRate: number;
      newMonthlyExpenses: number;
      newMonthlySurplus: number;
      monthlySurplusErosion: number;
      annualDrag: number;
      verdict: string;
    };
    blackSwan: {
      survives: boolean;
      cashRemaining: number;
      deficitAmount: number;
      verdict: string;
      timelineDescription: string;
    };
  };
  microLeaks: {
    threshold: number;
    totalCount: number;
    totalSpent: number;
    monthlyDrain: number;
    annualProjected: number;
    tenYearCompounded: number;
    workHoursEquivalent: number;
    items: MicroLeakItem[];
  };
  directives: {
    id: string;
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    estimatedBoost: number;
    actionTab?: string;
    actionLabel?: string;
  }[];
}

export class ResilienceService {
  async getAuditForUser(userId: string, dbUser?: any): Promise<ResilienceAuditResult> {
    const profile = await resilienceRepository.findByUserId(userId) || {
      emergencyTargetMonths: 6,
      stressJobLossMonths: 3,
      stressEmergencyExpense: '2500',
      stressInflationRate: '12.0',
      essentialExpensesRatio: '60.0',
      customEssentialMonthly: null,
      microLeakThreshold: '20.0',
      notes: null,
    };

    const [userWallets, allTransactions, allDebts, allSubscriptions, allPayrolls] = await Promise.all([
      walletRepository.findAllByUserId(userId),
      transactionRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      subscriptionRepository.findAllByUserId(userId),
      payrollRepository.findAllByUserId(userId),
    ]);

    // Financial engine state
    const financialState = computeFinancialState({
      transactions: allTransactions as any,
      payrolls: allPayrolls as any,
      debts: allDebts as any,
      budgets: [],
      userSettings: {
        emergencyBuffer: 0,
        salary: Number(dbUser?.salary || 0),
      },
      wallets: userWallets as any,
    });

    // Calculate liquid balance vs savings
    let liquidBalance = 0;
    let savingsBalance = 0;
    userWallets.forEach((w) => {
      const bal = financialState.walletBalances[w.id] ?? Number(w.initialBalance || 0);
      if (w.type === 'Bank' || w.type === 'Cash') {
        liquidBalance += bal;
      } else {
        savingsBalance += bal;
      }
    });

    // Debts
    let totalDebtsPayable = 0;
    let totalDebtsReceivable = 0;
    allDebts.forEach((d) => {
      const rem = Number(d.remainingBalance || 0);
      if (d.status !== 'Cleared') {
        if (d.type === 'Payable') totalDebtsPayable += rem;
        else totalDebtsReceivable += rem;
      }
    });

    // User monthly salary / income
    const salaryConfig = Number(dbUser?.salary || 0);
    let avgMonthlyIncome = salaryConfig;
    if (avgMonthlyIncome <= 0 && allPayrolls.length > 0) {
      const latestPayroll = allPayrolls[0];
      avgMonthlyIncome = Number(latestPayroll.amount || 0);
    }
    if (avgMonthlyIncome <= 0) {
      // Look at past 60 days income
      const nowMs = Date.now();
      const sixtyDaysAgo = nowMs - 60 * 24 * 60 * 60 * 1000;
      const recentIncome = allTransactions
        .filter((t) => t.type === 'Income' && new Date(t.createdAt).getTime() >= sixtyDaysAgo)
        .reduce((sum, t) => sum + Number(t.amount || 0), 0);
      avgMonthlyIncome = recentIncome > 0 ? (recentIncome / 2) : 5000;
    }

    // Monthly Subscription Burn
    let subscriptionMonthly = 0;
    allSubscriptions.filter((s) => s.status === 'active').forEach((s) => {
      const amt = Number(s.amount || 0);
      const cycle = s.billingCycle || 'monthly';
      if (cycle === 'weekly') subscriptionMonthly += amt * 4.33;
      else if (cycle === 'monthly') subscriptionMonthly += amt;
      else if (cycle === 'quarterly') subscriptionMonthly += amt / 3;
      else if (cycle === 'yearly') subscriptionMonthly += amt / 12;
    });

    // Monthly Expenses (from 30-90 days window)
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    const ninetyDaysAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
    const expenses30d = allTransactions
      .filter((t) => t.type === 'Expense' && new Date(t.createdAt).getTime() >= thirtyDaysAgo)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);
    const expenses90d = allTransactions
      .filter((t) => t.type === 'Expense' && new Date(t.createdAt).getTime() >= ninetyDaysAgo)
      .reduce((sum, t) => sum + Number(t.amount || 0), 0);

    let monthlyExpenses = expenses30d > 0 ? expenses30d : (expenses90d > 0 ? expenses90d / 3 : 2500);
    // Ensure monthly expenses is at least equal to subscription monthly
    if (monthlyExpenses < subscriptionMonthly) monthlyExpenses = subscriptionMonthly + 1000;

    const essentialRatio = Number(profile.essentialExpensesRatio || 60);
    let essentialMonthly = profile.customEssentialMonthly !== null && profile.customEssentialMonthly !== undefined
      ? Number(profile.customEssentialMonthly)
      : (monthlyExpenses * (essentialRatio / 100));
    
    // Ensure subscriptions are counted into baseline commitments
    if (essentialMonthly < subscriptionMonthly) {
      essentialMonthly = Math.max(essentialMonthly, subscriptionMonthly);
    }
    const discretionaryMonthly = Math.max(0, monthlyExpenses - essentialMonthly);
    const netMonthlySurplus = avgMonthlyIncome - monthlyExpenses;
    const savingsRatePercent = avgMonthlyIncome > 0 ? Math.max(-100, Math.min(100, (netMonthlySurplus / avgMonthlyIncome) * 100)) : 0;

    // Runway calculations
    const dailyEssentialBurn = essentialMonthly > 0 ? (essentialMonthly / 30) : 50;
    const runwayDays = Math.max(0, Math.floor(liquidBalance / dailyEssentialBurn));
    const runwayMonths = Math.round((runwayDays / 30) * 10) / 10;
    const targetRunwayMonths = Number(profile.emergencyTargetMonths || 6);
    const emergencyTargetAmount = Math.round(targetRunwayMonths * essentialMonthly);

    // Micro-leak scanner (past 90 days)
    const microThreshold = Number(profile.microLeakThreshold || 20);
    const microTransactions = allTransactions.filter(
      (t) => t.type === 'Expense' &&
        new Date(t.createdAt).getTime() >= ninetyDaysAgo &&
        Number(t.amount || 0) > 0 &&
        Number(t.amount || 0) <= microThreshold
    );

    const microCount = microTransactions.length;
    const microTotalSpent = microTransactions.reduce((acc, t) => acc + Number(t.amount || 0), 0);
    const monthlyMicroDrain = Math.round((microTotalSpent / 3) * 10) / 10;
    const annualMicroProjected = Math.round(monthlyMicroDrain * 12);
    // 10 years compounded at 7% = PMT * (((1 + r)^n - 1) / r)
    const rMonth = 0.07 / 12;
    const nMonths = 120;
    const tenYearMicroCompounded = Math.round(monthlyMicroDrain * ((Math.pow(1 + rMonth, nMonths) - 1) / rMonth));
    const hourlyWage = avgMonthlyIncome > 0 ? (avgMonthlyIncome / 160) : 25;
    const workHoursEquivalent = Math.round((monthlyMicroDrain / hourlyWage) * 10) / 10;

    // Group microleaks by category
    const categoryMap = new Map<string, { count: number; total: number; samples: string[] }>();
    microTransactions.forEach((t) => {
      const cat = t.category || 'Uncategorized';
      const existing = categoryMap.get(cat) || { count: 0, total: 0, samples: [] };
      existing.count += 1;
      existing.total += Number(t.amount || 0);
      if (t.notes && existing.samples.length < 3 && !existing.samples.includes(t.notes)) {
        existing.samples.push(t.notes);
      }
      categoryMap.set(cat, existing);
    });

    const microLeakItems: MicroLeakItem[] = Array.from(categoryMap.entries())
      .map(([cat, data]) => ({
        category: cat,
        count: data.count,
        totalAmount: Math.round(data.total * 100) / 100,
        avgAmount: Math.round((data.total / data.count) * 100) / 100,
        sampleNotes: data.samples,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);

    // ─────────────────────────────────────────────────────────────
    // 5 Resilience Pillars Scoring
    // ─────────────────────────────────────────────────────────────

    // Pillar 1: Runway Adequacy (0 to 25 pts)
    let runwayScore = 0;
    let runwayStatus: ResiliencePillar['status'] = 'critical';
    if (runwayMonths >= targetRunwayMonths) {
      runwayScore = 25;
      runwayStatus = 'fortress';
    } else if (runwayMonths >= targetRunwayMonths * 0.75) {
      runwayScore = 21;
      runwayStatus = 'good';
    } else if (runwayMonths >= 3) {
      runwayScore = 16;
      runwayStatus = 'moderate';
    } else if (runwayMonths >= 1) {
      runwayScore = 9;
      runwayStatus = 'warning';
    } else {
      runwayScore = Math.max(1, Math.round(runwayMonths * 6));
      runwayStatus = 'critical';
    }

    // Pillar 2: Debt Shield & Solvency (0 to 20 pts)
    let debtScore = 20;
    let debtStatus: ResiliencePillar['status'] = 'fortress';
    const debtToLiquidRatio = liquidBalance > 0 ? (totalDebtsPayable / liquidBalance) : (totalDebtsPayable > 0 ? 999 : 0);
    if (totalDebtsPayable === 0) {
      debtScore = 20;
      debtStatus = 'fortress';
    } else if (debtToLiquidRatio <= 0.15) {
      debtScore = 18;
      debtStatus = 'good';
    } else if (debtToLiquidRatio <= 0.5) {
      debtScore = 13;
      debtStatus = 'moderate';
    } else if (debtToLiquidRatio <= 1.0) {
      debtScore = 7;
      debtStatus = 'warning';
    } else {
      debtScore = 2;
      debtStatus = 'critical';
    }

    // Pillar 3: Overhead Agility (0 to 20 pts)
    let overheadScore = 20;
    let overheadStatus: ResiliencePillar['status'] = 'good';
    const fixedOverheadRatio = avgMonthlyIncome > 0 ? ((essentialMonthly + subscriptionMonthly) / avgMonthlyIncome) : 0.8;
    if (fixedOverheadRatio <= 0.45) {
      overheadScore = 20;
      overheadStatus = 'fortress';
    } else if (fixedOverheadRatio <= 0.60) {
      overheadScore = 16;
      overheadStatus = 'good';
    } else if (fixedOverheadRatio <= 0.75) {
      overheadScore = 11;
      overheadStatus = 'moderate';
    } else if (fixedOverheadRatio <= 0.90) {
      overheadScore = 6;
      overheadStatus = 'warning';
    } else {
      overheadScore = 2;
      overheadStatus = 'critical';
    }

    // Pillar 4: Savings Velocity & Cash Margin (0 to 20 pts)
    let savingsScore = 0;
    let savingsStatus: ResiliencePillar['status'] = 'critical';
    if (savingsRatePercent >= 30) {
      savingsScore = 20;
      savingsStatus = 'fortress';
    } else if (savingsRatePercent >= 20) {
      savingsScore = 16;
      savingsStatus = 'good';
    } else if (savingsRatePercent >= 10) {
      savingsScore = 12;
      savingsStatus = 'moderate';
    } else if (savingsRatePercent >= 0) {
      savingsScore = 6;
      savingsStatus = 'warning';
    } else {
      savingsScore = 0;
      savingsStatus = 'critical';
    }

    // Pillar 5: Micro-Drain Exposure (0 to 15 pts)
    let leakScore = 15;
    let leakStatus: ResiliencePillar['status'] = 'fortress';
    const leakToExpenseRatio = monthlyExpenses > 0 ? (monthlyMicroDrain / monthlyExpenses) : 0;
    if (leakToExpenseRatio <= 0.05) {
      leakScore = 15;
      leakStatus = 'fortress';
    } else if (leakToExpenseRatio <= 0.12) {
      leakScore = 11;
      leakStatus = 'good';
    } else if (leakToExpenseRatio <= 0.20) {
      leakScore = 7;
      leakStatus = 'moderate';
    } else {
      leakScore = 3;
      leakStatus = 'warning';
    }

    const overallScore = Math.min(100, Math.max(0, runwayScore + debtScore + overheadScore + savingsScore + leakScore));

    let grade = 'BBB';
    let gradeLabel = 'Moderate Resilience';
    let verdict = 'Your finances possess a baseline buffer, but would experience significant strain from unexpected crises.';
    if (overallScore >= 90) {
      grade = 'AAA';
      gradeLabel = 'Fortress Grade';
      verdict = 'Exceptional financial insulation. You can absorb severe multi-month economic shocks without debt.';
    } else if (overallScore >= 78) {
      grade = 'AA';
      gradeLabel = 'Resilient';
      verdict = 'Strong financial shielding. Emergency runway and overhead flexibility provide high shock absorption.';
    } else if (overallScore >= 64) {
      grade = 'A';
      gradeLabel = 'Solid';
      verdict = 'Stable day-to-day position with moderate defensive cushion against typical life surprises.';
    } else if (overallScore >= 50) {
      grade = 'BBB';
      gradeLabel = 'Vulnerable';
      verdict = 'Limited liquid breathing room. A job interruption or major emergency would deplete reserves rapidly.';
    } else if (overallScore >= 35) {
      grade = 'BB';
      gradeLabel = 'Fragile';
      verdict = 'High sensitivity to cash flow disruptions. Emergency runway is thin and requires immediate fortification.';
    } else {
      grade = 'CCC';
      gradeLabel = 'High Crisis Risk';
      verdict = 'Critical vulnerability. Any disruption would immediately force borrowing or negative cash flow.';
    }

    const summary = `${runwayMonths} months liquid runway (${runwayDays} days) · ${savingsRatePercent >= 0 ? '+' : ''}${Math.round(savingsRatePercent)}% monthly savings rate · ${totalDebtsPayable > 0 ? `$${totalDebtsPayable} debt obligations` : 'Zero payable debt'}.`;

    const pillars: ResiliencePillar[] = [
      {
        id: 'runway',
        name: 'Liquidity & Runway Defense',
        score: runwayScore,
        maxScore: 25,
        weight: '25%',
        status: runwayStatus,
        headline: `${runwayMonths} mo / ${targetRunwayMonths} mo target`,
        description: `Liquid assets cover ${runwayDays} days of essential expenses ($${Math.round(essentialMonthly)}/mo).`,
        metric: `${runwayMonths} Months`,
      },
      {
        id: 'debt',
        name: 'Debt Shield & Solvency',
        score: debtScore,
        maxScore: 20,
        weight: '20%',
        status: debtStatus,
        headline: totalDebtsPayable === 0 ? 'Debt-Free Shield' : `$${totalDebtsPayable} Total Obligations`,
        description: totalDebtsPayable === 0
          ? 'No outstanding liabilities draining your cash flows.'
          : `Liabilities represent ${Math.round(debtToLiquidRatio * 100)}% of your available liquid reserves.`,
        metric: totalDebtsPayable === 0 ? '0%' : `${Math.round(debtToLiquidRatio * 100)}% of Cash`,
      },
      {
        id: 'overhead',
        name: 'Overhead & Subscription Agility',
        score: overheadScore,
        maxScore: 20,
        weight: '20%',
        status: overheadStatus,
        headline: `${Math.round(fixedOverheadRatio * 100)}% Fixed Commitments`,
        description: `Essential living expenses and $${Math.round(subscriptionMonthly)}/mo recurring subscriptions consume ${Math.round(fixedOverheadRatio * 100)}% of gross income.`,
        metric: `${Math.round(fixedOverheadRatio * 100)}% of Income`,
      },
      {
        id: 'savings',
        name: 'Savings Velocity & Surplus',
        score: savingsScore,
        maxScore: 20,
        weight: '20%',
        status: savingsStatus,
        headline: `${savingsRatePercent >= 0 ? '+' : ''}${Math.round(savingsRatePercent)}% Net Savings Pace`,
        description: netMonthlySurplus >= 0
          ? `You retain $${Math.round(netMonthlySurplus)} net cash surplus every month to compound and fortify.`
          : `Current spending exceeds income by $${Math.abs(Math.round(netMonthlySurplus))}/mo.`,
        metric: `$${Math.round(netMonthlySurplus)}/mo`,
      },
      {
        id: 'micro_leak',
        name: 'Micro-Drain & Habit Guard',
        score: leakScore,
        maxScore: 15,
        weight: '15%',
        status: leakStatus,
        headline: `$${monthlyMicroDrain}/mo in micro-purchases`,
        description: `Charges under $${microThreshold} represent ${Math.round(leakToExpenseRatio * 100)}% of monthly burn ($${annualMicroProjected}/yr).`,
        metric: `$${monthlyMicroDrain}/mo`,
      },
    ];

    // ─────────────────────────────────────────────────────────────
    // Stress Test Simulations
    // ─────────────────────────────────────────────────────────────

    // Scenario 1: Job Loss (Sudden Income Halt)
    const testJobLossMonths = Number(profile.stressJobLossMonths || 3);
    const totalJobLossDrain = essentialMonthly * testJobLossMonths;
    const jobLossCashRemaining = liquidBalance - totalJobLossDrain;
    const jobLossSurvives = jobLossCashRemaining >= 0;
    const jobLossDaysRemaining = Math.max(0, Math.floor(liquidBalance / dailyEssentialBurn));
    // What if subscriptions were paused during job loss?
    const extendedDaysWithFreeze = subscriptionMonthly > 0
      ? Math.max(0, Math.floor((liquidBalance) / ((essentialMonthly - subscriptionMonthly) / 30)) - jobLossDaysRemaining)
      : 0;

    // Scenario 2: Emergency Expense Shock
    const testEmergencyShock = Number(profile.stressEmergencyExpense || 2500);
    const shockCashRemaining = liquidBalance - testEmergencyShock;
    const shockSurvives = shockCashRemaining >= 0;
    const bufferPreservationPercent = emergencyTargetAmount > 0
      ? Math.max(0, Math.min(100, Math.round((Math.max(0, shockCashRemaining) / emergencyTargetAmount) * 100)))
      : 0;

    // Scenario 3: Stagflation & Cost-of-Living Surge
    const testInflationRate = Number(profile.stressInflationRate || 12.0);
    const inflationMonthlyIncrease = essentialMonthly * (testInflationRate / 100);
    const newMonthlyExpenses = monthlyExpenses + inflationMonthlyIncrease;
    const newMonthlySurplus = avgMonthlyIncome - newMonthlyExpenses;
    const annualDrag = Math.round(inflationMonthlyIncrease * 12);

    // Scenario 4: Black Swan Multi-Crisis
    const blackSwanDrain = (essentialMonthly * 2) + testEmergencyShock + (essentialMonthly * 2 * (testInflationRate / 100));
    const blackSwanRemaining = liquidBalance - blackSwanDrain;
    const blackSwanSurvives = blackSwanRemaining >= 0;

    // ─────────────────────────────────────────────────────────────
    // Tactical Directives
    // ─────────────────────────────────────────────────────────────
    const directives: ResilienceAuditResult['directives'] = [];

    if (runwayMonths < targetRunwayMonths) {
      const gapAmount = Math.max(0, emergencyTargetAmount - liquidBalance);
      directives.push({
        id: 'fortify_runway',
        priority: 'high',
        title: `Extend liquid runway to ${targetRunwayMonths} months`,
        description: `Deposit $${gapAmount} into your emergency buffer to withstand a prolonged disruption without touching credit.`,
        estimatedBoost: Math.min(12, Math.round((targetRunwayMonths - runwayMonths) * 3)),
        actionTab: 'goals',
        actionLabel: 'Create Emergency Goal',
      });
    }

    if (subscriptionMonthly > 120) {
      directives.push({
        id: 'trim_subscriptions',
        priority: 'medium',
        title: 'Audit recurring subscriptions radar',
        description: `You have $${Math.round(subscriptionMonthly)}/mo committed to recurring subscriptions. Pausing or trimming non-essentials buys ${Math.round(subscriptionMonthly / dailyEssentialBurn)} extra survival days each month.`,
        estimatedBoost: 5,
        actionTab: 'subscriptions',
        actionLabel: 'Review Subscriptions',
      });
    }

    if (monthlyMicroDrain > 80) {
      directives.push({
        id: 'shield_micro_leaks',
        priority: 'medium',
        title: `Cap micro-transactions (<$${microThreshold})`,
        description: `Small frequent taps add up to $${monthlyMicroDrain}/mo ($${annualMicroProjected}/yr). Route temptation through Impulse Shield to save ~$${Math.round(monthlyMicroDrain * 0.4)}/mo.`,
        estimatedBoost: 6,
        actionTab: 'impulse-shield',
        actionLabel: 'Open Impulse Shield',
      });
    }

    if (totalDebtsPayable > 0) {
      directives.push({
        id: 'settle_debts',
        priority: totalDebtsPayable > liquidBalance * 0.3 ? 'high' : 'low',
        title: 'Accelerate debt payoff to eliminate cash flow drag',
        description: `Settling $${totalDebtsPayable} in pending liabilities eliminates interest and frees up immediate risk capacity.`,
        estimatedBoost: 8,
        actionTab: 'debts',
        actionLabel: 'View Debts & Splits',
      });
    }

    if (netMonthlySurplus < 0) {
      directives.push({
        id: 'plug_cash_bleed',
        priority: 'high',
        title: 'Plug monthly cash deficit',
        description: `Current spending exceeds income by $${Math.abs(Math.round(netMonthlySurplus))}/mo. Rebalance category budgets immediately.`,
        estimatedBoost: 14,
        actionTab: 'budgets',
        actionLabel: 'Adjust Budgets',
      });
    }

    return {
      profile,
      overallScore,
      grade,
      gradeLabel,
      verdict,
      summary,
      baseline: {
        liquidBalance: Math.round(liquidBalance * 100) / 100,
        savingsBalance: Math.round(savingsBalance * 100) / 100,
        totalAssets: Math.round((liquidBalance + savingsBalance) * 100) / 100,
        totalDebtsPayable: Math.round(totalDebtsPayable * 100) / 100,
        totalDebtsReceivable: Math.round(totalDebtsReceivable * 100) / 100,
        monthlySalary: Math.round(avgMonthlyIncome * 100) / 100,
        monthlyExpenses: Math.round(monthlyExpenses * 100) / 100,
        essentialMonthly: Math.round(essentialMonthly * 100) / 100,
        discretionaryMonthly: Math.round(discretionaryMonthly * 100) / 100,
        subscriptionMonthly: Math.round(subscriptionMonthly * 100) / 100,
        netMonthlySurplus: Math.round(netMonthlySurplus * 100) / 100,
        savingsRatePercent: Math.round(savingsRatePercent * 10) / 10,
        runwayMonths,
        runwayDays,
        targetRunwayMonths,
        emergencyTargetAmount,
      },
      pillars,
      stressScenarios: {
        jobLoss: {
          testedMonths: testJobLossMonths,
          survives: jobLossSurvives,
          daysRemaining: jobLossDaysRemaining,
          cashRemaining: Math.round(jobLossCashRemaining * 100) / 100,
          deficitAmount: jobLossSurvives ? 0 : Math.round(Math.abs(jobLossCashRemaining) * 100) / 100,
          extendedDaysWithFreeze,
          verdict: jobLossSurvives
            ? `Your reserves sustain ${testJobLossMonths} full months of job interruption with $${Math.round(jobLossCashRemaining)} cushion remaining.`
            : `Cash depletes after ${jobLossDaysRemaining} days (${Math.round((jobLossDaysRemaining / 30) * 10) / 10} months), resulting in a $${Math.round(Math.abs(jobLossCashRemaining))} deficit.`,
        },
        emergencyShock: {
          testedAmount: testEmergencyShock,
          survives: shockSurvives,
          cashRemaining: Math.round(shockCashRemaining * 100) / 100,
          bufferPreservationPercent,
          shortfall: shockSurvives ? 0 : Math.round(Math.abs(shockCashRemaining) * 100) / 100,
          verdict: shockSurvives
            ? `Emergency of $${testEmergencyShock} absorbed without debt. $${Math.round(shockCashRemaining)} cash cushion preserved (${bufferPreservationPercent}% of target).`
            : `Insufficient liquid funds for a $${testEmergencyShock} surprise. You would face a $${Math.round(Math.abs(shockCashRemaining))} immediate funding gap.`,
        },
        inflationSurge: {
          testedRate: testInflationRate,
          newMonthlyExpenses: Math.round(newMonthlyExpenses * 100) / 100,
          newMonthlySurplus: Math.round(newMonthlySurplus * 100) / 100,
          monthlySurplusErosion: Math.round(inflationMonthlyIncrease * 100) / 100,
          annualDrag,
          verdict: newMonthlySurplus >= 0
            ? `A +${testInflationRate}% inflation surge on essentials cuts your monthly surplus by $${Math.round(inflationMonthlyIncrease)}/mo, but remains net positive ($${Math.round(newMonthlySurplus)}/mo).`
            : `A +${testInflationRate}% inflation surge pushes cash flow into a negative deficit of -$${Math.abs(Math.round(newMonthlySurplus))}/mo ($${annualDrag}/yr erosion).`,
        },
        blackSwan: {
          survives: blackSwanSurvives,
          cashRemaining: Math.round(blackSwanRemaining * 100) / 100,
          deficitAmount: blackSwanSurvives ? 0 : Math.round(Math.abs(blackSwanRemaining) * 100) / 100,
          verdict: blackSwanSurvives
            ? `Your balance can withstand simultaneous 2-month income loss, $${testEmergencyShock} disaster expense, and +${testInflationRate}% inflation surge.`
            : `Compounded crisis exceeds reserves by $${Math.round(Math.abs(blackSwanRemaining))}. Immediate contingency actions are recommended.`,
          timelineDescription: `Simulated: 60 days zero income + $${testEmergencyShock} out-of-pocket shock + ${testInflationRate}% cost-of-living rise.`,
        },
      },
      microLeaks: {
        threshold: microThreshold,
        totalCount: microCount,
        totalSpent: Math.round(microTotalSpent * 100) / 100,
        monthlyDrain: monthlyMicroDrain,
        annualProjected: annualMicroProjected,
        tenYearCompounded: tenYearMicroCompounded,
        workHoursEquivalent,
        items: microLeakItems,
      },
      directives,
    };
  }

  async updateProfile(userId: string, data: ResilienceProfileData) {
    return await resilienceRepository.upsert(userId, data);
  }

  async simulateCustom(userId: string, input: StressSimulationInput, dbUser?: any) {
    const audit = await this.getAuditForUser(userId, dbUser);
    const { baseline } = audit;

    const jobLossMonths = Number(input.jobLossMonths ?? 3);
    const emergencyExpense = Number(input.emergencyExpense ?? 2500);
    const inflationRate = Number(input.inflationRate ?? 12.0);
    const freezeSubsPercent = Math.max(0, Math.min(100, Number(input.freezeSubscriptions ?? 0))) / 100;
    const cutDiscretionaryPercent = Math.max(0, Math.min(100, Number(input.cutDiscretionary ?? 0))) / 100;

    // Adjusted expenses
    const adjustedSubsMonthly = baseline.subscriptionMonthly * (1 - freezeSubsPercent);
    const adjustedDiscretionaryMonthly = baseline.discretionaryMonthly * (1 - cutDiscretionaryPercent);
    const adjustedEssentialMonthly = (baseline.essentialMonthly - baseline.subscriptionMonthly) + adjustedSubsMonthly;
    const inflationIncrease = adjustedEssentialMonthly * (inflationRate / 100);
    const simulatedMonthlyBurn = adjustedEssentialMonthly + adjustedDiscretionaryMonthly + inflationIncrease;

    // Simulation outcomes
    const totalSimulatedDrain = (simulatedMonthlyBurn * jobLossMonths) + emergencyExpense;
    const projectedEndingCash = baseline.liquidBalance - totalSimulatedDrain;
    const survives = projectedEndingCash >= 0;
    const dailySimBurn = simulatedMonthlyBurn / 30;
    const customRunwayDays = dailySimBurn > 0 ? Math.max(0, Math.floor(baseline.liquidBalance / dailySimBurn)) : 999;
    const customRunwayMonths = Math.round((customRunwayDays / 30) * 10) / 10;

    return {
      input: {
        jobLossMonths,
        emergencyExpense,
        inflationRate,
        freezeSubscriptions: freezeSubsPercent * 100,
        cutDiscretionary: cutDiscretionaryPercent * 100,
      },
      baseline: {
        liquidBalance: baseline.liquidBalance,
        originalMonthlyBurn: baseline.monthlyExpenses,
      },
      simulatedMonthlyBurn: Math.round(simulatedMonthlyBurn * 100) / 100,
      totalSimulatedDrain: Math.round(totalSimulatedDrain * 100) / 100,
      projectedEndingCash: Math.round(projectedEndingCash * 100) / 100,
      survives,
      shortfall: survives ? 0 : Math.round(Math.abs(projectedEndingCash) * 100) / 100,
      runwayDays: customRunwayDays,
      runwayMonths: customRunwayMonths,
      monthlySavingsFromAdjustments: Math.round((baseline.monthlyExpenses - simulatedMonthlyBurn) * 100) / 100,
    };
  }
}

export const resilienceService = new ResilienceService();
