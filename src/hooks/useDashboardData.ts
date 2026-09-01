import { useState, useEffect, useCallback } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import { CategoryBudget, KPI, Transaction, Debt, DashboardTab, Payroll, Goal } from '../types';
import { useNotifications } from './useNotifications';

export function useDashboardData(token: string | null) {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [emergencyBuffer, setEmergencyBuffer] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [analyticsMonth, setAnalyticsMonth] = useState<string>('All Time');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [whatIfAmount, setWhatIfAmount] = useState<number>(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  const notifications = useNotifications();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [kpiData, txData, debtData, settingsData, budgetData, payrollData, goalsData, insightsData] = await Promise.all([
        dashboardService.getKpis(token),
        dashboardService.getTransactions(token),
        dashboardService.getDebts(token),
        dashboardService.getSettings(token),
        dashboardService.getCategoryBudgets(token),
        dashboardService.getPayrolls(token),
        dashboardService.getGoals(token),
        dashboardService.getInsights(token),
      ]);

      setKpis(kpiData || null);
      setTransactions(txData || []);
      setDebts(debtData || []);
      setEmergencyBuffer(settingsData?.emergencyBuffer ?? 0);
      setBudgets(budgetData || []);
      setPayrolls(payrollData || []);
      setGoals(goalsData || []);
      setInsights(insightsData || null);
    } catch (e) {
      console.error('Error fetching dashboard data:', e);
    } finally {
      setLoading(false);
    }
  }, [token]);

  // When fresh data arrives, schedule (or re-schedule) the daily notification
  useEffect(() => {
    if (!kpis) return;
    const now = new Date();
    const monthlyBudgets = budgets.filter(
      b => b.year === now.getUTCFullYear() && b.month === now.getUTCMonth() + 1,
    );
    const totalBudget = monthlyBudgets.reduce((s, b) => s + parseFloat(b.amount as any), 0);
    const totalSpent = transactions
      .filter(tx => {
        if (tx.type !== 'Expense') return false;
        const d = new Date(tx.createdAt);
        return d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() + 1 === now.getUTCMonth() + 1;
      })
      .reduce((s, tx) => s + parseFloat(tx.amount as any), 0);
    const monthlyIncome = parseFloat((kpis as any).monthlyIncome ?? 0);
    const monthlyExpenses = parseFloat((kpis as any).monthlyExpenses ?? 0);

    const overspentCategories = monthlyBudgets
      .filter(b => {
        const spent = transactions
          .filter(tx => {
            const d = new Date(tx.createdAt);
            return tx.type === 'Expense' && tx.category === b.category &&
              d.getUTCFullYear() === now.getUTCFullYear() && d.getUTCMonth() + 1 === now.getUTCMonth() + 1;
          })
          .reduce((s, tx) => s + parseFloat(tx.amount as any), 0);
        return spent > parseFloat(b.amount as any);
      })
      .map(b => b.category);

    const topCategory =
      monthlyBudgets.sort((a, b) => parseFloat(b.amount as any) - parseFloat(a.amount as any))[0]
        ?.category ?? null;

    notifications.scheduleDaily({
      monthlyExpenses,
      monthlyIncome,
      totalBudget,
      totalSpent,
      daysUntilPayday: (kpis as any).daysUntilPayday ?? 0,
      dailyAllowance: (kpis as any).dailyAllowance ?? 0,
      dailyRemaining: (kpis as any).dailyRemaining ?? 0,
      overspentCategories,
      topCategory,
      savings: Math.max(0, monthlyIncome - monthlyExpenses),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis, budgets, transactions]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSettleDebt = async (debtId: string, amount: number, category?: string, wallet?: 'Bank' | 'Cash') => {
    try {
      await dashboardService.settleDebt(debtId, amount, token, category, wallet);
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

  const handleSaveCategoryBudgetsBatch = async (budgets: { category: string; year: number; month: number; amount: number }[]) => {
    await dashboardService.saveCategoryBudgetsBatch(budgets, token);
    await fetchData();
  };


  const handleCopyPreviousMonthBudgets = async (year: number, month: number) => {
    const result = await dashboardService.copyPreviousMonthBudgets(year, month, token);
    await fetchData();
    return result.copied;
  };

  const handleClearCategoryBudgetsMonth = async (year: number, month: number) => {
    const result = await dashboardService.clearCategoryBudgetsMonth(year, month, token);
    await fetchData();
    return result.count;
  };

  const handleDeleteCategoryBudget = async (id: string) => {
    await dashboardService.deleteCategoryBudget(id, token);
    await fetchData();
  };

  const openTransaction = (transactionId: string) => {
    setSelectedTransactionId(transactionId);
    setActiveTab('transactions');
  };

  const handleSaveSettings = async (newBuffer: number) => {
    setIsSaving(true);
    try {
      await dashboardService.updateSettings({ emergencyBuffer: newBuffer }, token);
      await fetchData();
      alert('Settings saved successfully!');
    } catch (e) {
      console.error('Error saving settings:', e);
      alert('Failed to save settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePayroll = async (scheduledFor: string, amount: number) => {
    await dashboardService.createPayroll({ scheduledFor, amount }, token);
    await fetchData();
  };

  const handleDeletePayroll = async (payrollId: string) => {
    await dashboardService.deletePayroll(payrollId, token);
    await fetchData();
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

  const handleCreateGoal = async (payload: any) => {
    await dashboardService.createGoal(payload, token);
    await fetchData();
  };

  const handleUpdateGoal = async (id: string, payload: any) => {
    await dashboardService.updateGoal(id, payload, token);
    await fetchData();
  };

  const handleDeleteGoal = async (id: string) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    await dashboardService.deleteGoal(id, token);
    await fetchData();
  };

  const handleContributeToGoal = async (id: string, amount: number) => {
    await dashboardService.contributeToGoal(id, amount, token);
    await fetchData();
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
    payrolls,
    budgets,
    goals,
    insights,
    emergencyBuffer,
    setEmergencyBuffer,
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
    handleSaveCategoryBudgetsBatch,
    handleCopyPreviousMonthBudgets,
    handleClearCategoryBudgetsMonth,
    handleDeleteCategoryBudget,
    openTransaction,
    handleSaveSettings,
    handleCreatePayroll,
    handleDeletePayroll,
    handleSeedData,
    handleExportSql,
    handleImportSql,
    handleCreateGoal,
    handleUpdateGoal,
    handleDeleteGoal,
    handleContributeToGoal,
    notifications,
  };
}
