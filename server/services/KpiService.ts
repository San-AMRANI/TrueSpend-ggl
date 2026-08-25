import { transactionRepository } from '../repositories/TransactionRepository.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { payrollService } from './PayrollService.js';
import { getCurrentFinancialMonth, getNextPayroll, isInFinancialMonth } from '../../src/lib/financialMonth.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;
    await payrollService.reconcileDuePayrolls(userId);

    const [allTx, payrolls] = await Promise.all([
      transactionRepository.findAllByUserId(userId),
      payrollRepository.findAllByUserId(userId),
    ]);

    const now = new Date();
    const currentFm = getCurrentFinancialMonth(payrolls, now);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    let bankBalance = 0;
    let cashOnHand = 0;
    let openingBankBalance = 0;
    let openingCashOnHand = 0;
    let monthlyExpenses = 0;
    let monthlyIncome = 0;
    let dailySpent = 0;

    const toCalendarDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isExpenseOutflow = (type: string) => type === 'Expense' || type === 'Debt Repayment';
    const applyTransaction = (transaction: (typeof allTx)[number], balances: { bank: number; cash: number }) => {
      const amount = parseFloat(transaction.amount as unknown as string);
      if (transaction.sourceWallet === 'Bank') {
        if (transaction.type === 'Income') balances.bank += amount;
        if (isExpenseOutflow(transaction.type)) balances.bank -= amount;
        if (transaction.type === 'Transfer') { balances.bank -= amount; balances.cash += amount; }
      } else {
        if (transaction.type === 'Income') balances.cash += amount;
        if (isExpenseOutflow(transaction.type)) balances.cash -= amount;
        if (transaction.type === 'Transfer') { balances.cash -= amount; balances.bank += amount; }
      }
    };

    for (const tx of allTx) {
      const txAmount = parseFloat(tx.amount as unknown as string);
      const txDate = new Date(tx.createdAt!);
      const transactionDay = toCalendarDay(txDate);

      if (transactionDay < today) {
        const openingBalances = { bank: openingBankBalance, cash: openingCashOnHand };
        applyTransaction(tx, openingBalances);
        openingBankBalance = openingBalances.bank;
        openingCashOnHand = openingBalances.cash;
      }
      if (transactionDay <= today) {
        const currentBalances = { bank: bankBalance, cash: cashOnHand };
        applyTransaction(tx, currentBalances);
        bankBalance = currentBalances.bank;
        cashOnHand = currentBalances.cash;
      }
      if (currentFm && transactionDay <= today && isInFinancialMonth(txDate, payrolls, currentFm.year, currentFm.month)) {
        if (tx.type === 'Expense') monthlyExpenses += txAmount;
        if (tx.type === 'Income') monthlyIncome += txAmount;
      }
      if (transactionDay.getTime() === today.getTime() && isExpenseOutflow(tx.type)) dailySpent += txAmount;
    }

    let debtRepayments = 0;
    let reimbursements = 0;
    if (currentFm) {
      for (const tx of allTx) {
        const txDate = new Date(tx.createdAt!);
        const transactionDay = toCalendarDay(txDate);
        if (transactionDay > today || !isInFinancialMonth(txDate, payrolls, currentFm.year, currentFm.month)) continue;
        const amount = parseFloat(tx.amount as unknown as string);
        if (tx.type === 'Expense' && ['💳 Debt & Obligations', 'Debt Repayment', 'Loan', '🔄 Transfer', 'Transfer'].includes(tx.category || '')) debtRepayments += amount;
        if (tx.type === 'Income' && ['💳 Debt & Obligations', 'Reimbursement', 'Repayment', 'Refund', '🔄 Transfer', 'Transfer'].includes(tx.category || '')) reimbursements += amount;
      }
    }

    const emergencyBuffer = parseFloat(dbUser.emergencyBuffer as unknown as string) || 0;
    const totalLiquidity = bankBalance + cashOnHand;
    const openingLiquidity = openingBankBalance + openingCashOnHand;
    const nextPayroll = getNextPayroll(payrolls, now);
    const nextPayday = nextPayroll ? new Date(nextPayroll.scheduledFor) : null;
    const daysUntilPayday = nextPayday ? Math.max(0, Math.ceil((nextPayday.getTime() - today.getTime()) / 86_400_000)) : 0;
    const dailyAllowance = daysUntilPayday > 0 ? (openingLiquidity - emergencyBuffer) / daysUntilPayday : 0;
    const dailyRemaining = dailyAllowance - dailySpent;
    const dailyUsagePercent = dailyAllowance > 0 ? (dailySpent / dailyAllowance) * 100 : dailySpent > 0 ? 100 : 0;
    const dailyStatus = dailyRemaining < 0 || dailyUsagePercent >= 100 ? 'critical' : dailyUsagePercent >= 80 ? 'warning' : 'on_track';

    return {
      totalLiquidity,
      bankBalance,
      cashOnHand,
      monthlyExpenses,
      monthlyIncome,
      adjustedTrueSpend: monthlyExpenses - debtRepayments - reimbursements,
      daysUntilPayday,
      dailyAllowance,
      dailySpent,
      dailyRemaining,
      dailyUsagePercent,
      dailyStatus,
      /** Legacy field retained for API compatibility; it is no longer used. */
      payday: null,
      currentFinancialAmount: currentFm ? Number(currentFm.startPayroll.amount) : 0,
      financialPeriodStart: currentFm ? currentFm.start.toISOString() : null,
      financialPeriodEnd: currentFm ? currentFm.end.toISOString() : null,
      nextPayrollDate: nextPayroll ? new Date(nextPayroll.scheduledFor).toISOString() : null,
      financialMonthReady: Boolean(currentFm),
      financialMonthMessage: currentFm ? null : 'Add a payroll for this month and the next month in Financial Calendar to define your financial period.',
      emergencyBuffer,
    };
  }
}

export const kpiService = new KpiService();
