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
import { WhatIfTab } from './dashboard/WhatIfTab';
import { FinancialCalendarTab } from './dashboard/FinancialCalendarTab';
import { ReportsTab } from './dashboard/ReportsTab';
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

  if (loading && !kpis) {
    return <div className="py-12 text-center text-gray-500 dark:text-gray-400">Loading your financial data...</div>;
  }

  return (
    <div className="space-y-8 relative">
      <DashboardNav activeTab={activeTab} setActiveTab={setActiveTab} />

      {activeTab === 'overview' && (
        <OverviewTab
          kpis={kpis}
          transactions={transactions}
          debts={debts}
          budgets={budgets}
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
          analyticsMonth={analyticsMonth}
          setAnalyticsMonth={setAnalyticsMonth}
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
      {activeTab === 'chat' && <AIChat onDataChange={fetchData} />}

    </div>
  );
}
