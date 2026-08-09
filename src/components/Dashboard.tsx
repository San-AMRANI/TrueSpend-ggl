import React from 'react';
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

export default function Dashboard() {
  const { token } = useAuth();
  const {
    kpis,
    transactions,
    debts,
    budgets,
    payday,
    setPayday,
    emergencyBuffer,
    setEmergencyBuffer,
    loading,
    isSaving,
    isExporting,
    analyticsMonth,
    setAnalyticsMonth,
    activeTab,
    setActiveTab,
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
    handleCopyPreviousMonthBudgets,
    openTransaction,
    handleSaveSettings,
    handleExportSql,
  } = useDashboardData(token);

  if (loading && !kpis) {
    return <div className="py-12 text-center text-gray-500">Loading your financial data...</div>;
  }

  return (
    <div className="space-y-8">
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

      {activeTab === 'calendar' && <FinancialCalendarTab transactions={transactions} debts={debts} payday={payday} openTransaction={openTransaction} setActiveTab={setActiveTab} />}

      {activeTab === 'budgets' && (
        <BudgetsTab
          budgets={budgets}
          transactions={transactions}
          onSaveBudget={handleSaveCategoryBudget}
          onCopyPrevious={handleCopyPreviousMonthBudgets}
        />
      )}

      {activeTab === 'what-if' && <WhatIfTab kpis={kpis} amount={whatIfAmount} setAmount={setWhatIfAmount} />}

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
          analyticsMonth={analyticsMonth}
          setAnalyticsMonth={setAnalyticsMonth}
        />
      )}

      {activeTab === 'digest' && <DigestTab transactions={transactions} debts={debts} />}

      {activeTab === 'settings' && (
        <SettingsTab
          emergencyBuffer={emergencyBuffer}
          setEmergencyBuffer={setEmergencyBuffer}
          payday={payday}
          setPayday={setPayday}
          isSaving={isSaving}
          isExporting={isExporting}
          handleSaveSettings={handleSaveSettings}
          handleExportSql={handleExportSql}
        />
      )}
    </div>
  );
}
