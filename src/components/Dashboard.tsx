import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardNav } from './dashboard/DashboardNav';
import { OverviewTab } from './dashboard/OverviewTab';
import { TransactionsTab } from './dashboard/TransactionsTab';

import { DebtsTab } from './dashboard/DebtsTab';
import { AnalyticsTab } from './dashboard/AnalyticsTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { BudgetsTab } from './dashboard/BudgetsTab';
import { GoalsTab } from './dashboard/GoalsTab';
import { SubscriptionsTab } from './dashboard/SubscriptionsTab';
import { FinancialCalendarTab } from './dashboard/FinancialCalendarTab';
import { ReportsTab } from './dashboard/ReportsTab';
import { ContextsTab } from './dashboard/ContextsTab';
import { UsersAndRolesSection } from './dashboard/UsersAndRolesSection';
import { PredictiveForecastTab } from './dashboard/PredictiveForecastTab';
import { InvestmentsTab } from './dashboard/InvestmentsTab';
import { CalculatorsHubTab } from './dashboard/CalculatorsHubTab';
import { TactileSmartCalculator } from './dashboard/TactileSmartCalculator';
import { WalletsManager } from './dashboard/WalletsManager';
import TransactionForm from './TransactionForm';
import { CommandPalette } from './CommandPalette';
import { AIChat } from './AIChat';
import { X, CheckCircle2, AlertCircle, Info, Calculator } from 'lucide-react';
import type { DashboardTab } from '../types';

interface DashboardProps {
  onTabChange?: (tab: DashboardTab) => void;
  activeTab?: DashboardTab;
}

export default function Dashboard({ onTabChange, activeTab: propActiveTab }: DashboardProps = {}) {

  const { token } = useAuth();
  const {
    kpis,
    transactions,
    debts,
    payrolls,
    budgets,
    loading,
    isSaving,
    isExporting,
    isImporting,
    analyticsMonth,
    setAnalyticsMonth,
    activeTab,
    setActiveTab: setActiveTabRaw,
    whatIfAmount,
    setWhatIfAmount,
    selectedTransactionId,
    setSelectedTransactionId,
    fetchData,
    handleSettleDebt,
    handleForgiveDebt,
    handleDeleteDebt,
    handleEditDebt,
    handleDeleteTransaction,
    handleSaveCategoryBudget,
    handleSaveCategoryBudgetsBatch,
    handleCopyPreviousMonthBudgets,
    handleClearCategoryBudgetsMonth,
    handleDeleteCategoryBudget,
    openTransaction,
    handleSaveSettings,
    handleCreatePayroll,
    handleDeletePayroll,
    handleExportSql,
    handleImportSql,
    handleCreateWallet,
    handleUpdateWallet,
    handleDeleteWallet,
    contexts,
    goals,
    subscriptions,
    investmentsData,
    handleCreateGoal,
    handleUpdateGoal,
    handleContributeToGoal,
    handleWithdrawFromGoal,
    handleDeleteGoal,
    handleCreateSubscription,
    handleUpdateSubscription,
    handleDeleteSubscription,
    handlePaySubscription,
    handleDetectSubscriptions,
    handleUpsertStockPosition,
    handleUpdateStockPosition,
    handleDeleteStockPosition,
    handleExecuteStockOrder,
    handleDeleteStockOrder,
    handleExecutePaydayAllocation,
    handleFundInvestmentWallet,
    handleSearchStocks,
    handleRefreshInvestments,
    handleSyncBinanceWallet,
    handleLogWalletCapitalTransfer,
    handleFetchBinanceTrades,
    handleCreateContext,
    handleUpdateContext,
    handleDeleteContext,
    handleLinkTransactionsToContext,
    userSettings,
    notifications,
  } = useDashboardData(token);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [quickTxModalType, setQuickTxModalType] = useState<'Expense' | 'Income' | 'Transfer' | null>(null);
  const [isSmartCalcModalOpen, setIsSmartCalcModalOpen] = useState(false);
  const [isWalletsModalOpen, setIsWalletsModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Notify parent whenever tab changes (used to hide header on mobile chat)
  const setActiveTab = (tab: DashboardTab) => {
    setActiveTabRaw(tab);
    onTabChange?.(tab);
  };

  useEffect(() => {
    if (propActiveTab && propActiveTab !== activeTab) {
      setActiveTabRaw(propActiveTab);
    }
  }, [propActiveTab]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      setActiveTab(e.detail);
    };
    const handleOpenCommandPalette = () => {
      setIsCommandPaletteOpen(true);
    };
    const handleToast = (e: any) => {
      if (e.detail?.message) {
        setToast({
          message: e.detail.message,
          type: e.detail.type || 'info',
        });
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen(prev => !prev);
      }
    };

    window.addEventListener('truespend:setTab', handleSetTab);
    window.addEventListener('truespend:openCommandPalette', handleOpenCommandPalette);
    window.addEventListener('truespend:toast', handleToast);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('truespend:setTab', handleSetTab);
      window.removeEventListener('truespend:openCommandPalette', handleOpenCommandPalette);
      window.removeEventListener('truespend:toast', handleToast);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return (
    <div className="space-y-8 relative">
      <DashboardNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md animate-in slide-in-from-bottom-3 fade-in duration-200 bg-gray-900/95 dark:bg-gray-800/95 text-white border-gray-700/80 max-w-sm">
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          ) : toast.type === 'error' ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <Info className="h-4 w-4 text-indigo-400 shrink-0" />
          )}
          <span className="text-xs font-medium leading-snug">{toast.message}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="ml-auto p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      
      {loading && !kpis ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
            <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl"></div>
          </div>
        </div>
      ) : (
        <>
          {activeTab === 'overview' && (
            <OverviewTab
              kpis={kpis}
              transactions={transactions}
              debts={debts}
              budgets={budgets}
              goals={goals}
              subscriptions={subscriptions}
              investmentsData={investmentsData}
              setActiveTab={setActiveTab}
              openTransaction={openTransaction}
              handleSettle={handleSettleDebt}
              payrolls={payrolls}
              handleCreateWallet={handleCreateWallet}
              handleUpdateWallet={handleUpdateWallet}
              handleDeleteWallet={handleDeleteWallet}
              onOpenQuickTransaction={(type) => setQuickTxModalType(type)}
              onOpenSmartCalculator={() => setIsSmartCalcModalOpen(true)}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
          )}

          {activeTab === 'calculators' && (
            <CalculatorsHubTab
              kpis={kpis}
              amount={whatIfAmount}
              setAmount={setWhatIfAmount}
              transactions={transactions}
              payrolls={payrolls}
              debts={debts}
              budgets={budgets}
              goals={goals}
              userSettings={userSettings}
              onNavigateToTab={setActiveTab}
              onCreateGoal={handleCreateGoal}
              onSaveCategoryBudget={handleSaveCategoryBudget}
              onSaveSettings={handleSaveSettings}
            />
          )}

          {activeTab === 'investments' && (
            <InvestmentsTab
              investmentsData={investmentsData}
              wallets={kpis?.accounts || []}
              kpis={kpis}
              isSaving={isSaving}
              onUpsertPosition={handleUpsertStockPosition}
              onUpdatePosition={handleUpdateStockPosition}
              onDeletePosition={handleDeleteStockPosition}
              onExecuteOrder={handleExecuteStockOrder}
              onDeleteOrder={handleDeleteStockOrder}
              onExecutePaydayAllocation={handleExecutePaydayAllocation}
              onFundInvestmentWallet={handleFundInvestmentWallet}
              onSyncBinanceWallet={handleSyncBinanceWallet}
              onLogWalletCapitalTransfer={handleLogWalletCapitalTransfer}
              onFetchBinanceTrades={handleFetchBinanceTrades}
              onRefreshInvestments={handleRefreshInvestments}
              onCreateWallet={handleCreateWallet}
              onSearchStocks={handleSearchStocks}
              onRefresh={fetchData}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsTab
              transactions={transactions}
              wallets={kpis?.accounts || []}
              contexts={contexts}
              budgets={budgets}
              subscriptions={subscriptions}
              goals={goals}
              debts={debts}
              payrolls={payrolls}
              investmentsData={investmentsData}
              setActiveTab={setActiveTab}
              handleDeleteTx={handleDeleteTransaction}
              fetchData={fetchData}
              selectedTransactionId={selectedTransactionId}
              onSelectionHandled={() => setSelectedTransactionId(null)}
            />
          )}

          {activeTab === 'calendar' && (
            <FinancialCalendarTab
              transactions={transactions}
              debts={debts}
              payrolls={payrolls}
              kpis={kpis}
              subscriptions={subscriptions}
              wallets={kpis?.accounts || []}
              investmentsData={investmentsData}
              openTransaction={openTransaction}
              setActiveTab={setActiveTab}
              onCreatePayroll={handleCreatePayroll}
              onDeletePayroll={handleDeletePayroll}
              onPaySubscription={handlePaySubscription}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsTab
              budgets={budgets}
              transactions={transactions}
              payrolls={payrolls}
              debts={debts}
              goals={goals}
              wallets={kpis?.accounts || []}
              investmentsData={investmentsData}
              onSaveBudget={handleSaveCategoryBudget}
              onSaveBudgetsBatch={handleSaveCategoryBudgetsBatch}
              onCopyPrevious={handleCopyPreviousMonthBudgets}
              onClearMonth={handleClearCategoryBudgetsMonth}
              onDeleteBudget={handleDeleteCategoryBudget}
              onContributeGoal={handleContributeToGoal}
              onFundInvestmentWallet={handleFundInvestmentWallet}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'goals' && (
            <GoalsTab
              goals={goals}
              wallets={kpis?.accounts || []}
              budgets={budgets}
              transactions={transactions}
              setActiveTab={setActiveTab}
              onCreateGoal={handleCreateGoal}
              onUpdateGoal={handleUpdateGoal}
              onContributeGoal={handleContributeToGoal}
              onWithdrawGoal={handleWithdrawFromGoal}
              onDeleteGoal={handleDeleteGoal}
              onCreateWallet={handleCreateWallet}
            />
          )}

          {activeTab === 'subscriptions' && (
            <SubscriptionsTab
              subscriptions={subscriptions}
              wallets={kpis?.accounts || []}
              goals={goals}
              monthlySalary={userSettings?.salary}
              avgDailySpend={kpis?.avgDailySpend}
              onCreateSubscription={handleCreateSubscription}
              onUpdateSubscription={handleUpdateSubscription}
              onDeleteSubscription={handleDeleteSubscription}
              onPaySubscription={handlePaySubscription}
              onDetectSubscriptions={handleDetectSubscriptions}
            />
          )}

          {activeTab === 'debts' && (
            <DebtsTab
              debts={debts}
              wallets={kpis?.accounts}
              budgets={budgets}
              fetchData={fetchData}
              handleSettle={handleSettleDebt}
              handleForgive={handleForgiveDebt}
              handleEditDebt={handleEditDebt}
              handleDeleteDebt={handleDeleteDebt}
              onSaveBudget={handleSaveCategoryBudget}
              setActiveTab={setActiveTab}
              openTransaction={openTransaction}
            />
          )}

          {activeTab === 'analytics' && (
            <AnalyticsTab
              transactions={transactions}
              payrolls={payrolls}
              debts={debts}
              budgets={budgets}
              goals={goals}
              subscriptions={subscriptions}
              investmentsData={investmentsData}
              analyticsMonth={analyticsMonth}
              setAnalyticsMonth={setAnalyticsMonth}
              wallets={kpis?.accounts || []}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'settings' && (
            <SettingsTab
              userSettings={userSettings}
              isSaving={isSaving}
              isExporting={isExporting}
              isImporting={isImporting}
              handleSaveSettings={handleSaveSettings}
              handleExportSql={handleExportSql}
              handleImportSql={handleImportSql}
              wallets={kpis?.accounts || []}
              subscriptions={subscriptions}
              debts={debts}
              investmentsData={investmentsData}
              setActiveTab={setActiveTab}
              handleCreateWallet={handleCreateWallet}
              handleUpdateWallet={handleUpdateWallet}
              handleDeleteWallet={handleDeleteWallet}
              notifications={notifications}
            />
          )}

          {activeTab === 'users' && <UsersAndRolesSection />}

          {activeTab === 'forecast' && (
            <PredictiveForecastTab
              kpis={kpis}
              transactions={transactions}
              payrolls={payrolls}
              budgets={budgets}
              subscriptions={subscriptions}
              debts={debts}
              goals={goals}
              contexts={contexts}
              investmentsData={investmentsData}
              userSettings={userSettings}
              setActiveTab={setActiveTab}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsTab transactions={transactions} kpis={kpis} budgets={budgets} onDataChange={fetchData} onNavigateTab={setActiveTab} />
          )}
          {activeTab === 'contexts' && (
            <ContextsTab
              contexts={contexts}
              transactions={transactions}
              handleCreateContext={handleCreateContext}
              handleUpdateContext={handleUpdateContext}
              handleDeleteContext={handleDeleteContext}
              handleLinkTransactions={handleLinkTransactionsToContext}
            />
          )}
          {activeTab === 'chat' && <AIChat onDataChange={fetchData} />}
        </>
      )}

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        openTransaction={openTransaction}
        onOpenQuickTransaction={(type) => setQuickTxModalType(type)}
        onOpenSmartCalculator={() => setIsSmartCalcModalOpen(true)}
        onOpenWalletsModal={() => setIsWalletsModalOpen(true)}
        kpis={kpis}
        transactions={transactions}
        debts={debts}
        goals={goals}
        subscriptions={subscriptions}
        investmentsData={investmentsData}
      />

      {/* Quick Transaction Entry Modal */}
      {quickTxModalType && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150"
          onClick={() => setQuickTxModalType(null)}
        >
          <div
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <TransactionForm
              initialType={quickTxModalType}
              wallets={kpis?.accounts || []}
              contexts={contexts}
              onCancel={() => setQuickTxModalType(null)}
              onSuccess={() => {
                setQuickTxModalType(null);
                fetchData();
                setToast({ message: `${quickTxModalType} recorded and balances updated.`, type: 'success' });
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Tactile Smart Calculator Modal */}
      {isSmartCalcModalOpen && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-6 animate-in fade-in duration-150"
          onClick={() => setIsSmartCalcModalOpen(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <Calculator className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900 dark:text-white">Tactile Smart Calculator</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Evaluate expressions, check Safe-to-Spend impact, and convert numbers directly into transactions or goals.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsSmartCalcModalOpen(false);
                    setActiveTab('calculators');
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1.5"
                >
                  Open All 7 Simulators →
                </button>
                <button
                  type="button"
                  onClick={() => setIsSmartCalcModalOpen(false)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <TactileSmartCalculator
              kpis={kpis}
              debts={debts}
              goals={goals}
              userSettings={userSettings}
              onNavigateToTab={(tab) => {
                setIsSmartCalcModalOpen(false);
                setActiveTab(tab);
              }}
              onSetWhatIfAmount={(amt) => {
                setWhatIfAmount(amt);
                setIsSmartCalcModalOpen(false);
                setActiveTab('calculators');
              }}
              onCreateGoal={handleCreateGoal}
              onTransactionLogged={() => {
                fetchData();
                setToast({ message: 'Logged directly from Smart Calculator.', type: 'success' });
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Wallets & Balance Reconciliation Modal */}
      {isWalletsModalOpen && (
        <WalletsManager
          wallets={kpis?.accounts || []}
          subscriptions={subscriptions}
          debts={debts}
          investmentsData={investmentsData}
          onOpenInvestments={() => {
            setIsWalletsModalOpen(false);
            setActiveTab('investments');
          }}
          onClose={() => setIsWalletsModalOpen(false)}
          isModal={true}
          onCreateWallet={handleCreateWallet}
          onUpdateWallet={handleUpdateWallet}
          onDeleteWallet={handleDeleteWallet}
        />
      )}
    </div>
  );
}

