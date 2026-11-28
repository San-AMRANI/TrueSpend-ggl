import { transactionRepository } from '../repositories/TransactionRepository.js';
import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { walletRepository } from '../repositories/WalletRepository.js';
import { walletService } from './WalletService.js';
import { payrollService } from './PayrollService.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export interface PreloadedLedgerData {
  wallets?: any[];
  transactions?: any[];
  payrolls?: any[];
  debts?: any[];
  budgets?: any[];
  skipPayrollReconcile?: boolean;
}

export class KpiService {
  async getKpisForUser(dbUser: any, preloaded?: PreloadedLedgerData) {
    const userId = dbUser.id;

    // Auto-seed default wallets if none exist
    const userWallets = preloaded?.wallets ?? (await walletService.getWallets(userId));

    if (!preloaded?.skipPayrollReconcile) {
      await payrollService.reconcileDuePayrolls(userId);
    }

    // Assign orphaned transactions to default Bank wallet
    const mainBank =
      userWallets.find((w: any) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w: any) => w.type === 'Bank') ||
      userWallets[0];
    const defaultCash = userWallets.find((w: any) => w.type === 'Cash') || mainBank;

    let allTx: any[];
    let payrolls: any[];
    let allDebts: any[];
    let allBudgets: any[];

    if (
      preloaded?.transactions &&
      preloaded?.payrolls &&
      preloaded?.debts &&
      preloaded?.budgets
    ) {
      allTx = preloaded.transactions;
      payrolls = preloaded.payrolls;
      allDebts = preloaded.debts;
      allBudgets = preloaded.budgets;
    } else {
      const [rawTx, rawSplits, loadedDebts, loadedPayrolls, loadedBudgets] = await Promise.all([
        preloaded?.transactions
          ? Promise.resolve(null)
          : transactionRepository.findAllByUserId(userId),
        preloaded?.transactions
          ? Promise.resolve(null)
          : transactionRepository.findSplitsByUserId(userId),
        preloaded?.debts
          ? Promise.resolve(preloaded.debts)
          : debtRepository.findAllByUserId(userId),
        preloaded?.payrolls
          ? Promise.resolve(preloaded.payrolls)
          : payrollRepository.findAllByUserId(userId),
        preloaded?.budgets
          ? Promise.resolve(preloaded.budgets)
          : categoryBudgetRepository.findAllByUserId(userId),
      ]);

      allDebts = loadedDebts;
      payrolls = loadedPayrolls;
      allBudgets = loadedBudgets;
      allTx =
        preloaded?.transactions ??
        (await transactionService.getTransactionsForUser(userId, {
          rawTransactions: rawTx!,
          allSplits: rawSplits!,
          allDebts,
        }));
    }

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
        accountSubtype: w.accountSubtype,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
        creditLimit: w.creditLimit,
        liabilityBalance: w.liabilityBalance,
      })),
      userSettings: {
        emergencyBuffer: Number(dbUser?.emergencyBuffer || 0),
        salary: Number(dbUser?.salary || 0),
        payday: dbUser?.payday ?? undefined,
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
