import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardNav } from './dashboard/DashboardNav';
import { OverviewTab } from './dashboard/OverviewTab';
import { CashFlowTab } from './dashboard/CashFlowTab';
import { TransactionsTab } from './dashboard/TransactionsTab';

import { DebtsTab } from './dashboard/DebtsTab';
import { AnalyticsTab } from './dashboard/AnalyticsTab';
import { DigestTab } from './dashboard/DigestTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { BudgetsTab } from './dashboard/BudgetsTab';
import { GoalsTab } from './dashboard/GoalsTab';
import { SubscriptionsTab } from './dashboard/SubscriptionsTab';
import { WhatIfTab } from './dashboard/WhatIfTab';
import { FinancialCalendarTab } from './dashboard/FinancialCalendarTab';
import { ReportsTab } from './dashboard/ReportsTab';
import { ContextsTab } from './dashboard/ContextsTab';
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
          setActiveTab={setActiveTab}
          openTransaction={openTransaction}
          handleSettle={handleSettleDebt}
          payrolls={payrolls}
          handleCreateWallet={handleCreateWallet}
          handleUpdateWallet={handleUpdateWallet}
          handleDeleteWallet={handleDeleteWallet}
        />
      )}

      {activeTab === 'cash-flow' && (
        <CashFlowTab 
          kpis={kpis} 
          transactions={transactions}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionsTab
          transactions={transactions}
          wallets={kpis?.accounts || []}
          contexts={contexts}
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
          openTransaction={openTransaction}
          setActiveTab={setActiveTab}
          onCreatePayroll={handleCreatePayroll}
          onDeletePayroll={handleDeletePayroll}
        />
      )}

      {activeTab === 'budgets' && (
      <BudgetsTab
          budgets={budgets}
          transactions={transactions}
          payrolls={payrolls}
          onSaveBudget={handleSaveCategoryBudget}
          onSaveBudgetsBatch={handleSaveCategoryBudgetsBatch}
          onCopyPrevious={handleCopyPreviousMonthBudgets}
          onClearMonth={handleClearCategoryBudgetsMonth}
          onDeleteBudget={handleDeleteCategoryBudget}
        />
      )}

      {activeTab === 'goals' && (
        <GoalsTab
          goals={goals}
          wallets={kpis?.accounts || []}
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

      {activeTab === 'what-if' && <WhatIfTab kpis={kpis} amount={whatIfAmount} setAmount={setWhatIfAmount} transactions={transactions} payrolls={payrolls} debts={debts} budgets={budgets} />}

      {activeTab === 'debts' && (
        <DebtsTab
          debts={debts}
          wallets={kpis?.accounts}
          fetchData={fetchData}
          handleSettle={handleSettleDebt}
          handleEditDebt={handleEditDebt}
          handleDeleteDebt={handleDeleteDebt}
        />
      )}

      {activeTab === 'analytics' && (
        <AnalyticsTab
          transactions={transactions}
          payrolls={payrolls}
          debts={debts}
          analyticsMonth={analyticsMonth}
          setAnalyticsMonth={setAnalyticsMonth}
          wallets={kpis?.accounts || []}
        />
      )}

      {activeTab === 'digest' && <DigestTab transactions={transactions} debts={debts} payrolls={payrolls} />}

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
          handleCreateWallet={handleCreateWallet}
          handleUpdateWallet={handleUpdateWallet}
          handleDeleteWallet={handleDeleteWallet}
          notifications={notifications}
        />
      )}

      {activeTab === 'reports' && (
        <ReportsTab transactions={transactions} kpis={kpis} budgets={budgets} onDataChange={fetchData} />
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
