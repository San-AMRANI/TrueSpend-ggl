import { format, parseISO } from 'date-fns';
import { Transaction, Payroll, Wallet } from '../types';
import {
  getFinancialPeriods,
  financialPeriodLabel,
  financialMonthLabel,
  type PayrollLike,
} from './financialMonth';
import {
  netExpenseOf,
  reimbursedAmountOf,
  isReimbursementIncome,
  isInvestmentTransaction,
  getCategoryPillar,
  isSavingsRetentionCategory,
} from './finance';

export interface HistoricalCashFlowDay {
  date: string;
  openingBalance: number;
  netChange: number;
  closingBalance: number;
  transactions: Transaction[];
}

export interface FinancialPeriodLedgerEntry {
  /** Period label matching financialPeriodLabel(p), e.g. "Sep 24 – Oct 22, 2026" */
  label: string;
  /** Month name label, e.g. "October 2026" */
  monthNameLabel: string;
  /** Combined display label, e.g. "Sep 24 – Oct 22, 2026 (October Cycle)" */
  displayLabel: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  year: number;
  month: number;
  isCurrent: boolean;
  isFuture: boolean;
  /** Exact total liquidity at the start of the period (before period transactions) */
  openingLiquidity: number;
  /** Exact total liquidity at the end of the period (or current live liquidity if active) */
  closingLiquidity: number;
  /** Base salary / payroll income in this period */
  salaryIncome: number;
  /** Reimbursements & other non-payroll income in this period */
  otherIncome: number;
  /** Total cash inflow in this period */
  totalIncome: number;
  /** Actual cash leaving wallets (Gross Expense + Debt Repayment) */
  grossOutflow: number;
  /** Net living expenses (after deducting reimbursable splits & excluding investment transfers) */
  netLivingExpense: number;
  /** Pillar 1: Personal & Lifestyle spend on yourself (Dining, Coffee, Clothing, Entertainment, Social) */
  spentOnMyself: number;
  /** Pillar 2: Essential Needs, Household/Family, Bills & Debt obligations */
  spentOnObligations: number;
  /** Reimbursable split portion fronted for others during this period */
  reimbursableAmount: number;
  /** Debt repayments made in this period */
  debtRepayments: number;
  /** Capital deployed to Investment wallets / categories in this period */
  investmentDeployed: number;
  /** True wallet liquidity change during the period: totalIncome - grossOutflow === closingLiquidity - openingLiquidity */
  netCashflowSaved: number;
  /** Net economic savings when counting reimbursables as non-expense: totalIncome - (netLivingExpense + debtRepayments) */
  netEconomicSaved: number;
  /** Cash savings rate %: (netCashflowSaved / totalIncome) * 100 */
  cashSavingsRate: number;
  /** Economic savings rate %: (netEconomicSaved / totalIncome) * 100 */
  economicSavingsRate: number;
  transactionCount: number;
}

const toDateStr = (val: string | Date): string => {
  if (!val) return '';
  if (typeof val === 'string') {
    try {
      return format(parseISO(val), 'yyyy-MM-dd');
    } catch {
      return val.slice(0, 10);
    }
  }
  return format(val, 'yyyy-MM-dd');
};

export function generateHistoricalCashFlow(
  transactions: Transaction[],
  currentTotalLiquidity: number
): HistoricalCashFlowDay[] {
  // Group transactions by date (YYYY-MM-DD)
  const grouped = new Map<string, Transaction[]>();

  transactions.forEach((t) => {
    const d = toDateStr(t.createdAt);
    if (!d) return;
    if (!grouped.has(d)) grouped.set(d, []);
    grouped.get(d)!.push(t);
  });

  // Get all unique dates, plus today
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const allDates = Array.from(grouped.keys());
  if (!allDates.includes(todayStr)) allDates.push(todayStr);

  // Sort dates descending (newest first)
  allDates.sort((a, b) => b.localeCompare(a));

  const days: HistoricalCashFlowDay[] = [];
  let runningBalance = currentTotalLiquidity;

  for (const dateStr of allDates) {
    const dayTx = grouped.get(dateStr) || [];

    let netChange = 0;
    dayTx.forEach((t) => {
      const amt = parseFloat(t.amount) || 0;
      if (t.type === 'Income') netChange += amt;
      else if (t.type === 'Expense') netChange -= amt;
      else if (t.type === 'Debt Repayment') netChange -= amt;
    });

    const closingBalance = runningBalance;
    const openingBalance = closingBalance - netChange;

    days.push({
      date: dateStr,
      openingBalance,
      netChange,
      closingBalance,
      transactions: dayTx,
    });

    // The opening balance of this day becomes the closing balance of the previous (older) day
    runningBalance = openingBalance;
  }

  return days;
}

/**
 * Computes the exact historical ledger for every configured financial period,
 * guaranteeing 100% reconciliation with `generateHistoricalCashFlow`:
 *   openingLiquidity + netCashflowSaved === closingLiquidity
 *   and each period's closingLiquidity === the next period's openingLiquidity.
 */
export function generateFinancialPeriodsLedger(
  transactions: Transaction[],
  payrolls: (Payroll | PayrollLike)[],
  currentTotalLiquidity: number,
  wallets: Wallet[] = []
): FinancialPeriodLedgerEntry[] {
  const periods = getFinancialPeriods(payrolls);
  if (periods.length === 0) return [];

  const cashFlowDays = generateHistoricalCashFlow(transactions, currentTotalLiquidity);
  // Ascending chronological order of cash flow days
  const daysAsc = cashFlowDays.slice().reverse();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const getBalanceBeforeDate = (dateStr: string): number => {
    // Find first transaction day on or after dateStr; its openingBalance is the exact balance before dateStr
    const firstOnOrAfter = daysAsc.find((d) => d.date >= dateStr);
    if (firstOnOrAfter) return firstOnOrAfter.openingBalance;
    // If all transactions are before dateStr, return the latest closing balance
    return daysAsc.length > 0 ? daysAsc[daysAsc.length - 1].closingBalance : currentTotalLiquidity;
  };

  const getBalanceAtEndOfDate = (dateStr: string): number => {
    // Find the latest transaction day on or before dateStr; its closingBalance is the exact balance at the end of dateStr
    for (let i = daysAsc.length - 1; i >= 0; i--) {
      if (daysAsc[i].date <= dateStr) {
        return daysAsc[i].closingBalance;
      }
    }
    return daysAsc.length > 0 ? daysAsc[0].openingBalance : currentTotalLiquidity;
  };

  return periods.map((p) => {
    const startStr = format(p.start, 'yyyy-MM-dd');
    const endStr = format(p.end, 'yyyy-MM-dd');
    const isCurrent = todayStr >= startStr && todayStr <= endStr;
    const isFuture = startStr > todayStr;

    const periodTxs = transactions.filter((t) => {
      const d = toDateStr(t.createdAt);
      return d >= startStr && d <= endStr;
    });

    let salaryIncome = 0;
    let otherIncome = 0;
    let reimbursementInflow = 0;
    let totalIncome = 0;
    let grossOutflow = 0;
    let netLivingExpense = 0;
    let spentOnMyself = 0;
    let spentOnObligations = 0;
    let reimbursableAmount = 0;
    let debtRepayments = 0;
    let investmentDeployed = 0;

    for (const tx of periodTxs) {
      const amt = parseFloat(tx.amount) || 0;
      const isInvest = isInvestmentTransaction(tx, wallets);
      const srcWallet = wallets.find((w) => w.id === tx.walletId);
      const isFromInvWallet = srcWallet?.type === 'Investment';

      if (tx.type === 'Income') {
        if (isReimbursementIncome(tx)) {
          reimbursementInflow += amt;
        } else {
          totalIncome += amt;
          const catLower = (tx.category || '').toLowerCase();
          const notesLower = (tx.notes || '').toLowerCase();
          if (
            tx.payrollId ||
            catLower.includes('salary') ||
            catLower.includes('payroll') ||
            notesLower.includes('salary') ||
            notesLower.includes('payroll') ||
            Math.abs(amt - (parseFloat(String(p.startPayroll?.amount || 0)) || 0)) < 1
          ) {
            salaryIncome += amt;
          } else {
            otherIncome += amt;
          }
        }
      } else if (tx.type === 'Expense') {
        grossOutflow += amt;
        const netAmt = netExpenseOf(tx);
        if (isInvest) {
          if (!isFromInvWallet) {
            investmentDeployed += netAmt;
          }
        } else if (isSavingsRetentionCategory(tx.category)) {
          // Explicit savings transaction — not a living consumption expense
        } else if (
          ['💳 Debt & Obligations', 'Debt Repayment', 'Loan'].includes(tx.category || '')
        ) {
          debtRepayments += amt;
          spentOnObligations += amt;
        } else {
          netLivingExpense += netAmt;
          const pillar = getCategoryPillar(tx.category);
          if (pillar === 'myself') {
            spentOnMyself += netAmt;
          } else {
            spentOnObligations += netAmt;
          }
        }

        const reimbAmt = reimbursedAmountOf(tx);
        if (reimbAmt > 0) {
          reimbursableAmount += reimbAmt;
        }
      } else if (tx.type === 'Debt Repayment') {
        grossOutflow += amt;
        debtRepayments += amt;
        spentOnObligations += amt;
      } else if (tx.type === 'Transfer' && isInvest && !isFromInvWallet) {
        investmentDeployed += amt;
      }
    }

    // If no income transaction explicitly matched salary, fallback to startPayroll amount if totalIncome >= startPayroll
    const configuredPayrollAmt = parseFloat(String(p.startPayroll?.amount || 0)) || 0;
    if (salaryIncome === 0 && configuredPayrollAmt > 0 && totalIncome >= configuredPayrollAmt) {
      salaryIncome = configuredPayrollAmt;
      otherIncome = Math.max(0, totalIncome - salaryIncome);
    }

    const openingLiquidity = isFuture
      ? currentTotalLiquidity
      : Math.round(getBalanceBeforeDate(startStr) * 100) / 100;

    const effectiveEndStr = isCurrent ? todayStr : endStr;
    const closingLiquidity = isFuture
      ? currentTotalLiquidity
      : isCurrent
      ? Math.round(currentTotalLiquidity * 100) / 100
      : Math.round(getBalanceAtEndOfDate(effectiveEndStr) * 100) / 100;

    // Physical wallet cashflow change includes physical reimbursement inflows vs gross outflow
    const netCashflowSaved = Math.round((totalIncome + reimbursementInflow - grossOutflow) * 100) / 100;
    // Economic net savings is pure Net Income minus Net Living Expenses and Debt Repayments
    const netEconomicSaved =
      Math.round((totalIncome - (netLivingExpense + debtRepayments)) * 100) / 100;
    const cashSavingsRate = totalIncome > 0 ? (netCashflowSaved / totalIncome) * 100 : 0;
    const economicSavingsRate = totalIncome > 0 ? (netEconomicSaved / totalIncome) * 100 : 0;

    const label = financialPeriodLabel(p);
    const monthNameLabel = financialMonthLabel(p.year, p.month);

    return {
      label,
      monthNameLabel,
      displayLabel: `${label} (${monthNameLabel})`,
      startDate: startStr,
      endDate: endStr,
      year: p.year,
      month: p.month,
      isCurrent,
      isFuture,
      openingLiquidity,
      closingLiquidity,
      salaryIncome: Math.round(salaryIncome * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      grossOutflow: Math.round(grossOutflow * 100) / 100,
      netLivingExpense: Math.round(netLivingExpense * 100) / 100,
      spentOnMyself: Math.round(spentOnMyself * 100) / 100,
      spentOnObligations: Math.round(spentOnObligations * 100) / 100,
      reimbursableAmount: Math.round(reimbursableAmount * 100) / 100,
      debtRepayments: Math.round(debtRepayments * 100) / 100,
      investmentDeployed: Math.round(investmentDeployed * 100) / 100,
      netCashflowSaved,
      netEconomicSaved,
      cashSavingsRate: Math.round(cashSavingsRate * 10) / 10,
      economicSavingsRate: Math.round(economicSavingsRate * 10) / 10,
      transactionCount: periodTxs.length,
    };
  });
}

