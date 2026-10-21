import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardNav } from './dashboard/DashboardNav';
import { OverviewTab } from './dashboard/OverviewTab';
import { TransactionsTab } from './dashboard/TransactionsTab';

import { DebtsTab } from './dashboard/DebtsTab';
import { AnalyticsTab } from './dashboard/AnalyticsTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { BudgetsTab } from './dashboard/BudgetsTab';
import { InvestmentsTab } from './dashboard/InvestmentsTab';
import { GoalsTab } from './dashboard/GoalsTab';
import { SubscriptionsTab } from './dashboard/SubscriptionsTab';
import { FinancialCalendarTab } from './dashboard/FinancialCalendarTab';
import { ReportsTab } from './dashboard/ReportsTab';
import { ContextsTab } from './dashboard/ContextsTab';
import { UsersAndRolesSection } from './dashboard/UsersAndRolesSection';
import { PredictiveForecastTab } from './dashboard/PredictiveForecastTab';
import { AIChat } from './AIChat';
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
    handleCreateContext,
    handleUpdateContext,
    handleDeleteContext,
    handleLinkTransactionsToContext,
    investmentsData,
    handleCreateHolding,
    handleUpdateHolding,
    handleDeleteHolding,
    handleExecuteTrade,
    handleCreateDcaPlan,
    handleUpdateDcaPlan,
    handleDeleteDcaPlan,
    handleAddToWatchlist,
    handleRemoveFromWatchlist,
    refreshInvestments,
    userSettings,
    notifications,
  } = useDashboardData(token);

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
    window.addEventListener('truespend:setTab', handleSetTab);
    return () => window.removeEventListener('truespend:setTab', handleSetTab);
  }, []);

  return (
    <div className="space-y-8 relative">
      <DashboardNav activeTab={activeTab} setActiveTab={setActiveTab} />
      
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
          dcaPlans={investmentsData?.dcaPlans || []}
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
          onSaveBudget={handleSaveCategoryBudget}
          onSaveBudgetsBatch={handleSaveCategoryBudgetsBatch}
          onCopyPrevious={handleCopyPreviousMonthBudgets}
          onClearMonth={handleClearCategoryBudgetsMonth}
          onDeleteBudget={handleDeleteCategoryBudget}
          onContributeGoal={handleContributeToGoal}
          setActiveTab={setActiveTab}
        />
      )}

      {activeTab === 'investments' && (
        <InvestmentsTab
          data={investmentsData}
          loading={loading}
          wallets={kpis?.accounts || []}
          kpis={kpis}
          debts={debts}
          onRefresh={refreshInvestments}
          onCreateHolding={handleCreateHolding}
          onUpdateHolding={handleUpdateHolding}
          onDeleteHolding={handleDeleteHolding}
          onExecuteTrade={handleExecuteTrade}
          onCreateDcaPlan={handleCreateDcaPlan}
          onUpdateDcaPlan={handleUpdateDcaPlan}
          onDeleteDcaPlan={handleDeleteDcaPlan}
          onAddToWatchlist={handleAddToWatchlist}
          onRemoveFromWatchlist={handleRemoveFromWatchlist}
          onCreateWallet={handleCreateWallet}
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
          handleEditDebt={handleEditDebt}
          handleDeleteDebt={handleDeleteDebt}
          onSaveBudget={handleSaveCategoryBudget}
          setActiveTab={setActiveTab}
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
          investmentsData={investmentsData}
          contexts={contexts}
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
    </div>
  );
}
