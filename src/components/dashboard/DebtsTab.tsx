import React, { useState, useMemo } from 'react';
import { Debt, CategoryBudget, DashboardTab } from '../../types';
import DebtForm from '../DebtForm';
import { SettleDebtModal } from '../SettleDebtModal';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  CheckCircle2,
  ArrowDownRight,
  ArrowUpRight,
  Edit2,
  Trash2,
  History,
  Plus,
  Zap,
  ExternalLink,
  X,
  HeartHandshake,
  Calendar,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  Percent,
  Building2,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import { AnimatedMetricValue, MotionModal } from '../ui/MotionPrimitives';

interface DebtsTabProps {
  debts: Debt[];
  wallets?: { id: string; name: string }[];
  budgets?: CategoryBudget[];
  fetchData: () => void;
  handleSettle: (debtId: string, amount: number, category?: string, walletId?: string) => Promise<void> | void;
  handleForgive?: (debtId: string, amount: number, reason?: string, note?: string) => Promise<void>;
  handleEditDebt: (debtId: string, currentAmount: string, currentContact: string, currentType: string) => void;
  handleDeleteDebt: (debtId: string) => void;
  onSaveBudget?: (category: string, year: number, month: number, amount: number) => Promise<void>;
  setActiveTab?: (tab: DashboardTab) => void;
  openTransaction?: (transactionId: string) => void;
}

export const DebtsTab: React.FC<DebtsTabProps> = ({
  debts,
  wallets,
  budgets = [],
  fetchData,
  handleSettle,
  handleForgive,
  handleEditDebt,
  handleDeleteDebt,
  onSaveBudget,
  setActiveTab: setDashboardTab,
  openTransaction,
}) => {
  const [settlingDebt, setSettlingDebt] = useState<Debt | null>(null);
  const [settleModalMode, setSettleModalMode] = useState<'settle' | 'forgive'>('settle');
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);
  const [editContact, setEditContact] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editType, setEditType] = useState<'Receivable' | 'Payable'>('Receivable');
  const [isUpdatingDebt, setIsUpdatingDebt] = useState(false);
  const [deletingDebt, setDeletingDebt] = useState<Debt | null>(null);
  const [activeTab, setActiveTab] = useState<'receivable' | 'payable' | 'cleared' | 'all'>('receivable');
  const [showAddForm, setShowAddForm] = useState(false);
  const [reservingInBudget, setReservingInBudget] = useState(false);
  const [budgetSuccessMsg, setBudgetSuccessMsg] = useState<string | null>(null);
  const [expandedScheduleDebtId, setExpandedScheduleDebtId] = useState<string | null>(null);
  const [payoffStrategy, setPayoffStrategy] = useState<'avalanche' | 'snowball'>('avalanche');
  const [extraMonthlyPayment, setExtraMonthlyPayment] = useState<number>(500);

  const openEditModal = (debt: Debt) => {
    setEditingDebt(debt);
    setEditContact(debt.contactName);
    setEditAmount(debt.originalAmount);
    setEditType(debt.type);
  };

  const submitEditDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDebt) return;
    setIsUpdatingDebt(true);
    try {
      await handleEditDebt(editingDebt.id, editAmount, editContact.trim(), editType);
      setEditingDebt(null);
    } finally {
      setIsUpdatingDebt(false);
    }
  };

  const { totalReceivable, totalPayable, filteredDebts, pendingPayables } = useMemo(() => {
    const pendingReceivables = debts.filter((d) => d.type === 'Receivable' && d.status === 'Pending');
    const pendingPayables = debts.filter((d) => d.type === 'Payable' && d.status === 'Pending');

    const totalReceivable = pendingReceivables.reduce(
      (acc, curr) => acc + parseFloat(curr.remainingBalance),
      0
    );
    const totalPayable = pendingPayables.reduce(
      (acc, curr) => acc + parseFloat(curr.remainingBalance),
      0
    );

    const filteredDebts = debts.filter((debt) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'receivable') return debt.type === 'Receivable' && debt.status === 'Pending';
      if (activeTab === 'payable') return debt.type === 'Payable' && debt.status === 'Pending';
      if (activeTab === 'cleared') return debt.status === 'Cleared';
      return true;
    });

    return { totalReceivable, totalPayable, filteredDebts, pendingPayables };
  }, [debts, activeTab]);

  // Payoff Strategy Simulator (Avalanche vs Snowball)
  const strategyComparison = useMemo(() => {
    if (pendingPayables.length === 0) return null;

    const simulateStrategy = (mode: 'avalanche' | 'snowball', extraBoost: number) => {
      const items = pendingPayables.map((d) => {
        const balance = Math.max(0, parseFloat(d.remainingBalance) || 0);
        const apr = Math.max(0, parseFloat(String(d.interestRateApr || '0')) || 0);
        const minInst = Math.max(
          50,
          parseFloat(String(d.installmentAmount || '0')) || Math.max(100, Math.round(balance * 0.08))
        );
        return {
          id: d.id,
          name: d.contactName,
          balance,
          apr,
          minPayment: Math.min(balance, minInst),
          paidOffMonth: 0,
        };
      });

      const order = [...items].sort((a, b) =>
        mode === 'avalanche'
          ? b.apr - a.apr || a.balance - b.balance
          : a.balance - b.balance || b.apr - a.apr
      );

      let months = 0;
      let totalInterest = 0;
      const working = order.map((x) => ({ ...x }));

      while (working.some((w) => w.balance > 0.01) && months < 120) {
        months++;
        let availableExtra = Math.max(0, extraBoost);

        // Accrue monthly interest and pay minimums first
        for (const w of working) {
          if (w.balance <= 0.01) continue;
          const monthlyInterest = w.balance * (w.apr / 100 / 12);
          totalInterest += monthlyInterest;
          w.balance += monthlyInterest;

          const payment = Math.min(w.balance, w.minPayment);
          w.balance -= payment;
          if (w.balance <= 0.01) {
            w.balance = 0;
            if (!w.paidOffMonth) w.paidOffMonth = months;
          }
        }

        // Apply extra boost to top priority active debt
        for (const w of working) {
          if (w.balance <= 0.01 || availableExtra <= 0) continue;
          const extraApplied = Math.min(w.balance, availableExtra);
          w.balance -= extraApplied;
          availableExtra -= extraApplied;
          if (w.balance <= 0.01) {
            w.balance = 0;
            if (!w.paidOffMonth) w.paidOffMonth = months;
          }
        }
      }

      return {
        months,
        totalInterest: Math.round(totalInterest * 100) / 100,
        orderedTargets: working.map((w) => ({
          id: w.id,
          name: w.name,
          apr: w.apr,
          paidOffMonth: w.paidOffMonth || months,
        })),
      };
    };

    const avalanche = simulateStrategy('avalanche', extraMonthlyPayment);
    const snowball = simulateStrategy('snowball', extraMonthlyPayment);
    const baselineNoExtra = simulateStrategy(payoffStrategy, 0);
    const active = payoffStrategy === 'avalanche' ? avalanche : snowball;
    const interestSavedVsBaseline = Math.max(0, baselineNoExtra.totalInterest - active.totalInterest);
    const monthsSavedVsBaseline = Math.max(0, baselineNoExtra.months - active.months);

    return {
      avalanche,
      snowball,
      active,
      interestSavedVsBaseline,
      monthsSavedVsBaseline,
    };
  }, [pendingPayables, payoffStrategy, extraMonthlyPayment]);

  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1;

  const currentDebtBudget = useMemo(() => {
    const b = (budgets || []).find(
      (item) =>
        item.category === '💳 Debt & Obligations' &&
        item.year === currentYear &&
        item.month === currentMonth
    );
    return b ? parseFloat(b.amount) || 0 : 0;
  }, [budgets, currentYear, currentMonth]);

  const targetMonthlyDebtPayoff = useMemo(() => {
    if (totalPayable <= 0) return 0;
    if (totalPayable <= 1000) return totalPayable;
    return Math.min(totalPayable, Math.max(300, Math.round(totalPayable * 0.1)));
  }, [totalPayable]);

  const isBudgetReserved = totalPayable > 0 && currentDebtBudget >= targetMonthlyDebtPayoff;

  const handleQuickReserveInBudget = async () => {
    if (!onSaveBudget || targetMonthlyDebtPayoff <= 0) return;
    setReservingInBudget(true);
    try {
      await onSaveBudget('💳 Debt & Obligations', currentYear, currentMonth, targetMonthlyDebtPayoff);
      setBudgetSuccessMsg(
        `Reserved ${targetMonthlyDebtPayoff.toFixed(2)} MAD for debt repayment in this month's budget!`
      );
      setTimeout(() => setBudgetSuccessMsg(null), 4000);
      fetchData();
    } catch (e: any) {
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: e.message || 'Failed to update budget', type: 'error' },
        })
      );
    } finally {
      setReservingInBudget(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-100 dark:border-blue-900/30 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-10 pointer-events-none">
            <ArrowDownRight className="w-24 h-24 text-blue-600 dark:text-blue-400" />
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400 mb-1">
              <ArrowDownRight className="h-4 w-4" />
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide">Owed to you</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
              <AnimatedMetricValue value={totalReceivable} /> <span className="text-sm font-sans font-normal text-gray-500">MAD</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-100 dark:border-orange-900/30 overflow-hidden relative">
          <div className="absolute -right-4 -top-4 opacity-5 dark:opacity-10 pointer-events-none">
            <ArrowUpRight className="w-24 h-24 text-orange-600 dark:text-orange-400" />
          </div>
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400 mb-1">
              <ArrowUpRight className="h-4 w-4" />
              <h3 className="font-semibold text-xs sm:text-sm uppercase tracking-wide">You owe</h3>
            </div>
            <p className="text-2xl sm:text-3xl font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100">
              <AnimatedMetricValue value={totalPayable} /> <span className="text-sm font-sans font-normal text-gray-500">MAD</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Interconnected Monthly Budget Sync & Protection ── */}
      <AnimatePresence>
        {budgetSuccessMsg && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-xl bg-emerald-600 text-white p-3 text-xs font-semibold flex items-center gap-2 shadow-sm"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>{budgetSuccessMsg}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {totalPayable > 0 && (
        <Card
          className={`border overflow-hidden shadow-xs transition-all ${
            isBudgetReserved
              ? 'border-emerald-200 dark:border-emerald-900/50 bg-gradient-to-r from-emerald-50/60 via-white to-white dark:from-emerald-950/20 dark:via-gray-900 dark:to-gray-900'
              : 'border-orange-200 dark:border-orange-900/50 bg-gradient-to-r from-orange-50/60 via-white to-white dark:from-orange-950/20 dark:via-gray-900 dark:to-gray-900'
          }`}
        >
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-xs ${
                    isBudgetReserved
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                      : 'bg-orange-100 text-orange-700 dark:bg-orange-900/60 dark:text-orange-300'
                  }`}
                >
                  <Zap className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100">
                      Monthly Budget Debt Reserve
                    </h4>
                    <span
                      className={`text-xs font-semibold ${
                        isBudgetReserved
                          ? 'text-emerald-700 dark:text-emerald-400'
                          : 'text-orange-700 dark:text-orange-400'
                      }`}
                    >
                      · {isBudgetReserved ? 'Fully Reserved' : 'Unreserved Gap'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 max-w-xl">
                    {isBudgetReserved ? (
                      <>
                        Your monthly budget has safely reserved{' '}
                        <strong className="font-mono tabular-nums">{currentDebtBudget.toFixed(2)} MAD</strong> this cycle for debt
                        servicing. Your payoff strategy is protected.
                      </>
                    ) : (
                      <>
                        You owe <strong className="font-mono tabular-nums">{totalPayable.toFixed(2)} MAD</strong>, but your budget
                        currently reserves <strong className="font-mono tabular-nums">{currentDebtBudget.toFixed(2)} MAD</strong>{' '}
                        (target: <strong className="font-mono tabular-nums">{targetMonthlyDebtPayoff.toFixed(2)} MAD</strong>). Reserve
                        cash in your budget to prevent overspending discretionary money.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                {!isBudgetReserved && onSaveBudget && (
                  <Button
                    size="sm"
                    disabled={reservingInBudget}
                    onClick={handleQuickReserveInBudget}
                    className="bg-orange-600 hover:bg-orange-700 text-white text-xs h-8 shadow-xs flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    <span>
                      {reservingInBudget
                        ? 'Reserving…'
                        : `Reserve ${targetMonthlyDebtPayoff.toFixed(0)} MAD in Budget`}
                    </span>
                  </Button>
                )}
                {setDashboardTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDashboardTab('budgets')}
                    className="text-xs h-8 whitespace-nowrap"
                  >
                    <span>Budget Planner</span>
                    <ExternalLink className="h-3 w-3 ml-1 text-gray-400" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Payoff Strategy Simulator (Avalanche vs Snowball) ── */}
      {strategyComparison && pendingPayables.length > 0 && (
        <Card className="border-gray-200 dark:border-gray-800">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <TrendingDown className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Debt Payoff Strategy Optimizer</span>
                </CardTitle>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  Compare highest-APR priority (Avalanche) against smallest-balance momentum (Snowball)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg">
                  {([
                    { id: 'avalanche', label: 'Avalanche (Highest APR)' },
                    { id: 'snowball', label: 'Snowball (Smallest First)' },
                  ] as const).map((strat) => {
                    const active = payoffStrategy === strat.id;
                    return (
                      <button
                        key={strat.id}
                        type="button"
                        onClick={() => setPayoffStrategy(strat.id)}
                        className={`relative px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-colors cursor-pointer ${
                          active
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : 'text-gray-600 dark:text-gray-400'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="debtStrategyPill"
                            transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                            className="absolute inset-0 rounded-md bg-white dark:bg-gray-800 shadow-xs"
                          />
                        )}
                        <span className="relative z-10">{strat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 sm:p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">
                  Estimated Debt-Free Horizon
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5 block">
                  {strategyComparison.active.months} {strategyComparison.active.months === 1 ? 'month' : 'months'}
                </span>
                {strategyComparison.monthsSavedVsBaseline > 0 && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                    {strategyComparison.monthsSavedVsBaseline} mo faster with extra boost
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
                <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 block">
                  Projected Total Interest
                </span>
                <span className="text-lg font-bold font-mono tabular-nums text-gray-900 dark:text-gray-100 mt-0.5 block">
                  {strategyComparison.active.totalInterest.toFixed(2)} MAD
                </span>
                {strategyComparison.interestSavedVsBaseline > 0 && (
                  <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium font-mono tabular-nums">
                    Saves {strategyComparison.interestSavedVsBaseline.toFixed(0)} MAD interest
                  </span>
                )}
              </div>

              <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800 sm:col-span-2">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400">
                    Extra Monthly Principal Boost
                  </span>
                  <span className="text-xs font-bold font-mono tabular-nums text-indigo-600 dark:text-indigo-400">
                    +{extraMonthlyPayment} MAD / mo
                  </span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[0, 250, 500, 1000, 2000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setExtraMonthlyPayment(amt)}
                      className={`px-2.5 py-1 rounded-md text-xs font-mono tabular-nums transition-colors ${
                        extraMonthlyPayment === amt
                          ? 'bg-indigo-600 text-white font-semibold'
                          : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800'
                      }`}
                    >
                      +{amt} MAD
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {strategyComparison.active.orderedTargets.length > 1 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
                <span className="text-gray-500 dark:text-gray-400 shrink-0 font-medium">Execution Order:</span>
                {strategyComparison.active.orderedTargets.map((t, idx) => (
                  <React.Fragment key={t.id}>
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 shrink-0">
                      <span className="font-mono text-[11px] text-indigo-600 dark:text-indigo-400 font-bold">
                        #{idx + 1}
                      </span>
                      <span className="font-medium">{t.name}</span>
                      {t.apr > 0 && (
                        <span className="text-[11px] font-mono tabular-nums text-orange-600 dark:text-orange-400">
                          ({t.apr.toFixed(1)}% APR)
                        </span>
                      )}
                      <span className="text-[11px] font-mono tabular-nums text-gray-500">
                        · Mo {t.paidOffMonth}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Add New Debt Form / Button */}
      <AnimatePresence mode="wait" initial={false}>
        {!showAddForm ? (
          <motion.div
            key="add-debt-btn"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
          >
            <Button onClick={() => setShowAddForm(true)} className="w-full sm:w-auto shadow-sm">
              <Plus className="h-4 w-4 mr-1.5" /> Add New Debt, Split, or Amortized Loan
            </Button>
          </motion.div>
        ) : (
          <motion.div
            key="add-debt-form"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="relative"
          >
            <DebtForm
              onSuccess={() => {
                fetchData();
                setShowAddForm(false);
              }}
            />
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-3 right-3 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800"
              onClick={() => setShowAddForm(false)}
            >
              Cancel
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Debts List */}
      <Card>
        <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Debts, IOUs &amp; Amortized Schedules</CardTitle>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Settle via wallet, inspect principal/interest amortization, or forgive debts cleanly
              </p>
            </div>

            {/* Tabs */}
            <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-lg w-full sm:w-auto overflow-x-auto hide-scrollbar">
              {([
                { id: 'receivable', label: 'Owed to You', activeColor: 'text-blue-600 dark:text-blue-400' },
                { id: 'payable', label: 'You Owe', activeColor: 'text-orange-600 dark:text-orange-400' },
                { id: 'cleared', label: 'Settled / Freed', activeColor: 'text-green-600 dark:text-green-400' },
                { id: 'all', label: 'All', activeColor: 'text-gray-900 dark:text-gray-100' },
              ] as const).map((tab) => {
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 sm:flex-none px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded-md whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                      active
                        ? tab.activeColor
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="debtFilterPill"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                        className="absolute inset-0 rounded-md bg-white dark:bg-gray-800 shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y divide-gray-100 dark:divide-gray-800/60">
            {filteredDebts.length > 0 ? (
              filteredDebts.map((debt) => {
                const forgivenAmt = parseFloat(debt.forgivenAmount || '0') || 0;
                const apr = parseFloat(String(debt.interestRateApr || '0')) || 0;
                const installmentAmt = parseFloat(String(debt.installmentAmount || '0')) || 0;
                const schedule = debt.amortizationSchedule || [];
                const isScheduleExpanded = expandedScheduleDebtId === debt.id;

                return (
                  <div
                    key={debt.id}
                    className="p-4 sm:p-5 transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/20 group"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3.5">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                            debt.status === 'Cleared'
                              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500'
                              : debt.type === 'Receivable'
                              ? 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400'
                              : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10 dark:text-orange-400'
                          }`}
                        >
                          {debt.status === 'Cleared' ? (
                            <CheckCircle2 className="h-5 w-5" />
                          ) : debt.type === 'Receivable' ? (
                            <ArrowDownRight className="h-5 w-5" />
                          ) : (
                            <ArrowUpRight className="h-5 w-5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                              {debt.contactName}
                            </p>
                            {debt.counterpartyType && debt.counterpartyType !== 'person' && (
                              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-gray-500 dark:text-gray-400">
                                <Building2 className="h-3 w-3" />
                                <span className="capitalize">{debt.counterpartyType}</span>
                              </span>
                            )}
                            {apr > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[11px] font-mono tabular-nums font-semibold text-orange-600 dark:text-orange-400">
                                <Percent className="h-3 w-3" />
                                {apr.toFixed(2)}% APR
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                            <span>{format(new Date(debt.createdAt), 'MMM d, yyyy')}</span>
                            <span>·</span>
                            <span className="font-medium text-gray-600 dark:text-gray-300">
                              {debt.type === 'Receivable' ? 'Owes you' : 'You owe'}
                            </span>
                            <span>·</span>
                            <span
                              className={`font-semibold ${
                                debt.status === 'Pending'
                                  ? 'text-amber-600 dark:text-amber-400'
                                  : forgivenAmt > 0
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : 'text-green-600 dark:text-green-400'
                              }`}
                            >
                              {debt.status === 'Cleared' && forgivenAmt > 0
                                ? `Freed (${forgivenAmt.toFixed(0)} MAD Waived)`
                                : debt.status}
                            </span>
                            {debt.dueDate && debt.status === 'Pending' && (
                              <>
                                <span>·</span>
                                <span className="text-orange-600 dark:text-orange-400 font-medium">
                                  Due {format(new Date(debt.dueDate), 'MMM d')}
                                </span>
                              </>
                            )}
                            {installmentAmt > 0 && debt.status === 'Pending' && (
                              <>
                                <span>·</span>
                                <span className="font-mono tabular-nums text-indigo-600 dark:text-indigo-400 font-medium">
                                  {installmentAmt.toFixed(0)} MAD / {debt.installmentFrequency || 'mo'}
                                </span>
                              </>
                            )}
                            {typeof debt.earlySettlementSavingsMad === 'number' &&
                              debt.earlySettlementSavingsMad > 0 &&
                              debt.status === 'Pending' && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-medium">
                                    Early payoff saves {debt.earlySettlementSavingsMad.toFixed(0)} MAD
                                  </span>
                                </>
                              )}
                          </div>
                          {debt.originDescription && (
                            <div className="mt-1 flex items-center gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                              <span>{debt.originDescription}</span>
                              {debt.originTransactionId && openTransaction && (
                                <button
                                  type="button"
                                  onClick={() => openTransaction(debt.originTransactionId!)}
                                  className="text-indigo-600 dark:text-indigo-400 hover:underline font-medium inline-flex items-center gap-0.5"
                                >
                                  View Transaction <ExternalLink className="w-2.5 h-2.5" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4 pl-14 sm:pl-0">
                        <div className="text-right">
                          <div
                            className={`font-semibold font-mono tabular-nums ${
                              debt.status === 'Cleared'
                                ? 'text-gray-400 dark:text-gray-500 line-through'
                                : 'text-gray-900 dark:text-gray-100'
                            }`}
                          >
                            {parseFloat(debt.remainingBalance).toFixed(2)} MAD
                          </div>
                          <div className="text-xs font-mono tabular-nums text-gray-500 dark:text-gray-400 mt-0.5">
                            of {parseFloat(debt.originalAmount).toFixed(2)} MAD total
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5">
                          {schedule.length > 0 && debt.status === 'Pending' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() =>
                                setExpandedScheduleDebtId(isScheduleExpanded ? null : debt.id)
                              }
                              className="h-8 text-xs text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 flex items-center gap-1 whitespace-nowrap"
                            >
                              <Calendar className="h-3.5 w-3.5" />
                              <span>Schedule ({schedule.length})</span>
                              {isScheduleExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          )}
                          {debt.status === 'Pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSettleModalMode('settle');
                                  setSettlingDebt(debt);
                                }}
                                className="h-8 shadow-xs text-xs text-gray-700 dark:text-gray-200 whitespace-nowrap"
                              >
                                Settle
                              </Button>
                              {handleForgive && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSettleModalMode('forgive');
                                    setSettlingDebt(debt);
                                  }}
                                  title="Free / forgive this debt without logging a wallet reimbursement"
                                  className="h-8 shadow-xs text-xs border-emerald-200 dark:border-emerald-800/60 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 flex items-center gap-1 whitespace-nowrap"
                                >
                                  <HeartHandshake className="h-3.5 w-3.5" />
                                  <span>Free Debt</span>
                                </Button>
                              )}
                            </>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-500/10"
                            onClick={() => openEditModal(debt)}
                            title="Edit Debt"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
                            onClick={() => setDeletingDebt(debt)}
                            title="Delete Debt"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Expandable Dated Amortization Schedule Table */}
                    <AnimatePresence initial={false}>
                      {isScheduleExpanded && schedule.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                          className="mt-4 pl-0 sm:pl-14"
                        >
                        <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden bg-gray-50/50 dark:bg-gray-900/40">
                          <div className="px-3.5 py-2.5 border-b border-gray-200 dark:border-gray-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <span className="font-semibold text-gray-900 dark:text-gray-100">
                              Dated Amortization Schedule ({schedule.length} installments)
                            </span>
                            <div className="flex items-center gap-3 font-mono tabular-nums text-gray-600 dark:text-gray-400">
                              {typeof debt.totalPayoffWithFeesMad === 'number' && (
                                <span>Total Payoff: {debt.totalPayoffWithFeesMad.toFixed(2)} MAD</span>
                              )}
                              {typeof debt.earlySettlementSavingsMad === 'number' &&
                                debt.earlySettlementSavingsMad > 0 && (
                                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                                    Early Settlement Savings: {debt.earlySettlementSavingsMad.toFixed(2)} MAD
                                  </span>
                                )}
                            </div>
                          </div>
                          <div className="max-h-60 overflow-y-auto">
                            <table className="w-full text-left text-xs">
                              <thead className="bg-gray-100/70 dark:bg-gray-800/60 text-gray-500 dark:text-gray-400">
                                <tr>
                                  <th className="py-2 px-3 font-medium">#</th>
                                  <th className="py-2 px-3 font-medium">Due Date</th>
                                  <th className="py-2 px-3 font-medium text-right">Payment</th>
                                  <th className="py-2 px-3 font-medium text-right">Principal</th>
                                  <th className="py-2 px-3 font-medium text-right">Interest</th>
                                  <th className="py-2 px-3 font-medium text-right">Remaining</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200/60 dark:divide-gray-800/60 font-mono tabular-nums">
                                {schedule.slice(0, 24).map((row) => (
                                  <tr key={row.installmentNumber} className="text-gray-700 dark:text-gray-300">
                                    <td className="py-1.5 px-3 text-gray-400">{row.installmentNumber}</td>
                                    <td className="py-1.5 px-3 font-sans">{row.expectedDate}</td>
                                    <td className="py-1.5 px-3 text-right font-semibold">
                                      {row.expectedAmount.toFixed(2)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-emerald-600 dark:text-emerald-400">
                                      {row.principalComponent.toFixed(2)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-orange-600 dark:text-orange-400">
                                      {row.interestComponent.toFixed(2)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right text-gray-500">
                                      {row.remainingPrincipalAfter.toFixed(2)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {debt.settlements && debt.settlements.length > 0 && (
                      <div className="mt-3 pl-14 sm:pl-14">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 dark:text-gray-400 mb-2">
                          <History className="h-3.5 w-3.5" />
                          Settlement &amp; Forgiveness History
                        </div>
                        <div className="space-y-1.5">
                          {debt.settlements.map((s) => (
                            <div
                              key={s.id}
                              className={`flex flex-wrap items-center justify-between gap-2 text-[11px] sm:text-xs px-3 py-1.5 rounded-md border ${
                                s.isForgiven
                                  ? 'bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-200/60 dark:border-emerald-800/40 text-emerald-800 dark:text-emerald-300'
                                  : 'bg-gray-50 dark:bg-gray-800/40 border-gray-100 dark:border-gray-800/60 text-gray-700 dark:text-gray-300'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 dark:text-gray-400">
                                  {format(new Date(s.createdAt), 'MMM d, yyyy - h:mm a')}
                                </span>
                                {s.isForgiven && (
                                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                                    · Freed / Forgiven ({s.reason || 'Waived'})
                                    {s.note ? ` — "${s.note}"` : ''}
                                  </span>
                                )}
                              </div>
                              <span className="font-semibold font-mono tabular-nums">
                                {parseFloat(s.amount).toFixed(2)} MAD{' '}
                                {s.isForgiven ? '(No Reimbursement)' : '(Wallet Settled)'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="h-12 w-12 rounded-full bg-gray-50 dark:bg-gray-800 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-gray-400 dark:text-gray-500" />
                </div>
                <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">No debts found</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 max-w-[200px]">
                  {activeTab === 'all'
                    ? "You don't have any debts or IOUs recorded."
                    : activeTab === 'receivable'
                    ? 'Nobody owes you anything right now.'
                    : activeTab === 'payable'
                    ? "You don't owe anyone anything right now."
                    : "You haven't settled or freed any debts yet."}
                </p>
                {activeTab !== 'all' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setActiveTab('all')}
                    className="mt-2 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
                  >
                    View all debts
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <SettleDebtModal
        debt={settlingDebt}
        initialMode={settleModalMode}
        wallets={wallets}
        onClose={() => setSettlingDebt(null)}
        onConfirm={async (debtId, amount, category, walletId) => {
          await handleSettle(debtId, amount, category, walletId);
        }}
        onForgive={
          handleForgive
            ? async (debtId, amount, reason, note) => {
                await handleForgive(debtId, amount, reason, note);
              }
            : undefined
        }
      />

      {/* Edit Debt Modal */}
      <MotionModal
        isOpen={!!editingDebt}
        onClose={() => setEditingDebt(null)}
        zIndexClass="z-50"
        containerClassName="w-full max-w-md my-auto"
      >
        {editingDebt && (
          <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-gray-900 dark:text-white">Edit Debt Record</h3>
              <button
                type="button"
                onClick={() => setEditingDebt(null)}
                className="p-1 rounded-md text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={submitEditDebt} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Contact / Counterparty Name
                </label>
                <Input
                  type="text"
                  required
                  value={editContact}
                  onChange={(e) => setEditContact(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Original Amount (MAD)
                </label>
                <Input
                  type="number"
                  step="0.01"
                  required
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Debt Direction
                </label>
                <Select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value as 'Receivable' | 'Payable')}
                >
                  <option value="Receivable">Owed to You (Receivable)</option>
                  <option value="Payable">You Owe (Payable)</option>
                </Select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setEditingDebt(null)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={isUpdatingDebt}>
                  {isUpdatingDebt ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        )}
      </MotionModal>

      {/* Delete Debt Confirmation Modal */}
      <MotionModal
        isOpen={!!deletingDebt}
        onClose={() => setDeletingDebt(null)}
        zIndexClass="z-50"
        containerClassName="w-full max-w-sm my-auto"
      >
        {deletingDebt && (
          <div className="w-full rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-full bg-red-100 dark:bg-red-900/30 text-red-600 shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-gray-900 dark:text-white">
                  Delete Debt with {deletingDebt.contactName}?
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  This will remove the {parseFloat(deletingDebt.remainingBalance).toFixed(2)} MAD{' '}
                  {deletingDebt.type.toLowerCase()} record.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setDeletingDebt(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                className="bg-red-600 hover:bg-red-700 text-white"
                onClick={async () => {
                  const id = deletingDebt.id;
                  setDeletingDebt(null);
                  await handleDeleteDebt(id);
                }}
              >
                Delete Record
              </Button>
            </div>
          </div>
        )}
      </MotionModal>
    </div>
  );
};
