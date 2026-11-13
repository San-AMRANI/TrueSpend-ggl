import React, { Suspense, lazy, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardNav } from './dashboard/DashboardNav';
import { OverviewTab } from './dashboard/OverviewTab';
import { TactileSmartCalculator } from './dashboard/TactileSmartCalculator';
import TransactionForm from './TransactionForm';
import { CommandPalette } from './CommandPalette';
import { SpexCompanionPet } from './common/SpexCompanionPet';
import { SmartNotificationCenter } from './dashboard/SmartNotificationCenter';
import { PageTransition, MotionModal } from './ui/MotionPrimitives';
import { AnimatePresence, motion } from 'motion/react';
import { X, CheckCircle2, AlertCircle, Info, Calculator } from 'lucide-react';
import type { DashboardTab, WalletsWorkbenchSection } from '../types';

const TransactionsTab = lazy(() =>
  import('./dashboard/TransactionsTab').then((m) => ({ default: m.TransactionsTab }))
);
const DebtsTab = lazy(() =>
  import('./dashboard/DebtsTab').then((m) => ({ default: m.DebtsTab }))
);
const AnalyticsTab = lazy(() =>
  import('./dashboard/AnalyticsTab').then((m) => ({ default: m.AnalyticsTab }))
);
const SettingsTab = lazy(() =>
  import('./dashboard/SettingsTab').then((m) => ({ default: m.SettingsTab }))
);
const BudgetsTab = lazy(() =>
  import('./dashboard/BudgetsTab').then((m) => ({ default: m.BudgetsTab }))
);
const GoalsTab = lazy(() =>
  import('./dashboard/GoalsTab').then((m) => ({ default: m.GoalsTab }))
);
const SubscriptionsTab = lazy(() =>
  import('./dashboard/SubscriptionsTab').then((m) => ({ default: m.SubscriptionsTab }))
);
const FinancialCalendarTab = lazy(() =>
  import('./dashboard/FinancialCalendarTab').then((m) => ({ default: m.FinancialCalendarTab }))
);
const ReportsTab = lazy(() =>
  import('./dashboard/ReportsTab').then((m) => ({ default: m.ReportsTab }))
);
const ContextsTab = lazy(() =>
  import('./dashboard/ContextsTab').then((m) => ({ default: m.ContextsTab }))
);
const UsersAndRolesSection = lazy(() =>
  import('./dashboard/UsersAndRolesSection').then((m) => ({ default: m.UsersAndRolesSection }))
);
const PredictiveForecastTab = lazy(() =>
  import('./dashboard/PredictiveForecastTab').then((m) => ({ default: m.PredictiveForecastTab }))
);
const InvestmentsTab = lazy(() =>
  import('./dashboard/InvestmentsTab').then((m) => ({ default: m.InvestmentsTab }))
);
const CalculatorsHubTab = lazy(() =>
  import('./dashboard/CalculatorsHubTab').then((m) => ({ default: m.CalculatorsHubTab }))
);
const WalletsManager = lazy(() =>
  import('./dashboard/WalletsManager').then((m) => ({ default: m.WalletsManager }))
);
const AIChat = lazy(() =>
  import('./AIChat').then((m) => ({ default: m.AIChat }))
);

function TabLoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        ))}
      </div>
      <div className="h-80 bg-gray-200 dark:bg-gray-800 rounded-xl" />
    </div>
  );
}

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
    handleUpdatePayroll,
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
    handleChangeSubscriptionPlan,
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
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [quickTxModalType, setQuickTxModalType] = useState<'Expense' | 'Income' | 'Transfer' | null>(null);
  const [isSmartCalcModalOpen, setIsSmartCalcModalOpen] = useState(false);
  const [isWalletsModalOpen, setIsWalletsModalOpen] = useState(false);
  const [accountsSection, setAccountsSection] = useState<WalletsWorkbenchSection>('wallets');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

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
    window.dispatchEvent(
      new CustomEvent('truespend:unreadNotificationsCount', {
        detail: notifications.unreadCount,
      })
    );
  }, [notifications.unreadCount]);

  useEffect(() => {
    const handleSetTab = (e: any) => {
      setActiveTab(e.detail);
    };
    const handleOpenAccountsSection = (e: any) => {
      const section: WalletsWorkbenchSection = e.detail || 'wallets';
      setAccountsSection(section);
      setIsWalletsModalOpen(false);
      setActiveTab('accounts');
    };
    const handleOpenCommandPalette = () => {
      setIsCommandPaletteOpen(true);
    };
    const handleOpenNotifications = () => {
      setIsNotificationCenterOpen((prev) => !prev);
    };
    const handleOpenQuickTransaction = (e: any) => {
      const txType = e?.detail === 'Income' || e?.detail === 'Transfer' ? e.detail : 'Expense';
      setQuickTxModalType(txType);
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
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        setQuickTxModalType(null);
        setIsSmartCalcModalOpen(false);
        setIsNotificationCenterOpen(false);
        setIsWalletsModalOpen(false);
        return;
      }

      const target = e.target as HTMLElement | null;
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (!isTyping && !e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        setQuickTxModalType('Expense');
      }
    };

    window.addEventListener('truespend:setTab', handleSetTab);
    window.addEventListener('truespend:openAccountsSection', handleOpenAccountsSection);
    window.addEventListener('truespend:openCommandPalette', handleOpenCommandPalette);
    window.addEventListener('truespend:openNotifications', handleOpenNotifications);
    window.addEventListener('truespend:openQuickTransaction', handleOpenQuickTransaction);
    window.addEventListener('truespend:toast', handleToast);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('truespend:setTab', handleSetTab);
      window.removeEventListener('truespend:openAccountsSection', handleOpenAccountsSection);
      window.removeEventListener('truespend:openCommandPalette', handleOpenCommandPalette);
      window.removeEventListener('truespend:openNotifications', handleOpenNotifications);
      window.removeEventListener('truespend:openQuickTransaction', handleOpenQuickTransaction);
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
      <AnimatePresence>
        {toast && (
          <motion.div
            key="global-toast"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="fixed bottom-20 md:bottom-6 right-4 z-[90] flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl border backdrop-blur-md bg-gray-900/95 dark:bg-gray-800/95 text-white border-gray-700/80 max-w-sm"
          >
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
              aria-label="Dismiss notification"
              className="ml-auto p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-700/60 transition-colors cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && !kpis ? (
        <div className="space-y-6 animate-pulse">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            <div className="h-96 bg-gray-200 dark:bg-gray-800 rounded-xl" />
          </div>
        </div>
      ) : (
        <Suspense fallback={<TabLoadingSkeleton />}>
          <PageTransition pageKey={activeTab}>
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
              onDataChange={fetchData}
              onOpenQuickTransaction={(type) => setQuickTxModalType(type)}
              onOpenSmartCalculator={() => setIsSmartCalcModalOpen(true)}
              onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            />
          )}

          {activeTab === 'accounts' && (
            <WalletsManager
              wallets={kpis?.accounts || []}
              subscriptions={subscriptions}
              debts={debts}
              transactions={transactions}
              investmentsData={investmentsData}
              initialSection={accountsSection}
              onSectionChange={setAccountsSection}
              onOpenInvestments={() => setActiveTab('investments')}
              onPaySubscription={handlePaySubscription}
              onCreateWallet={handleCreateWallet}
              onUpdateWallet={handleUpdateWallet}
              onDeleteWallet={handleDeleteWallet}
              onRefresh={fetchData}
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
              onUpdatePayroll={handleUpdatePayroll}
              onDeletePayroll={handleDeletePayroll}
              onPaySubscription={handlePaySubscription}
              onDataChange={fetchData}
            />
          )}

          {activeTab === 'budgets' && (
            <BudgetsTab
              budgets={budgets}
              transactions={transactions}
              payrolls={payrolls}
              debts={debts}
              goals={goals}
              subscriptions={subscriptions}
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
              onChangeSubscriptionPlan={handleChangeSubscriptionPlan}
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
              kpis={kpis}
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
              onDataChange={fetchData}
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
            <ReportsTab
              transactions={transactions}
              kpis={kpis}
              budgets={budgets}
              onDataChange={fetchData}
              onNavigateTab={setActiveTab}
            />
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
          </PageTransition>
        </Suspense>
      )}

      {/* Global Command Palette (Cmd+K / Ctrl+K) */}
      <CommandPalette
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        setActiveTab={setActiveTab}
        openTransaction={openTransaction}
        onOpenQuickTransaction={(type) => setQuickTxModalType(type)}
        onOpenSmartCalculator={() => setIsSmartCalcModalOpen(true)}
        onOpenWalletsModal={() => {
          setAccountsSection('wallets');
          setActiveTab('accounts');
        }}
        kpis={kpis}
        transactions={transactions}
        debts={debts}
        goals={goals}
        subscriptions={subscriptions}
        investmentsData={investmentsData}
      />

      {/* Quick Transaction Entry Modal */}
      <MotionModal
        isOpen={Boolean(quickTxModalType)}
        onClose={() => setQuickTxModalType(null)}
        containerClassName="w-full max-w-lg max-h-[90vh] overflow-y-auto ts-scrollbar rounded-2xl shadow-2xl"
      >
        {quickTxModalType && (
          <TransactionForm
            initialType={quickTxModalType}
            wallets={kpis?.accounts || []}
            contexts={contexts}
            onCancel={() => setQuickTxModalType(null)}
            onSuccess={() => {
              const label = quickTxModalType;
              setQuickTxModalType(null);
              fetchData();
              setToast({ message: `${label} recorded and balances updated.`, type: 'success' });
            }}
          />
        )}
      </MotionModal>

      {/* Quick Tactile Smart Calculator Modal */}
      <MotionModal
        isOpen={isSmartCalcModalOpen}
        onClose={() => setIsSmartCalcModalOpen(false)}
        containerClassName="w-full max-w-5xl max-h-[92vh] overflow-y-auto ts-scrollbar bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-2xl p-4 sm:p-6"
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
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline px-2.5 py-1.5 cursor-pointer"
            >
              Open All 7 Simulators →
            </button>
            <button
              type="button"
              onClick={() => setIsSmartCalcModalOpen(false)}
              aria-label="Close calculator"
              className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
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
      </MotionModal>

      {/* Optional Quick Wallets Modal */}
      {isWalletsModalOpen && (
        <Suspense fallback={null}>
          <WalletsManager
            wallets={kpis?.accounts || []}
            subscriptions={subscriptions}
            debts={debts}
            transactions={transactions}
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
            onRefresh={fetchData}
          />
        </Suspense>
      )}

      {/* Smart Multi-Domain Notification & Insights Center Drawer */}
      <SmartNotificationCenter
        isOpen={isNotificationCenterOpen}
        onClose={() => setIsNotificationCenterOpen(false)}
        notifications={notifications}
        onNavigateTab={(tab) => {
          setIsNotificationCenterOpen(false);
          setActiveTab(tab);
        }}
      />

      {/* Interactive SPEX Companion Pet */}
      <SpexCompanionPet
        activeTab={activeTab}
        kpis={kpis}
        onOpenChat={() => setActiveTab('chat')}
      />
    </div>
  );
}
