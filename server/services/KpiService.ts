import { transactionRepository } from '../repositories/TransactionRepository.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;
    const allTx = await transactionRepository.findAllByUserId(userId);

    let bankBalance = 0;
    let cashOnHand = 0;
    let monthlyExpenses = 0;
    let monthlyIncome = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    for (const tx of allTx) {
      const txAmount = parseFloat(tx.amount as unknown as string);
      const txDate = new Date(tx.createdAt!);

      if (tx.sourceWallet === 'Bank') {
        if (tx.type === 'Income') bankBalance += txAmount;
        if (tx.type === 'Expense') bankBalance -= txAmount;
        if (tx.type === 'Transfer') {
          bankBalance -= txAmount;
          cashOnHand += txAmount;
        }
        if (tx.type === 'Debt Repayment') bankBalance -= txAmount;
      } else if (tx.sourceWallet === 'Cash') {
        if (tx.type === 'Income') cashOnHand += txAmount;
        if (tx.type === 'Expense') cashOnHand -= txAmount;
        if (tx.type === 'Transfer') {
          cashOnHand -= txAmount;
          bankBalance += txAmount;
        }
        if (tx.type === 'Debt Repayment') cashOnHand -= txAmount;
      }

      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        if (tx.type === 'Expense') monthlyExpenses += txAmount;
        if (tx.type === 'Income') monthlyIncome += txAmount;
      }
    }

    let debtRepayments = 0;
    let reimbursements = 0;

    for (const tx of allTx) {
      const txDate = new Date(tx.createdAt!);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const txAmount = parseFloat(tx.amount as unknown as string);
        if (tx.type === 'Expense' && (tx.category === 'Debt Repayment' || tx.category === 'Loan' || tx.category === 'Transfer')) {
          debtRepayments += txAmount;
        }
        if (tx.type === 'Income' && (tx.category === 'Reimbursement' || tx.category === 'Repayment' || tx.category === 'Refund' || tx.category === 'Transfer')) {
          reimbursements += txAmount;
        }
      }
    }

    const emergencyBuffer = parseFloat(dbUser.emergencyBuffer as unknown as string) || 0;
    const totalLiquidity = bankBalance + cashOnHand;
    const availableLiquidity = totalLiquidity - emergencyBuffer;

    const payday = dbUser.payday || 25;
    const now = new Date();
    let nextPayday = new Date(now.getFullYear(), now.getMonth(), payday);
    if (now.getDate() >= payday) {
      nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday);
    }
    const diff = Math.ceil((nextPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const daysUntilPayday = diff > 0 ? diff : 1;
    const dailyAllowance = availableLiquidity / daysUntilPayday;

    return {
      totalLiquidity,
      bankBalance,
      cashOnHand,
      monthlyExpenses,
      monthlyIncome,
      adjustedTrueSpend: monthlyExpenses - debtRepayments - reimbursements,
      daysUntilPayday,
      dailyAllowance,
      payday,
      emergencyBuffer
    };
  }
}

export const kpiService = new KpiService();
