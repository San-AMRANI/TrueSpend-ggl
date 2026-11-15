import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { walletService } from './WalletService.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export interface PreloadedKpiInputs {
  wallets?: any[];
  transactions?: any[];
  payrolls?: any[];
  debts?: any[];
  budgets?: any[];
}

export class KpiService {
  async getKpisForUser(dbUser: any, preloaded?: PreloadedKpiInputs) {
    const userId = dbUser.id;

    // Auto-seed default wallets if none exist (or reuse preloaded wallets)
    const userWallets = preloaded?.wallets || (await walletService.getWallets(userId));

    // Assign orphaned transactions to default Bank wallet
    const mainBank =
      userWallets.find((w: any) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w: any) => w.type === 'Bank') ||
      userWallets[0];
    const defaultCash = userWallets.find((w: any) => w.type === 'Cash') || mainBank;

    const allDebts = preloaded?.debts || (await debtRepository.findAllByUserId(userId));
    const [allTx, payrolls, allBudgets] = await Promise.all([
      preloaded?.transactions
        ? Promise.resolve(preloaded.transactions)
        : transactionService.getTransactionsForUser(userId, allDebts),
      preloaded?.payrolls
        ? Promise.resolve(preloaded.payrolls)
        : payrollRepository.findAllByUserId(userId),
      preloaded?.budgets
        ? Promise.resolve(preloaded.budgets)
        : categoryBudgetRepository.findAllByUserId(userId),
    ]);

    // Fix legacy transactions without walletId or with text 'Bank'/'Cash'
    const transactions = allTx.map((tx: any) => {
      let wid = tx.walletId as any;
      if (!wid || wid === 'Bank') {
        wid = (tx as any).sourceWallet === 'Cash' ? defaultCash?.id : mainBank?.id;
      } else if (wid === 'Cash') {
        wid = defaultCash?.id;
      }
      return { ...tx, walletId: wid };
    });

    const engineInput = {
      transactions: transactions as any,
      payrolls: payrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      wallets: userWallets.map((w: any) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
      })),
      userSettings: {
        emergencyBuffer: parseFloat(dbUser.emergencyBuffer as unknown as string) || 0,
        salary: parseFloat(dbUser.salary as unknown as string) || 0,
        payday: dbUser.payday ? Number(dbUser.payday) : undefined,
      },
    };

    const kpis = computeFinancialState(engineInput);

    // Aggregate balances into wallets
    const accounts = userWallets.map((w: any) => ({
      ...w,
      balance:
        kpis.walletBalances[w.id] !== undefined
          ? kpis.walletBalances[w.id]
          : parseFloat((w.initialBalance as string) || '0'),
    }));

    return {
      accounts,
      ...kpis,
    };
  }
}
export const kpiService = new KpiService();
