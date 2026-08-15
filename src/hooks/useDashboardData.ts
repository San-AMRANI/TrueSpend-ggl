import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import { CategoryBudget, KPI, Transaction, Debt, DashboardTab } from '../types';

export function useDashboardData(token: string | null) {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [payday, setPayday] = useState<number>(25);
  const [emergencyBuffer, setEmergencyBuffer] = useState<number>(0);
  const [salary, setSalary] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [analyticsMonth, setAnalyticsMonth] = useState<string>('All Time');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [whatIfAmount, setWhatIfAmount] = useState<number>(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [kpiData, txData, debtData, settingsData, budgetData] = await Promise.all([
        dashboardService.getKpis(token),
        dashboardService.getTransactions(token),
        dashboardService.getDebts(token),
        dashboardService.getSettings(token),
        dashboardService.getCategoryBudgets(token),
      ]);

      setKpis(kpiData);
      setTransactions(txData);
      setDebts(debtData);
      setPayday(settingsData.payday);
      setEmergencyBuffer(settingsData.emergencyBuffer);
      setSalary(settingsData.salary);
      setBudgets(budgetData);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSettleDebt = async (debtId: string, amount: number, category?: string) => {
    try {
      await dashboardService.settleDebt(debtId, amount, token, category);
      await fetchData();
    } catch (e) {
      console.error('Error settling debt:', e);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    if (!confirm('Are you sure you want to delete this debt? This cannot be undone.')) return;
    try {
      await dashboardService.deleteDebt(debtId, token);
      await fetchData();
    } catch (e: any) {
      console.error('Error deleting debt:', e);
      alert(e?.message || 'Failed to delete debt.');
    }
  };

  const handleEditDebt = async (debtId: string, currentAmount: string, currentContact: string, currentType: string) => {
    const newAmountStr = prompt('Enter the updated original amount:', currentAmount);
    if (newAmountStr === null) return;
    const newContact = prompt('Enter the updated contact name:', currentContact);
    if (newContact === null) return;

    try {
      await dashboardService.updateDebt(
        debtId,
        {
          amount: parseFloat(newAmountStr),
          contact: newContact,
          type: currentType,
        },
        token
      );
      await fetchData();
    } catch (e: any) {
      console.error('Error updating debt:', e);
      alert(e?.message || 'Failed to update debt.');
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;
    try {
      await dashboardService.deleteTransaction(txId, token);
      await fetchData();
    } catch (e: any) {
      console.error('Error deleting transaction:', e);
      alert(e?.message || 'Failed to delete transaction.');
    }
  };

  const handleSaveCategoryBudget = async (category: string, year: number, month: number, amount: number) => {
    await dashboardService.saveCategoryBudget({ category, year, month, amount }, token);
    await fetchData();
  };

  const handleCopyPreviousMonthBudgets = async (year: number, month: number) => {
    const result = await dashboardService.copyPreviousMonthBudgets(year, month, token);
    await fetchData();
    return result.copied;
  };

  const openTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setActiveTab('transactions');
  };

  const handleSaveSettings = async (newPayday: number, newBuffer: number, newSalary: number) => {
    setIsSaving(true);
    try {
      await dashboardService.updateSettings({ payday: newPayday, emergencyBuffer: newBuffer, salary: newSalary }, token);
      await fetchData();
      alert('Settings saved successfully!');
    } catch (e) {
      console.error('Error saving settings:', e);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSeedData = async () => {
    if (!confirm('This will overwrite current data with sample seed data. Proceed?')) return;
    setLoading(true);
    try {
      await dashboardService.seedData(token);
      await fetchData();
    } catch (e) {
      console.error('Error seeding data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportSql = async () => {
    setIsExporting(true);
    try {
      await dashboardService.exportSql(token);
    } catch (e) {
      console.error('Error exporting SQL:', e);
      alert('Failed to export SQL data.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleImportSql = async (sql: string) => {
    setIsImporting(true);
    try {
      const result = await dashboardService.importSql(sql, token);
      await fetchData();
      return result;
    } finally {
      setIsImporting(false);
    }
  };

  return {
    kpis,
    transactions,
    debts,
    budgets,
    payday,
    setPayday,
    emergencyBuffer,
    setEmergencyBuffer,
    salary,
    setSalary,
    loading,
    isSaving,
    isExporting,
    isImporting,
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
    handleSeedData,
    handleExportSql,
    handleImportSql,
  };
}
