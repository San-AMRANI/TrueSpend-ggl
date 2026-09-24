import { transactionRepository } from '../repositories/TransactionRepository.js';
import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { walletService } from './WalletService.js';
import { payrollService } from './PayrollService.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;

    // Auto-seed default wallets if none exist
    const userWallets = await walletService.getWallets(userId);

    await payrollService.reconcileDuePayrolls(userId);

    // Assign orphaned transactions to default Bank wallet
    const mainBank = userWallets.find(w => w.type === 'Bank' && w.isMain) || userWallets.find(w => w.type === 'Bank') || userWallets[0];
    const defaultCash = userWallets.find(w => w.type === 'Cash') || mainBank;

    const [allTx, payrolls, allDebts, allBudgets] = await Promise.all([
      transactionService.getTransactionsForUser(userId),
      payrollRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
    ]);
    
    // Fix legacy transactions without walletId or with text 'Bank'/'Cash'
    const transactions = allTx.map(tx => {
      let wid = tx.walletId as any;
      if (!wid || wid === 'Bank') {
        wid = (tx as any).sourceWallet === 'Cash' ? defaultCash.id : mainBank.id;
      } else if (wid === 'Cash') {
        wid = defaultCash.id;
      }
      return { ...tx, walletId: wid };
    });

    const engineInput = {
      transactions: transactions as any,
      payrolls: payrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      wallets: userWallets.map(w => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
      })),
      userSettings: {
        emergencyBuffer: parseFloat(dbUser.emergencyBuffer as unknown as string) || 0,
        salary: parseFloat(dbUser.salary as unknown as string) || 0,
      }
    };
    
    const kpis = computeFinancialState(engineInput);
    
    // Aggregate balances into wallets
    const accounts = userWallets.map(w => ({
      ...w,
      balance: kpis.walletBalances[w.id] !== undefined ? kpis.walletBalances[w.id] : parseFloat(w.initialBalance as string || '0')
    }));

    return {
      accounts,
      ...kpis
    };
  }
}
export const kpiService = new KpiService();
