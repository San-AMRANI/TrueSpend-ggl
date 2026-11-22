import { googleSignIn, getGoogleAccessToken } from '../lib/googleAuth';
import { uploadToGoogleDrive } from '../lib/driveUpload';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import {
  CategoryBudget,
  KPI,
  Transaction,
  Debt,
  DashboardTab,
  Payroll,
  Goal,
  Subscription,
  DetectedSubscription,
  InvestmentsData,
  StockMarketType,
  StockOrderAction,
  ExperienceTier,
} from '../types';
import { useNotifications } from './useNotifications';
import { netExpenseOf } from '../lib/finance';
import {
  getRequiredSlicesForTab,
  mergeTransactionsSlice,
  type TransactionsWindowMeta,
} from '../lib/bootstrapScopes';

export function useDashboardData(token: string | null, experienceTier?: ExperienceTier) {
  const [kpis, setKpis] = useState<KPI | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [contexts, setContexts] = useState<any[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [investmentsData, setInvestmentsData] = useState<InvestmentsData | null>(null);
  const [operationalRadar, setOperationalRadar] = useState<{
    upcomingCommitments: import('../types').CommitmentOccurrence[];
    pendingReviews: import('../types').FinancialReviewItem[];
    integritySummary: import('../types').FinancialIntegrityReport | null;
    externalWealthSummary: {
      items: import('../types').ExternalWealthItem[];
      totalExternalAssetsMad: number;
      totalExternalLiabilitiesMad: number;
      netExternalWealthMad: number;
      staleCount: number;
    } | null;
  } | null>(null);
  const [userSettings, setUserSettings] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [isImporting, setIsImporting] = useState<boolean>(false);
  const [analyticsMonth, setAnalyticsMonth] = useState<string>('All Time');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [whatIfAmount, setWhatIfAmount] = useState<number>(0);
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);

  // Partial / on-demand slice hydration flags
  const [transactionsWindow, setTransactionsWindow] = useState<TransactionsWindowMeta | null>(null);
  const [hasFullHistory, setHasFullHistory] = useState<boolean>(false);
  const [hasContexts, setHasContexts] = useState<boolean>(false);
  const [hasInvestments, setHasInvestments] = useState<boolean>(false);
  const [hasRadar, setHasRadar] = useState<boolean>(false);
  const [isHydratingHistory, setIsHydratingHistory] = useState<boolean>(false);
  const [isHydratingInvestments, setIsHydratingInvestments] = useState<boolean>(false);
  const [isHydratingRadar, setIsHydratingRadar] = useState<boolean>(false);

  const corePromiseRef = useRef<{ key: string; promise: Promise<void> } | null>(null);
  const historyPromiseRef = useRef<Promise<void> | null>(null);
  const investmentsPromiseRef = useRef<Promise<void> | null>(null);
  const radarPromiseRef = useRef<Promise<void> | null>(null);

  const notifications = useNotifications();
  const isAdvancedTier = experienceTier === 'advanced';

  const ensureHistoryLoaded = useCallback(
    async (force = false) => {
      if (!token) return;
      if (!force && hasFullHistory && (!isAdvancedTier || hasContexts)) return;
      if (historyPromiseRef.current) return historyPromiseRef.current;

      setIsHydratingHistory(true);
      const promise = (async () => {
        try {
          const hist = await dashboardService.getDashboardBootstrap(token, 'history');
          if (hist.transactions) {
            setTransactions(hist.transactions);
          }
          if (hist.transactionsWindow) {
            setTransactionsWindow(hist.transactionsWindow);
          }
          if (isAdvancedTier && hist.contexts) {
            setContexts(hist.contexts);
          }
          setHasFullHistory(true);
          setHasContexts(true);
        } catch (e) {
          console.error('Error hydrating transaction history:', e);
        } finally {
          setIsHydratingHistory(false);
          historyPromiseRef.current = null;
        }
      })();
      historyPromiseRef.current = promise;
      return promise;
    },
    [token, hasFullHistory, hasContexts, isAdvancedTier]
  );

  const ensureInvestmentsLoaded = useCallback(
    async (forceRefresh = false) => {
      if (!token || !isAdvancedTier) return;
      if (!forceRefresh && hasInvestments) return;
      if (investmentsPromiseRef.current && !forceRefresh) return investmentsPromiseRef.current;

      setIsHydratingInvestments(true);
      const promise = (async () => {
        try {
          const invData = await dashboardService.getInvestmentsData(token, forceRefresh);
          setInvestmentsData(invData || null);
          setHasInvestments(true);
        } catch (e) {
          console.error('Error hydrating investments data:', e);
        } finally {
          setIsHydratingInvestments(false);
          investmentsPromiseRef.current = null;
        }
      })();
      investmentsPromiseRef.current = promise;
      return promise;
    },
    [token, isAdvancedTier, hasInvestments]
  );

  const ensureRadarLoaded = useCallback(
    async (force = false) => {
      if (!token || !isAdvancedTier) return;
      if (!force && hasRadar) return;
      if (radarPromiseRef.current && !force) return radarPromiseRef.current;

      setIsHydratingRadar(true);
      const promise = (async () => {
        try {
          const res = await dashboardService.getDashboardBootstrap(token, 'radar');
          setOperationalRadar(res.operationalRadar ?? null);
          setHasRadar(true);
        } catch (e) {
          console.error('Error hydrating operational radar:', e);
        } finally {
          setIsHydratingRadar(false);
          radarPromiseRef.current = null;
        }
      })();
      radarPromiseRef.current = promise;
      return promise;
    },
    [token, isAdvancedTier, hasRadar]
  );

  const fetchData = useCallback(async () => {
    if (!token) return;
    const reqKey = `${token}:${isAdvancedTier ? 'adv' : 'basic'}`;
    if (corePromiseRef.current?.key === reqKey) {
      return corePromiseRef.current.promise;
    }

    setLoading(true);
    const promise = (async () => {
      try {
        const bootstrap = await dashboardService.getDashboardBootstrap(token, 'core');
        setKpis(bootstrap.kpis || null);
        const incomingPartial = Boolean(bootstrap.transactionsWindow?.isPartial);
        setTransactions(bootstrap.transactions || []);
        setTransactionsWindow(bootstrap.transactionsWindow ?? null);
        setHasFullHistory(!incomingPartial);
        setDebts(bootstrap.debts || []);
        setUserSettings(bootstrap.settings ?? null);
        setBudgets(bootstrap.budgets || []);
        setPayrolls(bootstrap.payrolls || []);
        setGoals(bootstrap.goals || []);
        setSubscriptions(bootstrap.subscriptions || []);
        if (Array.isArray(bootstrap.contexts)) {
          setContexts(bootstrap.contexts);
          setHasContexts(true);
        } else {
          setHasContexts(false);
        }
        // Reset lazy secondary flags so on-demand tabs/bands re-sync cleanly when needed
        setHasRadar(false);
        setHasInvestments(false);
        if (!isAdvancedTier) {
          setInvestmentsData(null);
          setOperationalRadar(null);
        }
      } catch (e) {
        console.error('Error fetching dashboard data:', e);
      } finally {
        setLoading(false);
        if (corePromiseRef.current?.key === reqKey) {
          corePromiseRef.current = null;
        }
      }
    })();

    corePromiseRef.current = { key: reqKey, promise };
    return promise;
  }, [token, isAdvancedTier]);

  const refreshLedger = useCallback(async () => {
    if (!token) return;
    try {
      const ledger = await dashboardService.getDashboardBootstrap(token, 'ledger', {
        full: hasFullHistory,
      });
      if (ledger.kpis) setKpis(ledger.kpis);
      if (ledger.transactions) {
        const isPartial = Boolean(ledger.transactionsWindow?.isPartial);
        setTransactions((prev) => mergeTransactionsSlice(prev, ledger.transactions!, isPartial));
        if (ledger.transactionsWindow) {
          setTransactionsWindow(ledger.transactionsWindow);
        }
      }
      if (ledger.debts) setDebts(ledger.debts);
      if (ledger.payrolls) setPayrolls(ledger.payrolls);
      if (ledger.budgets) setBudgets(ledger.budgets);
      if (hasRadar) {
        void ensureRadarLoaded(true);
      }
    } catch (e) {
      console.error('Error refreshing ledger data:', e);
    }
  }, [token, hasFullHistory, hasRadar, ensureRadarLoaded]);

  // Hydrate full history / investments strictly on demand when switching to a tab that requires them
  useEffect(() => {
    if (loading || !kpis || !token) return;
    const { needHistory, needInvestments } = getRequiredSlicesForTab(activeTab, {
      hasFullHistory,
      hasContexts,
      hasInvestments,
      isAdvanced: isAdvancedTier,
    });
    if (needHistory) {
      void ensureHistoryLoaded();
    }
    if (needInvestments) {
      void ensureInvestmentsLoaded();
    }
  }, [
    activeTab,
    loading,
    kpis,
    token,
    hasFullHistory,
    hasContexts,
    hasInvestments,
    isAdvancedTier,
    ensureHistoryLoaded,
    ensureInvestmentsLoaded,
  ]);

  // When fresh data arrives, schedule (or re-schedule) the smart notification stream
  useEffect(() => {
    if (!kpis) return;
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth() + 1;
    const monthlyBudgets = budgets.filter(
      b => b.year === currentYear && b.month === currentMonth,
    );
    const totalBudget = monthlyBudgets.reduce((s, b) => s + parseFloat(b.amount as any), 0);

    let totalSpent = 0;
    const spentByCategory = new Map<string, number>();
    for (const tx of transactions) {
      if (tx.type !== 'Expense') continue;
      const d = new Date(tx.createdAt);
      if (d.getUTCFullYear() !== currentYear || d.getUTCMonth() + 1 !== currentMonth) continue;
      const net = netExpenseOf(tx);
      totalSpent += net;
      if (tx.category) {
        spentByCategory.set(tx.category, (spentByCategory.get(tx.category) || 0) + net);
      }
    }

    const monthlyIncome = parseFloat((kpis as any).monthlyIncome ?? 0);
    const monthlyExpenses = parseFloat((kpis as any).monthlyExpenses ?? 0);

    const overspentCategories = monthlyBudgets
      .filter(b => (spentByCategory.get(b.category) || 0) > parseFloat(b.amount as any))
      .map(b => b.category);

    const topCategory =
      [...monthlyBudgets].sort((a, b) => parseFloat(b.amount as any) - parseFloat(a.amount as any))[0]
        ?.category ?? null;

    const totalLiquidBalance = ((kpis as any).accounts || [])
      .filter((a: any) => a.type !== 'Investment')
      .reduce((s: number, a: any) => s + Number(a.balance || 0), 0);

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
      transactions,
      subscriptions,
      investmentsData,
      debts,
      goals,
      payrolls,
      budgets,
      emergencyBuffer: Number((kpis as any)?.emergencyBuffer || 0),
      totalLiquidBalance,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis, budgets, transactions, subscriptions, investmentsData, debts, goals, payrolls]);

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
      await refreshLedger();
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: `Settled ${amount.toFixed(2)} MAD in wallet.`, type: 'success' },
        })
      );
    } catch (e) {
      console.error('Error settling debt:', e);
    }
  };

  const handleForgiveDebt = async (
    debtId: string,
    amount: number,
    reason?: string,
    note?: string
  ) => {
    try {
      await dashboardService.forgiveDebt(debtId, { amount, reason, note }, token);
      await refreshLedger();
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: {
            message: `Freed ${amount.toFixed(2)} MAD debt without adding as reimbursement.`,
            type: 'success',
          },
        })
      );
    } catch (e: any) {
      console.error('Error forgiving debt:', e);
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: e?.message || 'Failed to forgive debt.', type: 'error' },
        })
      );
      throw e;
    }
  };

  const handleDeleteDebt = async (debtId: string) => {
    try {
      await dashboardService.deleteDebt(debtId, token);
      await refreshLedger();
    } catch (e: any) {
      console.error('Error deleting debt:', e);
      throw e;
    }
  };

  const handleEditDebt = async (debtId: string, updatedAmount: string, updatedContact: string, updatedType: string) => {
    try {
      await dashboardService.updateDebt(
        debtId,
        {
          amount: parseFloat(updatedAmount),
          contact: updatedContact,
          type: updatedType,
        },
        token
      );
      await refreshLedger();
      window.dispatchEvent(new CustomEvent('truespend:toast', { detail: { message: 'Debt record updated successfully.', type: 'success' } }));
    } catch (e: any) {
      console.error('Error updating debt:', e);
      window.dispatchEvent(new CustomEvent('truespend:toast', { detail: { message: e?.message || 'Failed to update debt.', type: 'error' } }));
      throw e;
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    try {
      await dashboardService.deleteTransaction(txId, token);
      await refreshLedger();
    } catch (e: any) {
      console.error('Error deleting transaction:', e);
      throw e;
    }
  };

  const handleSaveCategoryBudget = async (category: string, year: number, month: number, amount: number) => {
    await dashboardService.saveCategoryBudget({ category, year, month, amount }, token);
    await refreshLedger();
  };

  const handleSaveCategoryBudgetsBatch = async (budgets: { category: string; year: number; month: number; amount: number }[]) => {
    await dashboardService.saveCategoryBudgetsBatch(budgets, token);
    await refreshLedger();
  };


  const handleCopyPreviousMonthBudgets = async (year: number, month: number) => {
    const result = await dashboardService.copyPreviousMonthBudgets(year, month, token);
    await refreshLedger();
    return result.copied;
  };

  const handleClearCategoryBudgetsMonth = async (year: number, month: number) => {
    const result = await dashboardService.clearCategoryBudgetsMonth(year, month, token);
    await refreshLedger();
    return result.count;
  };

  const handleDeleteCategoryBudget = async (id: string) => {
    await dashboardService.deleteCategoryBudget(id, token);
    await refreshLedger();
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
      const [settingsData, ledger] = await Promise.all([
        dashboardService.getSettings(token),
        dashboardService.getDashboardBootstrap(token, 'ledger'),
      ]);
      setUserSettings(settingsData);
      if (ledger.kpis) setKpis(ledger.kpis);
      if (ledger.payrolls) setPayrolls(ledger.payrolls);
      if (notifyUser) {
        window.dispatchEvent(new CustomEvent('truespend:toast', { detail: { message: 'Settings saved successfully!', type: 'success' } }));
      }
    } catch (e) {
      console.error('Error saving settings:', e);
      if (notifyUser) {
        window.dispatchEvent(new CustomEvent('truespend:toast', { detail: { message: 'Failed to save settings.', type: 'error' } }));
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreatePayroll = async (scheduledFor: string, amount: number, walletId?: string | null) => {
    await dashboardService.createPayroll(
      { scheduledFor, amount, ...(walletId ? { walletId } : {}) },
      token
    );
    await refreshLedger();
  };

  const handleUpdatePayroll = async (
    payrollId: string,
    payload: { scheduledFor?: string; amount?: number; walletId?: string | null }
  ) => {
    await dashboardService.updatePayroll(payrollId, payload, token);
    await refreshLedger();
  };

  const handleDeletePayroll = async (payrollId: string) => {
    await dashboardService.deletePayroll(payrollId, token);
    await refreshLedger();
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

  const handleCreateWallet = async (payload: { name: string; type: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const created = await dashboardService.createWallet(payload, token);
      await refreshLedger();
      return created;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateWallet = async (id: string, payload: { name?: string; type?: 'Bank' | 'Cash' | 'Savings' | 'Investment'; isMain?: boolean; initialBalance?: number }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const updated = await dashboardService.updateWallet(id, payload, token);
      await refreshLedger();
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
      await refreshLedger();
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
      // Re-fetch ledger transactions because some might have had contextId nullified
      await refreshLedger();
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
      await refreshLedger();
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
      const goalData = await dashboardService.getGoals(token);
      setGoals(goalData || []);
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
      const goalData = await dashboardService.getGoals(token);
      setGoals(goalData || []);
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
      const [goalData] = await Promise.all([
        dashboardService.getGoals(token),
        refreshLedger(),
      ]);
      setGoals(goalData || []);
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
      const [goalData] = await Promise.all([
        dashboardService.getGoals(token),
        refreshLedger(),
      ]);
      setGoals(goalData || []);
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
      const goalData = await dashboardService.getGoals(token);
      setGoals(goalData || []);
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
      const subData = await dashboardService.getSubscriptions(token);
      setSubscriptions(subData || []);
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
      const subData = await dashboardService.getSubscriptions(token);
      setSubscriptions(subData || []);
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
      const subData = await dashboardService.getSubscriptions(token);
      setSubscriptions(subData || []);
      return res;
    } catch (error) {
      console.error('Error deleting subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handlePaySubscription = async (
    id: string,
    payload: { walletId?: string; date?: string; amount?: number; updateBaselineAmount?: boolean } = {}
  ) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.paySubscription(id, payload, token);
      const [subData] = await Promise.all([
        dashboardService.getSubscriptions(token),
        refreshLedger(),
      ]);
      setSubscriptions(subData || []);
      return res;
    } catch (error) {
      console.error('Error paying subscription:', error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangeSubscriptionPlan = async (
    id: string,
    payload: import('../types').SubscriptionPlanChangePayload
  ) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.changeSubscriptionPlan(id, payload, token);
      const [subData] = await Promise.all([
        dashboardService.getSubscriptions(token),
        refreshLedger(),
      ]);
      setSubscriptions(subData || []);
      return res;
    } catch (error) {
      console.error('Error changing subscription plan:', error);
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

  const handleUpsertStockPosition = async (payload: {
    ticker: string;
    companyName?: string;
    market?: StockMarketType;
    sector?: string;
    shares?: number;
    avgCostPerShare?: number;
    currentPrice?: number;
    currency?: string;
    annualDividendPerShare?: number;
    targetWeightPercent?: number;
    convictionThesis?: string;
    isWatchlistOnly?: boolean;
    walletId?: string | null;
    syncWithWallet?: boolean;
  }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.upsertStockPosition(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        payload.syncWithWallet ? refreshLedger() : Promise.resolve(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateStockPosition = async (
    id: string,
    payload: {
      companyName?: string;
      market?: StockMarketType;
      sector?: string;
      shares?: number;
      avgCostPerShare?: number;
      currentPrice?: number;
      currency?: string;
      annualDividendPerShare?: number;
      targetWeightPercent?: number;
      convictionThesis?: string | null;
      walletId?: string | null;
      isWatchlistOnly?: boolean;
    }
  ) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.updateStockPosition(id, payload, token);
      const invData = await dashboardService.getInvestmentsData(token);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStockPosition = async (id: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.deleteStockPosition(id, token);
      const invData = await dashboardService.getInvestmentsData(token);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteStockOrder = async (payload: {
    positionId?: string;
    ticker?: string;
    action: StockOrderAction;
    shares?: number;
    pricePerShare?: number;
    totalNativeAmount?: number;
    walletId?: string | null;
    syncWithWallet?: boolean;
    notes?: string;
  }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.executeStockOrder(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStockOrder = async (id: string) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.deleteStockOrder(id, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecutePaydayAllocation = async (payload: {
    walletId?: string | null;
    syncWithWallet?: boolean;
    allocations: { positionId: string; amountMad: number }[];
  }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.executePaydayAllocation(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleFundInvestmentWallet = async (payload: {
    sourceWalletId?: string;
    destinationWalletId?: string;
    amountMad: number;
    notes?: string;
  }) => {
    if (!token) return;
    setIsSaving(true);
    try {
      const res = await dashboardService.fundInvestmentWallet(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSearchStocks = async (q: string) => {
    if (!token) return [];
    try {
      return await dashboardService.searchStocks(q, token);
    } catch {
      return [];
    }
  };

  const handleRefreshInvestments = async (forceRefresh: boolean = true) => {
    if (!token) return null;
    setIsSaving(true);
    try {
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token, forceRefresh),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return invData;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncBinanceWallet = async (payload: {
    walletId?: string;
    mode?: 'stablecoins_only' | 'full_spot_balance';
  }) => {
    if (!token) return null;
    setIsSaving(true);
    try {
      const res = await dashboardService.syncBinanceWallet(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleLogWalletCapitalTransfer = async (payload: {
    direction: 'deposit' | 'withdrawal';
    bankWalletId?: string;
    investmentWalletId?: string;
    amountMad: number;
    notes?: string;
  }) => {
    if (!token) return null;
    setIsSaving(true);
    try {
      const res = await dashboardService.logWalletCapitalTransfer(payload, token);
      const [invData] = await Promise.all([
        dashboardService.getInvestmentsData(token),
        refreshLedger(),
      ]);
      setInvestmentsData(invData || null);
      return res;
    } finally {
      setIsSaving(false);
    }
  };

  const handleFetchBinanceTrades = async (params: {
    symbol: string;
    limit?: number;
    refresh?: boolean;
  }) => {
    if (!token) throw new Error('Authentication required');
    return await dashboardService.getBinanceTrades(params, token);
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
    investmentsData,
    operationalRadar,
    userSettings,
    loading,
    isSaving,
    isExporting,
    isImporting,
    transactionsWindow,
    hasFullHistory,
    isHydratingHistory,
    isHydratingInvestments,
    isHydratingRadar,
    ensureHistoryLoaded,
    ensureInvestmentsLoaded,
    ensureRadarLoaded,
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
    notifications,
  };
}

