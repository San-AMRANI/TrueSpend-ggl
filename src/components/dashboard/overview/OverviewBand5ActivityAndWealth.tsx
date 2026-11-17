import React, { useState } from 'react';
import { format } from 'date-fns';
import {
  ArrowDownRight,
  ArrowUpRight,
  RefreshCw,
  Repeat,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { AnimatedMetricValue } from '../../ui/MotionPrimitives';
import { SettleDebtModal } from '../../SettleDebtModal';
import { netExpenseOf, reimbursedAmountOf } from '../../../lib/finance';
import type {
  DashboardTab,
  Debt,
  InvestmentsData,
  KPI,
  Subscription,
  Transaction,
} from '../../../types';

interface OverviewBand5Props {
  kpis: KPI | null;
  transactions: Transaction[];
  debts: Debt[];
  activeReceivables: number;
  activeSubs: Subscription[];
  monthlySubBurn: number;
  investmentsData: InvestmentsData | null;
  stockPortfolioMad: number;
  isHydratingInvestments?: boolean;
  isPrivacyMode: boolean;
  setActiveTab: (tab: DashboardTab) => void;
  openTransaction: (transactionId: string) => void;
  handleSettle: (
    debtId: string,
    amount: number,
    category?: string,
    walletId?: string,
  ) => Promise<void> | void;
}

export const OverviewBand5ActivityAndWealth: React.FC<OverviewBand5Props> = ({
  kpis,
  transactions,
  debts,
  activeReceivables,
  activeSubs,
  monthlySubBurn,
  investmentsData,
  stockPortfolioMad,
  isHydratingInvestments = false,
  isPrivacyMode,
  setActiveTab,
  openTransaction,
  handleSettle,
}) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);

  const maskMoney = (amount: number, decimals = 0, suffix = ' MAD') =>
    isPrivacyMode ? `••••${suffix ? suffix : ''}` : `${amount.toFixed(decimals)}${suffix}`;

  return (
    <>
      <div className="grid min-w-0 gap-4 lg:grid-cols-12 items-stretch">
        {/* Recent Transactions */}
        <Card className="min-w-0 lg:col-span-7 flex flex-col justify-between">
          <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
            <CardTitle className="text-sm sm:text-base">Recent Transactions</CardTitle>
            <Button type="button" variant="ghost" size="sm" onClick={() => setActiveTab('transactions')}>
              View all →
            </Button>
          </CardHeader>
          <CardContent className="min-w-0 flex-1">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {transactions.slice(0, 6).map((transaction) => {
                const gross = Number.parseFloat(transaction.amount) || 0;
                const reimb = reimbursedAmountOf(transaction);
                const netAmt = netExpenseOf(transaction);
                return (
                  <button
                    key={transaction.id}
                    type="button"
                    onClick={() => openTransaction(transaction.id)}
                    className="flex w-full min-w-0 items-center justify-between gap-2.5 py-2.5 text-left first:pt-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-lg px-1.5 -mx-1.5 transition-colors cursor-pointer"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                          transaction.type === 'Income'
                            ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400'
                            : transaction.type === 'Transfer'
                            ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                            : 'bg-rose-100 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        {transaction.type === 'Income' ? (
                          <ArrowDownRight className="h-4 w-4" />
                        ) : transaction.type === 'Transfer' ? (
                          <RefreshCw className="h-4 w-4" />
                        ) : (
                          <ArrowUpRight className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                          {transaction.notes || transaction.category || transaction.type}
                        </p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                          {format(new Date(transaction.createdAt), 'MMM d')} ·{' '}
                          {kpis?.accounts?.find((w) => w.id === transaction.walletId)?.name || 'Wallet'}
                          {transaction.type === 'Transfer' && transaction.destinationWalletId && (
                            <>
                              {' '}
                              →{' '}
                              {kpis?.accounts?.find((w) => w.id === transaction.destinationWalletId)?.name ||
                                'Wallet'}
                            </>
                          )}
                          {reimb > 0 && (
                            <span className="ml-1.5 text-teal-600 dark:text-teal-400 font-mono">
                              (Net {isPrivacyMode ? '••••' : netAmt.toFixed(0)})
                            </span>
                          )}
                        </p>
                      </div>
                    </div>

                    <span
                      className={`shrink-0 whitespace-nowrap text-sm font-semibold font-mono tabular-nums ${
                        transaction.type === 'Income'
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-gray-900 dark:text-gray-100'
                      }`}
                    >
                      {transaction.type === 'Expense' ? '−' : transaction.type === 'Income' ? '+' : ''}
                      {isPrivacyMode ? '••••' : `${gross.toFixed(2)} MAD`}
                    </span>
                  </button>
                );
              })}
              {transactions.length === 0 && (
                <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
                  No transactions yet.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Right Stack: Pending Receivables + Recurring Subscriptions + Investments */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          {/* Pending Receivables */}
          <Card className="min-w-0">
            <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                <WalletCards className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                <span>Pending Receivables</span>
              </CardTitle>
              <button
                type="button"
                onClick={() => setActiveTab('debts')}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
              >
                Debts &amp; Splits →
              </button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-2xl font-bold font-mono tabular-nums text-gray-900 dark:text-white">
                  <AnimatedMetricValue
                    value={activeReceivables}
                    masked={isPrivacyMode}
                    maskText="******"
                    suffix=" MAD"
                  />
                </div>
                <span className="text-xs text-gray-500 dark:text-gray-400">Owed to you</span>
              </div>
              <div className="space-y-2">
                {debts
                  .filter((debt) => debt.type === 'Receivable' && debt.status === 'Pending')
                  .slice(0, 2)
                  .map((debt) => (
                    <div
                      key={debt.id}
                      className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold text-gray-900 dark:text-white">
                          {debt.contactName}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-gray-500 dark:text-gray-400">
                          Bal: {maskMoney(Number.parseFloat(debt.remainingBalance), 2)}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs shrink-0"
                        onClick={() => setSettlingDebt(debt)}
                      >
                        Settle
                      </Button>
                    </div>
                  ))}
                {activeReceivables === 0 && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    No pending receivables owed to you.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Recurring Subscriptions + Investments Pulse */}
          <Card className="min-w-0 flex-1 flex flex-col justify-between">
            <CardContent className="p-4 space-y-3.5">
              {/* Subscriptions */}
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <Repeat className="h-3.5 w-3.5 text-indigo-500" />
                    Monthly Recurring Burn
                  </p>
                  <p className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {maskMoney(monthlySubBurn, 0)}
                    <span className="text-xs font-normal text-gray-400">
                      {' '}
                      /mo ({activeSubs.length} active)
                    </span>
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => setActiveTab('subscriptions')}
                  className="text-xs shrink-0"
                >
                  Prune &amp; Manage →
                </Button>
              </div>

              {activeSubs.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {activeSubs.slice(0, 4).map((sub) => (
                    <span
                      key={sub.id}
                      className="inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/70 px-2 py-1 text-[11px] text-gray-700 dark:text-gray-300"
                    >
                      <span>{sub.icon || '📱'}</span>
                      <span className="truncate max-w-[85px] font-medium">{sub.name}</span>
                      <span className="font-mono tabular-nums text-gray-400">
                        {isPrivacyMode ? '••' : parseFloat(sub.amount).toFixed(0)}
                      </span>
                    </span>
                  ))}
                </div>
              )}

              {/* Binance Spot & Investments Snapshot */}
              <div className="pt-3 border-t border-gray-100 dark:border-gray-800 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 flex items-center gap-1.5">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                    Investments &amp; Binance Spot
                  </p>
                  <p className="text-base font-bold font-mono tabular-nums text-gray-900 dark:text-white mt-0.5">
                    {isPrivacyMode
                      ? '•••••• MAD'
                      : isHydratingInvestments && !investmentsData
                      ? 'Loading valuations...'
                      : `${(
                          stockPortfolioMad +
                          (investmentsData?.buyingPower?.investmentWalletBalanceMad ??
                            kpis?.investmentReserve ??
                            0)
                        ).toLocaleString(undefined, { maximumFractionDigits: 0 })} MAD`}
                    {investmentsData && investmentsData.totalUnrealizedPnlMad !== 0 && !isPrivacyMode && (
                      <span
                        className={`ml-2 text-xs ${
                          investmentsData.totalUnrealizedPnlMad >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}
                      >
                        ({investmentsData.totalUnrealizedPnlMad >= 0 ? '+' : ''}
                        {investmentsData.totalUnrealizedPnlPercent.toFixed(1)}%)
                      </span>
                    )}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setActiveTab('investments')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs shrink-0"
                >
                  Portfolio →
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <SettleDebtModal
        debt={settlingDebt}
        wallets={kpis?.accounts}
        onClose={() => setSettlingDebt(null)}
        onConfirm={async (debtId, amount, category, walletId) => {
          await handleSettle(debtId, amount, category, walletId);
        }}
      />
    </>
  );
};

export default OverviewBand5ActivityAndWealth;
