import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDashboardData } from '../hooks/useDashboardData';
import { DashboardNav } from './dashboard/DashboardNav';
import { OverviewTab } from './dashboard/OverviewTab';
import { TransactionsTab } from './dashboard/TransactionsTab';

import { DebtsTab } from './dashboard/DebtsTab';
import { AnalyticsTab } from './dashboard/AnalyticsTab';
import { DigestTab } from './dashboard/DigestTab';
import { SettingsTab } from './dashboard/SettingsTab';
import { BudgetsTab } from './dashboard/BudgetsTab';
import { WhatIfTab } from './dashboard/WhatIfTab';
import { FinancialCalendarTab } from './dashboard/FinancialCalendarTab';
import { GoalsTab } from './dashboard/GoalsTab';
import { InsightsTab } from './dashboard/InsightsTab';
import { AIChat } from './AIChat';
import type { DashboardTab } from '../types';

interface DashboardProps {
  onTabChange?: (tab: DashboardTab) => void;
}

export default function Dashboard({ onTabChange }: DashboardProps = {}) {

  const { token } = useAuth();
  const {
    kpis,
    transactions,
    debts,
    payrolls,
    budgets,
    emergencyBuffer,
    setEmergencyBuffer,
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
    goals,
    insights,
    handleCreateGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleContributeToGoal,
    notifications,
  } = useDashboardData(token);

  // Notify parent whenever tab changes (used to hide header on mobile chat)
  const setActiveTab = (tab: DashboardTab) => {
    setActiveTabRaw(tab);
    onTabChange?.(tab);
  };

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
          goals={goals}
          setActiveTab={setActiveTab}
          openTransaction={openTransaction}
          handleSettle={handleSettleDebt}
          payrolls={payrolls}
        />
      )}

      {activeTab === 'transactions' && (
        <TransactionsTab
          transactions={transactions}
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
          goals={goals}
          insights={insights}
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

      {activeTab === 'what-if' && <WhatIfTab kpis={kpis} goals={goals} amount={whatIfAmount} setAmount={setWhatIfAmount} transactions={transactions} payrolls={payrolls} debts={debts} budgets={budgets} />}

      {activeTab === 'debts' && (
        <DebtsTab
          debts={debts}
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
          emergencyBuffer={emergencyBuffer}
          setEmergencyBuffer={setEmergencyBuffer}
          isSaving={isSaving}
          isExporting={isExporting}
          isImporting={isImporting}
          handleSaveSettings={handleSaveSettings}
          handleExportSql={handleExportSql}
          handleImportSql={handleImportSql}
          notifications={notifications}
        />
      )}

      {activeTab === 'goals' && (
        <GoalsTab
          goals={goals}
          onCreateGoal={handleCreateGoal}
          onUpdateGoal={handleUpdateGoal}
          onDeleteGoal={handleDeleteGoal}
          onContribute={handleContributeToGoal}
        />
      )}

      {activeTab === 'insights' && (
        <InsightsTab insights={insights} />
      )}

      {activeTab === 'chat' && <AIChat onDataChange={fetchData} />}
    </div>
  );
}
