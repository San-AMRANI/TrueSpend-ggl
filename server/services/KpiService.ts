import { transactionRepository } from '../repositories/TransactionRepository.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;
    let allTx = await transactionRepository.findAllByUserId(userId);

    const salary = parseFloat(dbUser.salary as unknown as string) || 0;
    const payday = dbUser.payday || 25;
    
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (salary > 0 && now.getDate() >= payday) {
      const hasSalaryThisMonth = allTx.some(tx => {
        const txDate = new Date(tx.createdAt!);
        return txDate.getMonth() === currentMonth && 
               txDate.getFullYear() === currentYear && 
               tx.type === 'Income' && 
               (tx.category === '📥 Income' || tx.category === 'Salary') && 
               tx.notes === 'Auto-deposited salary';
      });

      if (!hasSalaryThisMonth) {
        await transactionRepository.create({
          userId,
          amount: salary.toString(),
          type: 'Income',
          sourceWallet: 'Bank',
          category: '📥 Income',
          notes: 'Auto-deposited salary',
          createdAt: new Date(currentYear, currentMonth, payday, 9, 0, 0), // 9 AM on payday
        });
        allTx = await transactionRepository.findAllByUserId(userId); // reload
      }
    }

    let bankBalance = 0;
    let cashOnHand = 0;
    let openingBankBalance = 0;
    let openingCashOnHand = 0;
    let monthlyExpenses = 0;
    let monthlyIncome = 0;
    let dailySpent = 0;

    const toCalendarDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const isExpenseOutflow = (type: string) => type === 'Expense' || type === 'Debt Repayment';
    const applyTransaction = (
      transaction: (typeof allTx)[number],
      balances: { bank: number; cash: number },
    ) => {
      const amount = parseFloat(transaction.amount as unknown as string);

      if (transaction.sourceWallet === 'Bank') {
        if (transaction.type === 'Income') balances.bank += amount;
        if (isExpenseOutflow(transaction.type)) balances.bank -= amount;
        if (transaction.type === 'Transfer') {
          balances.bank -= amount;
          balances.cash += amount;
        }
      } else if (transaction.sourceWallet === 'Cash') {
        if (transaction.type === 'Income') balances.cash += amount;
        if (isExpenseOutflow(transaction.type)) balances.cash -= amount;
        if (transaction.type === 'Transfer') {
          balances.cash -= amount;
          balances.bank += amount;
        }
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

      if (transactionDay <= today && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.type === 'Expense') monthlyExpenses += txAmount;
        if (tx.type === 'Income') monthlyIncome += txAmount;
      }

      if (transactionDay.getTime() === today.getTime() && isExpenseOutflow(tx.type)) {
        dailySpent += txAmount;
      }
    }

    let debtRepayments = 0;
    let reimbursements = 0;

    for (const tx of allTx) {
      const txDate = new Date(tx.createdAt!);
      const transactionDay = toCalendarDay(txDate);
      if (transactionDay <= today && txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const txAmount = parseFloat(tx.amount as unknown as string);
        if (tx.type === 'Expense' && (tx.category === '💳 Debt & Obligations' || tx.category === 'Debt Repayment' || tx.category === 'Loan' || tx.category === '🔄 Transfer' || tx.category === 'Transfer')) {
          debtRepayments += txAmount;
        }
        if (tx.type === 'Income' && (tx.category === '💳 Debt & Obligations' || tx.category === 'Reimbursement' || tx.category === 'Repayment' || tx.category === 'Refund' || tx.category === '🔄 Transfer' || tx.category === 'Transfer')) {
          reimbursements += txAmount;
        }
      }
    }

    const emergencyBuffer = parseFloat(dbUser.emergencyBuffer as unknown as string) || 0;
    const totalLiquidity = bankBalance + cashOnHand;
    const openingLiquidity = openingBankBalance + openingCashOnHand;
    const openingAvailableLiquidity = openingLiquidity - emergencyBuffer;

    
    let nextPayday = new Date(now.getFullYear(), now.getMonth(), payday);
    if (now.getDate() >= payday) {
      nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday);
    }
    const diff = Math.ceil((nextPayday.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilPayday = diff > 0 ? diff : 1;
    const dailyAllowance = openingAvailableLiquidity / daysUntilPayday;
    const dailyRemaining = dailyAllowance - dailySpent;
    const dailyUsagePercent = dailyAllowance > 0 ? (dailySpent / dailyAllowance) * 100 : dailySpent > 0 ? 100 : 0;
    const dailyStatus = dailyRemaining < 0 || dailyUsagePercent >= 100
      ? 'critical'
      : dailyUsagePercent >= 80
        ? 'warning'
        : 'on_track';

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
      payday,
      emergencyBuffer
    };
  }
}

export const kpiService = new KpiService();
