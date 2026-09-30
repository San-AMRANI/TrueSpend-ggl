import { transactionService } from './TransactionService.js';
import { payrollRepository } from '../repositories/PayrollRepository.js';
import { debtRepository } from '../repositories/DebtRepository.js';
import { categoryBudgetRepository } from '../repositories/CategoryBudgetRepository.js';
import { walletService } from './WalletService.js';
import { payrollService } from './PayrollService.js';
import { investmentService } from './InvestmentService.js';
import { netWorthSnapshotService } from './NetWorthSnapshotService.js';
import { computeFinancialState } from '../../src/lib/financialEngine.js';

export class KpiService {
  async getKpisForUser(dbUser: any) {
    const userId = dbUser.id;

    // Auto-seed default wallets if none exist
    const userWallets = await walletService.getWallets(userId);

    await payrollService.reconcileDuePayrolls(userId);

    // Assign orphaned transactions to default Bank wallet
    const mainBank =
      userWallets.find((w) => w.type === 'Bank' && w.isMain) ||
      userWallets.find((w) => w.type === 'Bank') ||
      userWallets[0];
    const defaultCash = userWallets.find((w) => w.type === 'Cash') || mainBank;

    const [allTx, payrolls, allDebts, allBudgets] = await Promise.all([
      transactionService.getTransactionsForUser(userId),
      payrollRepository.findAllByUserId(userId),
      debtRepository.findAllByUserId(userId),
      categoryBudgetRepository.findAllByUserId(userId),
    ]);

    // Fix legacy transactions without walletId or with text 'Bank'/'Cash'
    const transactions = allTx.map((tx) => {
      let wid = tx.walletId as any;
      if (!wid || wid === 'Bank') {
        wid = (tx as any).sourceWallet === 'Cash' ? defaultCash.id : mainBank.id;
      } else if (wid === 'Cash') {
        wid = defaultCash.id;
      }
      return { ...tx, walletId: wid };
    });

    // Only include liquid wallets (Bank, Cash, Savings) in the financial engine
    // Brokerage wallets are tracked separately via investment holdings
    const liquidWallets = userWallets.filter((w) => w.type !== 'Brokerage');

    const engineInput = {
      transactions: transactions as any,
      payrolls: payrolls as any,
      debts: allDebts as any,
      budgets: allBudgets as any,
      wallets: liquidWallets.map((w) => ({
        id: w.id,
        name: w.name,
        type: w.type,
        isMain: w.isMain,
        initialBalance: w.initialBalance,
      })),
      userSettings: {
        emergencyBuffer: parseFloat(dbUser.emergencyBuffer as unknown as string) || 0,
        salary: parseFloat(dbUser.salary as unknown as string) || 0,
      },
    };

    const kpis = computeFinancialState(engineInput);

    // Get investment portfolio value
    let investmentValue = 0;
    let safeToInvestBreakdown: any = undefined;
    try {
      const portfolio = await investmentService.getPortfolio(userId);
      investmentValue = portfolio.totalMarketValueMad || 0;
      safeToInvestBreakdown = await investmentService.computeSafeToInvest(
        { ...kpis, salary: parseFloat(dbUser.salary as string) || 0 },
        transactions as any,
      );
    } catch (_) {
      // Investment features not yet set up, skip silently
    }

    // Compute full net worth: liquid + investment + receivables - payables
    const pendingPayablesTotal = allDebts
      .filter((d: any) => d.type === 'Payable' && d.status === 'Pending')
      .reduce((sum: number, d: any) => sum + (parseFloat(d.remainingBalance as string) || 0), 0);
    const pendingReceivablesTotal = allDebts
      .filter((d: any) => d.type === 'Receivable' && d.status === 'Pending')
      .reduce((sum: number, d: any) => sum + (parseFloat(d.remainingBalance as string) || 0), 0);

    const netWorthTotal =
      kpis.totalLiquidity + investmentValue + pendingReceivablesTotal - pendingPayablesTotal;

    // Fire-and-forget daily net worth snapshot
    netWorthSnapshotService
      .takeSnapshot(userId, kpis.totalLiquidity, investmentValue, pendingPayablesTotal)
      .catch(() => {});

    // Aggregate balances into wallets (all wallets, including Brokerage for UI display)
    const accounts = userWallets.map((w) => ({
      ...w,
      balance:
        kpis.walletBalances[w.id] !== undefined
          ? kpis.walletBalances[w.id]
          : parseFloat((w.initialBalance as string) || '0'),
    }));

    return {
      accounts,
      ...kpis,
      investmentValue,
      netWorthTotal,
      safeToInvestBreakdown,
    };
  }
}

export const kpiService = new KpiService();
