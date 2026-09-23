import { googleSignIn, getGoogleAccessToken } from '../lib/googleAuth';
import { uploadToGoogleDrive } from '../lib/driveUpload';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import { CategoryBudget, KPI, Transaction, Debt, DashboardTab, Payroll, Goal, Subscription, DetectedSubscription } from '../types';
import { useNotifications } from './useNotifications';

export function useDashboardData(token: string | null) {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [contexts, setContexts] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [userSettings, setUserSettings] = useState<any>(null);
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
      const [kpiData, txData, debtData, settingsData, budgetData, payrollData, contextData, goalData, subData] = await Promise.all([
        dashboardService.getKpis(token),
        dashboardService.getTransactions(token),
        dashboardService.getDebts(token),
        dashboardService.getSettings(token),
        dashboardService.getCategoryBudgets(token),
        dashboardService.getPayrolls(token),
        dashboardService.getContexts(token),
        dashboardService.getGoals(token),
        dashboardService.getSubscriptions(token),
      ]);

      setKpis(kpiData || null);
      setTransactions(txData || []);
      setDebts(debtData || []);
      setUserSettings(settingsData);
      setBudgets(budgetData || []);
      setPayrolls(payrollData || []);
      setContexts(contextData || []);
      setGoals(goalData || []);
      setSubscriptions(subData || []);
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

  useEffect(() => {
    if (!userSettings || !userSettings.automatedDriveBackups) return;
    const lastBackup = userSettings.lastDriveBackupDate ? new Date(userSettings.lastDriveBackupDate).getTime() : 0;
    const now = Date.now();
    const freq = userSettings.driveBackupFrequency || 'weekly';
    const intervalMs =
      freq === 'daily'
        ? 24 * 60 * 60 * 1000
        : freq === '3days'
        ? 3 * 24 * 60 * 60 * 1000
        : 7 * 24 * 60 * 60 * 1000;

    if (now - lastBackup >= intervalMs) {
      handleBackupToDrive(false);
    }
  }, [userSettings]);


  const handleSettleDebt = async (debtId: string, amount: number, category?: string, walletId?: string) => {
    try {
      await dashboardService.settleDebt(debtId, amount, token, category, walletId);
      await fetchData();
    } catch (e) {
      console.error('Error settling debt:', e);
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    try {
      await dashboardService.deleteDebt(debtId, token);
      await fetchData();
    } catch (e: any) {
      console.error('Error deleting debt:', e);
      throw e;
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
    try {
      await dashboardService.deleteTransaction(txId, token);
      await fetchData();
    } catch (e: any) {
      console.error('Error deleting transaction:', e);
      throw e;
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

  const handleSaveSettings = async (
    payload: {
      emergencyBuffer?: number;
      payday?: number;
      salary?: number;
      automatedDriveBackups?: boolean;
      lastDriveBackupDate?: string;
      driveBackupFrequency?: 'daily' | '3days' | 'weekly';
      googleDriveToken?: string;
    },
    notifyUser: boolean = true
  ) => {
    setIsSaving(true);
    // Optimistic update so UI toggles and switches respond instantly without reverting
    setUserSettings((prev: any) => ({
      ...(prev || {}),
      ...payload,
    }));
    try {
      await dashboardService.updateSettings(payload, token);
      await fetchData();
      if (notifyUser) {
        alert('Settings saved successfully!');
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      if (notifyUser) {
        alert('Failed to save settings.');
      }
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

  const handleBackupToDrive = async (interactive: boolean = false) => {
    try {
      let accessToken = await getGoogleAccessToken();
      if (!accessToken) {
        if (interactive) {
          const authRes = await googleSignIn();
          accessToken = authRes?.accessToken || null;
        }
        if (!accessToken) return;
      }

      // 1. Try server-side backup first (backend dumps database and uploads directly to Google Drive)
      try {
        const res = await dashboardService.backupToDrive(accessToken, token);
        if (res && res.success) {
          setUserSettings((prev: any) => ({
            ...(prev || {}),
            lastDriveBackupDate: res.lastDriveBackupDate,
          }));
          if (interactive) {
            alert('Database backup successfully uploaded to Google Drive!');
          }
          return;
        }
      } catch (serverErr) {
        console.warn('Server-side backup endpoint returned error, falling back to direct upload:', serverErr);
      }

      // 2. Client-side fallback if server-side route is unavailable
      const blob = await dashboardService.getSqlBlob(token);
      const filename = `truespend_backup_${new Date().toISOString().slice(0, 10)}.sql`;
      await uploadToGoogleDrive(accessToken, blob, filename);
      
      const newDate = new Date().toISOString();
      await handleSaveSettings({ lastDriveBackupDate: newDate }, false);
      if (interactive) {
        alert('Database backup successfully uploaded to Google Drive!');
      }
    } catch (e: any) {
      console.error('Backup to Google Drive failed:', e);
      if (interactive) {
        alert('Failed to upload backup to Google Drive: ' + (e?.message || 'Unknown error'));
      }
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

  const handleCreateWallet = async (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const created = await dashboardService.createWallet(payload, token);
      await fetchData();
      return created;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateWallet = async (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings'; isMain?: boolean; initialBalance?: number }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const updated = await dashboardService.updateWallet(id, payload, token);
      await fetchData();
      return updated;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteWallet = async (id: string, reassignToWalletId?: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.deleteWallet(id, reassignToWalletId, token);
      await fetchData();
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateContext = async (context: any) => {
    try {
      const created = await dashboardService.createContext(context, token);
      setContexts((prev) => [created, ...prev]);
    } catch (error) {
      console.error('Error creating context', error);
      throw error;
    }
  };

  const handleUpdateContext = async (id: string, updates: any) => {
    try {
      const updated = await dashboardService.updateContext(id, updates, token);
      setContexts((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (error) {
      console.error('Error updating context', error);
      throw error;
    }
  };

  const handleDeleteContext = async (id: string) => {
    try {
      await dashboardService.deleteContext(id, token);
      setContexts((prev) => prev.filter((c) => c.id !== id));
      // Re-fetch transactions because some might have had contextId nullified
      fetchData();
    } catch (error) {
      console.error('Error deleting context', error);
      throw error;
    }
  };

  const handleLinkTransactionsToContext = async (transactionIds: string[], contextId: string | null) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.linkTransactionsToContext(transactionIds, contextId, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error linking transactions to context:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateGoal = async (payload: { name: string; targetAmount: number; currentAmount?: number; walletId?: string | null; autoSyncBalance?: boolean; deadline?: string | null; category?: string; notes?: string }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.createGoal(payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error creating goal:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGoal = async (id: string, payload: { name?: string; targetAmount?: number; currentAmount?: number; walletId?: string | null; autoSyncBalance?: boolean; deadline?: string | null; category?: string; notes?: string }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.updateGoal(id, payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error updating goal:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleContributeToGoal = async (id: string, payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.contributeToGoal(id, payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error contributing to goal:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleWithdrawFromGoal = async (id: string, payload: { amount: number; walletId?: string; destinationWalletId?: string; note?: string; date?: string }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.withdrawFromGoal(id, payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error withdrawing from goal:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.deleteGoal(id, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error deleting goal:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateSubscription = async (payload: Partial<Subscription>) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.createSubscription(payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error creating subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateSubscription = async (id: string, payload: Partial<Subscription>) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.updateSubscription(id, payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error updating subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSubscription = async (id: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.deleteSubscription(id, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error deleting subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaySubscription = async (id: string, payload: { walletId?: string; date?: string } = {}) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.paySubscription(id, payload, token);
      await fetchData();
      return res;
    } catch (error) {
      console.error('Error paying subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDetectSubscriptions = async (): Promise<DetectedSubscription[]> => {
    if (!token) return [];
    try {
      return await dashboardService.detectSubscriptions(token);
    } catch (error) {
      console.error('Error detecting subscriptions:', error);
      return [];
    }
  };

  const syncedGoals = useMemo(() => {
    if (!goals) return [];
    if (!kpis?.accounts) return goals;
    const walletMap = new Map(kpis.accounts.map(w => [w.id, w.balance]));
    return goals.map(g => {
      if (g.autoSyncBalance && g.walletId && walletMap.has(g.walletId)) {
        return {
          ...g,
          currentAmount: String(Math.max(0, walletMap.get(g.walletId)!)),
        };
      }
      return g;
    });
  }, [goals, kpis?.accounts]);

  return {
    kpis,
    transactions,
    debts,
    payrolls,
    budgets,
    contexts,
    goals: syncedGoals,
    subscriptions,
    userSettings,
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
    handleCreateWallet,
    handleUpdateWallet,
    handleDeleteWallet,
    handleCreateContext,
    handleUpdateContext,
    handleDeleteContext,
    handleLinkTransactionsToContext,
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
    notifications,
  };
}
