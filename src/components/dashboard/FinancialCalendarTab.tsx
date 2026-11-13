import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Landmark, Trash2, WalletCards, CalendarDays, TrendingUp, Repeat, Zap, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Debt, Payroll, Transaction, Subscription, KPI, Wallet, InvestmentsData, CommitmentOccurrence } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { CashFlowTab } from './CashFlowTab';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';

type EventKind = 'income' | 'expense' | 'transfer' | 'debt' | 'payroll' | 'goal' | 'subscription' | 'dca' | 'investment';
type CalendarEvent = {
  id: string;
  date: string;
  kind: EventKind;
  title: string;
  amount?: number;
  transactionId?: string;
  debtId?: string;
  payroll?: Payroll;
  goalId?: string;
  dcaPlanId?: string;
  subscription?: Subscription;
};

const dateKey = (value: Date | string) => new Date(value).toISOString().slice(0, 10);
const monthLabel = (year: number, month: number) => new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const formatDate = (date: string) => new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });

interface FinancialCalendarTabProps {
  transactions: Transaction[];
  debts: Debt[];
  payrolls: Payroll[];
  kpis?: KPI | null;
  subscriptions?: Subscription[];
  wallets?: Wallet[];
  investmentsData?: InvestmentsData | null;
  openTransaction: (id: string) => void;
  setActiveTab: (tab: any) => void;
  onCreatePayroll: (scheduledFor: string, amount: number) => Promise<void>;
  onDeletePayroll: (id: string) => Promise<void>;
  onPaySubscription?: (id: string, payload?: { walletId?: string; date?: string }) => Promise<any>;
}

export const FinancialCalendarTab: React.FC<FinancialCalendarTabProps> = ({
  transactions,
  debts,
  payrolls,
  kpis = null,
  subscriptions = [],
  wallets = [],
  investmentsData = null,
  openTransaction,
  setActiveTab,
  onCreatePayroll,
  onDeletePayroll,
  onPaySubscription,
}) => {
  const { token } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'cashflow'>('calendar');
  const [payingSubId, setPayingSubId] = useState<string | null>(null);
  const today = dateKey(new Date());
  const now = new Date();
  const [ref, setRef] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
  const [selectedDate, setSelectedDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [confirmedPayrollInput, setConfirmedPayrollInput] = useState('');
  const [occurrences, setOccurrences] = useState<CommitmentOccurrence[]>([]);
  const [showOccurrences, setShowOccurrences] = useState(false);
  const [showAddRecurringIncome, setShowAddRecurringIncome] = useState(false);
  const [recIncomeTitle, setRecIncomeTitle] = useState('');
  const [recIncomeAmount, setRecIncomeAmount] = useState('');
  const [recIncomeCadence, setRecIncomeCadence] = useState<'monthly' | 'weekly' | 'biweekly' | 'quarterly' | 'once'>('monthly');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const loadOccurrences = useCallback(async () => {
    if (!token) return;
    try {
      const list = await dashboardService.getCommitmentOccurrences(token);
      setOccurrences(list);
    } catch {}
  }, [token]);

  useEffect(() => {
    if (showOccurrences) {
      loadOccurrences();
    }
  }, [showOccurrences, loadOccurrences]);

  const events = useMemo<CalendarEvent[]>(() => {
    const transactionEvents = transactions.map((transaction) => {
      const isInv = [
        'Investments & Brokerage',
        'Investments',
        'Investment',
        '📈 Investments',
        'Stocks & Crypto',
        'Investment Returns & Capital Gains',
      ].includes(transaction.category || '');

      const kind: EventKind = isInv
        ? 'investment'
        : transaction.type === 'Income'
        ? 'income'
        : transaction.type === 'Transfer'
        ? 'transfer'
        : 'expense';

      return {
        id: `tx-${transaction.id}`,
        date: dateKey(transaction.createdAt),
        kind,
        title: isInv ? `📈 ${transaction.notes || transaction.category || 'Investment'}` : (transaction.notes || transaction.category || transaction.type),
        amount: Number.parseFloat(transaction.amount),
        transactionId: transaction.id,
      };
    });
    const payrollEvents = payrolls.map((payroll) => ({
      id: `payroll-${payroll.id}`,
      date: dateKey(payroll.scheduledFor),
      kind: 'payroll' as const,
      title: 'Payroll',
      amount: Number.parseFloat(payroll.amount),
      payroll,
    }));
    const debtEvents = debts.filter((debt) => debt.status === 'Pending' && debt.dueDate).map((debt) => ({
      id: `debt-${debt.id}`,
      date: dateKey(debt.dueDate!),
      kind: 'debt' as const,
      title: debt.contactName,
      amount: Number.parseFloat(debt.remainingBalance),
      debtId: debt.id,
    }));

    const dcaEvents: CalendarEvent[] = [];

    // Project a Post-Payday Stock Allocation reminder (Payday + 1 day) when user has stock positions
    if (investmentsData && investmentsData.positions.length > 0) {
      const topTickers = investmentsData.positions.slice(0, 3).map((p) => p.ticker).join(', ');
      payrolls.forEach((payroll) => {
        const pDate = new Date(payroll.scheduledFor);
        if (!isNaN(pDate.getTime())) {
          const allocDate = new Date(pDate.getTime() + 24 * 60 * 60 * 1000);
          dcaEvents.push({
            id: `stock-payday-alloc-${payroll.id}`,
            date: dateKey(allocDate),
            kind: 'dca',
            title: `Payday Stock Splitter (${topTickers})`,
            amount: Math.round((Number.parseFloat(payroll.amount) || 0) * 0.15),
          });
        }
      });
    }

    // Project active recurring subscriptions onto this calendar month
    const subscriptionEvents: CalendarEvent[] = [];
    const daysInViewMonth = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();

    (subscriptions || []).filter((sub) => sub.status === 'active' || sub.status === 'planned').forEach((sub) => {
      const subAmount = parseFloat(sub.amount) || 0;
      let billDay = 1;
      let anchorYear = ref.year;
      let anchorMonth = ref.month;

      if (sub.nextBillingDate) {
        const parsedNext = new Date(sub.nextBillingDate);
        if (!isNaN(parsedNext.getTime())) {
          billDay = parsedNext.getUTCDate();
          anchorYear = parsedNext.getUTCFullYear();
          anchorMonth = parsedNext.getUTCMonth();
        }
      }

      const rawCycle = (sub.billingCycle || 'monthly').trim().toLowerCase();
      let intervalMonths = 1;
      if (rawCycle === 'yearly') intervalMonths = 12;
      else if (rawCycle === 'every_6_months') intervalMonths = 6;
      else if (rawCycle === 'quarterly' || rawCycle === 'every_3_months') intervalMonths = 3;
      else if (rawCycle === 'every_2_months') intervalMonths = 2;
      else {
        const mMatch = rawCycle.match(/^every_(\d+)_months?$/);
        if (mMatch) intervalMonths = Math.max(1, parseInt(mMatch[1], 10));
      }

      const monthDiff = (ref.year - anchorYear) * 12 + (ref.month - anchorMonth);
      if (intervalMonths > 1 && Math.abs(monthDiff) % intervalMonths !== 0) {
        return;
      }

      // Clamp billing day to the number of days in the currently viewed month
      const effectiveDay = Math.min(Math.max(1, billDay), daysInViewMonth);
      const subDate = dateKey(new Date(Date.UTC(ref.year, ref.month, effectiveDay)));

      subscriptionEvents.push({
        id: `sub-${sub.id}-${ref.year}-${ref.month}-${effectiveDay}`,
        date: subDate,
        kind: 'subscription' as const,
        title: `${sub.icon || '📱'} ${sub.name}${sub.status === 'planned' ? ' (Planned)' : ''}`,
        amount: subAmount,
        subscription: sub,
      });
    });

    return [...transactionEvents, ...payrollEvents, ...debtEvents, ...dcaEvents, ...subscriptionEvents];
  }, [debts, payrolls, transactions, subscriptions, investmentsData, ref]);

  const visible = events.filter((event) => {
    const eventDate = new Date(`${event.date}T00:00:00Z`);
    return eventDate.getUTCFullYear() === ref.year && eventDate.getUTCMonth() === ref.month;
  });
  const selected = visible.filter((event) => event.date === selectedDate);
  const selectedPayroll = payrolls.find((payroll) => dateKey(payroll.scheduledFor) === selectedDate);
  const generatedTransaction = selectedPayroll ? transactions.find((transaction) => transaction.payrollId === selectedPayroll.id) : undefined;
  const days = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();
  const offset = (new Date(Date.UTC(ref.year, ref.month, 1)).getUTCDay() + 6) % 7;

  const navigate = (delta: number) => {
    const next = new Date(Date.UTC(ref.year, ref.month + delta, 1));
    setRef({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
  };
  const selectDay = (key: string) => {
    setSelectedDate(key);
    setAmount('');
    setNotice(null);
  };
  const showNotice = (message: string) => {
    setNotice(message);
    window.setTimeout(() => setNotice(null), 3500);
  };
  const savePayroll = async () => {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      showNotice('Enter a payroll amount greater than zero.');
      return;
    }
    setSaving(true);
    try {
      await onCreatePayroll(selectedDate, parsedAmount);
      setAmount('');
      showNotice(`Payroll set for ${formatDate(selectedDate)}.`);
    } catch (error: any) {
      showNotice(error?.message || 'Could not save this payroll.');
    } finally {
      setSaving(false);
    }
  };
  const removePayroll = async () => {
    if (!selectedPayroll || !confirm(`Remove the payroll on ${formatDate(selectedDate)}?`)) return;
    setSaving(true);
    try {
      await onDeletePayroll(selectedPayroll.id);
      showNotice('Payroll removed.');
    } catch (error: any) {
      showNotice(error?.message || 'Could not remove this payroll.');
    } finally {
      setSaving(false);
    }
  };

  const eventStyle: Record<EventKind, string> = {
    income: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
    expense: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
    transfer: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    debt: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    payroll: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',
    goal: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    subscription: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
    dca: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold',
    investment: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-300 font-semibold',
  };

  return (
    <div className="min-w-0 space-y-4">
      {notice && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 px-4 py-3 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {notice}
        </div>
      )}

      {/* Sub-Tab Navigation Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 dark:border-gray-800 pb-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            Financial Calendar & Cash Flow
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
            Payroll periods, event scheduling, and historical cash flow balance timeline
          </p>
        </div>

        {/* View Toggle */}
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700/60 self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab('calendar')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'calendar'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Calendar & Payday</span>
          </button>

          <button
            onClick={() => setActiveSubTab('cashflow')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeSubTab === 'cashflow'
                ? 'bg-white dark:bg-gray-900 text-indigo-600 dark:text-indigo-400 shadow-sm'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Cash Flow Timeline</span>
          </button>
        </div>
      </div>

      {activeSubTab === 'cashflow' ? (
        <CashFlowTab kpis={kpis || null} transactions={transactions} />
      ) : (
        <>
          {/* Recurring subscriptions monthly status banner */}
          {(() => {
            const monthSubEvents = visible.filter((e) => e.kind === 'subscription');
            const monthSubTotal = monthSubEvents.reduce((s, e) => s + (e.amount || 0), 0);
            if (monthSubEvents.length === 0) return null;
            return (
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-purple-50/80 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 px-4 py-2.5 text-xs text-purple-900 dark:text-purple-200 shadow-xs">
                <div className="flex items-center gap-2">
                  <Repeat className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <span>
                    <strong>{monthSubEvents.length} Recurring Subscriptions</strong> scheduled for {monthLabel(ref.year, ref.month)} ({monthSubTotal.toFixed(2)} MAD committed drain)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('subscriptions')}
                  className="font-semibold text-purple-700 dark:text-purple-300 hover:underline flex items-center gap-1"
                >
                  <span>Manage Subscriptions Tab</span>
                  <ExternalLink className="h-3 w-3" />
                </button>
              </div>
            );
          })()}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-gray-100">Payday & Cycle Schedule</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Select one day each month to set its payroll. Consecutive payrolls define your financial periods.</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => navigate(-1)}><ChevronLeft className="h-4 w-4" /></Button>
              <Button variant="outline" onClick={() => setRef({ year: now.getUTCFullYear(), month: now.getUTCMonth() })}>{monthLabel(ref.year, ref.month)}</Button>
              <Button variant="outline" size="icon" onClick={() => navigate(1)}><ChevronRight className="h-4 w-4" /></Button>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="min-w-0 overflow-hidden lg:col-span-2">
              <CardContent className="p-2 sm:p-4">
                <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border bg-gray-200 dark:border-gray-800 dark:bg-gray-800">
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
                    <div key={day} className="bg-gray-50 py-2 text-center text-[10px] font-semibold text-gray-500 dark:bg-gray-900 dark:text-gray-400 sm:text-xs">{day}</div>
                  ))}
                  {Array.from({ length: offset }, (_, index) => (
                    <div key={`blank-${index}`} className="min-h-20 bg-white dark:bg-gray-950" />
                  ))}
                  {Array.from({ length: days }, (_, index) => {
                    const day = index + 1;
                    const key = dateKey(new Date(Date.UTC(ref.year, ref.month, day)));
                    const dayEvents = visible.filter((event) => event.date === key);
                    return (
                      <button
                        key={key}
                        onClick={() => selectDay(key)}
                        className={`min-h-20 min-w-0 bg-white p-1 text-left align-top dark:bg-gray-950 sm:min-h-28 sm:p-2 ${selectedDate === key ? 'ring-2 ring-inset ring-indigo-600 dark:ring-indigo-400' : ''}`}
                      >
                        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${key === today ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900' : 'text-gray-600 dark:text-gray-400'}`}>{day}</span>
                        <div className="mt-1 space-y-1">
                          {dayEvents.slice(0, 3).map((event) => (
                            <div key={event.id} className={`truncate rounded px-1 py-0.5 text-[9px] font-medium sm:text-[10px] ${eventStyle[event.kind]}`}>
                              {event.kind === 'income' ? '+' : event.kind === 'expense' ? '−' : event.kind === 'payroll' ? '◆ ' : event.kind === 'goal' ? '★ ' : event.kind === 'dca' || event.kind === 'investment' ? '📈 ' : ''}
                              {event.amount ? `${event.amount} ` : ''}
                              {event.title}
                            </div>
                          ))}
                          {dayEvents.length > 3 && <p className="text-[10px] text-gray-500 dark:text-gray-400">+{dayEvents.length - 3} more</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>Payroll Verification &amp; Setup</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedDate)}</p>
                {selectedPayroll ? (
                  <>
                    <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/50 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">
                          {selectedPayroll.status === 'confirmed' || selectedPayroll.status === 'matched' || generatedTransaction
                            ? 'Confirmed Salary Inflow'
                            : 'Expected Scheduled Payroll'}
                        </p>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            selectedPayroll.status === 'confirmed' || selectedPayroll.status === 'matched' || generatedTransaction
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/60 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-700 dark:bg-amber-900/60 dark:text-amber-300'
                          }`}
                        >
                          {selectedPayroll.status || (generatedTransaction ? 'confirmed' : 'expected')}
                        </span>
                      </div>
                      <p className="text-lg font-bold text-violet-800 dark:text-violet-100">
                        +{Number(selectedPayroll.confirmedAmount || selectedPayroll.amount).toFixed(2)} MAD
                      </p>
                      {selectedPayroll.varianceAmount && Math.abs(Number(selectedPayroll.varianceAmount)) > 0.01 && (
                        <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                          Variance vs Expected ({Number(selectedPayroll.amount).toFixed(0)} MAD):{' '}
                          {Number(selectedPayroll.varianceAmount) > 0 ? '+' : ''}
                          {Number(selectedPayroll.varianceAmount).toFixed(2)} MAD
                        </p>
                      )}
                      <p className="text-xs text-violet-700 dark:text-violet-300">
                        {generatedTransaction || selectedPayroll.status === 'confirmed'
                          ? 'Confirmed and posted to your primary wallet & double-entry ledger.'
                          : 'Expected salary does not fabricate received cash until you confirm receipt.'}
                      </p>
                    </div>
                    {generatedTransaction ? (
                      <Button className="w-full" variant="outline" onClick={() => openTransaction(generatedTransaction.id)}>
                        <Landmark className="mr-2 h-4 w-4" />Open payroll transaction
                      </Button>
                    ) : (
                      <div className="space-y-2 pt-1">
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                          Confirm Actual Received Salary (MAD)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={confirmedPayrollInput}
                          onChange={(e) => setConfirmedPayrollInput(e.target.value)}
                          placeholder={String(selectedPayroll.amount)}
                          className="w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                        />
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          disabled={saving}
                          onClick={async () => {
                            setSaving(true);
                            try {
                              const actual = confirmedPayrollInput
                                ? parseFloat(confirmedPayrollInput)
                                : parseFloat(selectedPayroll.amount);
                              const res = await dashboardService.confirmPayroll(
                                selectedPayroll.id,
                                { confirmedAmount: actual, confirmedAt: selectedDate },
                                token
                              );
                              setConfirmedPayrollInput('');
                              showNotice(
                                `Payroll confirmed (+${actual.toFixed(2)} MAD, ${res.varianceType}) and posted to Bank!`
                              );
                            } catch (err: any) {
                              showNotice(err?.message || 'Failed to confirm payroll');
                            } finally {
                              setSaving(false);
                            }
                          }}
                        >
                          <CheckCircle2 className="mr-2 h-4 w-4" />
                          Confirm Salary Receipt
                        </Button>
                        <Button className="w-full text-red-600" variant="outline" disabled={saving} onClick={removePayroll}>
                          <Trash2 className="mr-2 h-4 w-4" />Remove payroll
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-gray-500 dark:text-gray-400">Set this day as the one payroll for {monthLabel(ref.year, ref.month)}. You must also set the next month to form a complete financial period.</p>
                    <label className="block text-xs font-medium text-gray-700 dark:text-gray-300" htmlFor="payroll-amount">Payroll amount (MAD)</label>
                    <input
                      id="payroll-amount"
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(event) => setAmount(event.target.value)}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                      placeholder="e.g. 8000"
                    />
                    <Button className="w-full" disabled={saving} onClick={savePayroll}>
                      <WalletCards className="mr-2 h-4 w-4" />{saving ? 'Saving…' : 'Set payroll day'}
                    </Button>
                  </>
                )}

                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowOccurrences((prev) => !prev)}
                    className="w-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center justify-between"
                  >
                    <span>Unified Commitment Occurrences Ledger</span>
                    <span>{showOccurrences ? 'Hide' : 'Open'}</span>
                  </button>
                  {showOccurrences && (
                    <div className="mt-2 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-gray-500">Rolling horizon obligations &amp; income</span>
                        <button
                          type="button"
                          onClick={() => setShowAddRecurringIncome((v) => !v)}
                          className="text-[11px] font-semibold text-emerald-600 hover:underline"
                        >
                          {showAddRecurringIncome ? 'Close' : '+ Recurring Income'}
                        </button>
                      </div>

                      {showAddRecurringIncome && (
                        <div className="p-2 rounded border border-emerald-200 dark:border-emerald-900/50 bg-emerald-50/40 dark:bg-emerald-950/20 space-y-1.5">
                          <input
                            type="text"
                            placeholder="Title (e.g. Rental Income / Freelance)"
                            value={recIncomeTitle}
                            onChange={(e) => setRecIncomeTitle(e.target.value)}
                            className="w-full px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                          />
                          <div className="flex gap-1.5">
                            <input
                              type="number"
                              placeholder="Amount (MAD)"
                              value={recIncomeAmount}
                              onChange={(e) => setRecIncomeAmount(e.target.value)}
                              className="flex-1 px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            />
                            <select
                              value={recIncomeCadence}
                              onChange={(e) => setRecIncomeCadence(e.target.value as any)}
                              className="px-2 py-1 text-xs rounded border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800"
                            >
                              <option value="monthly">Monthly</option>
                              <option value="weekly">Weekly</option>
                              <option value="biweekly">Biweekly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="once">One-time</option>
                            </select>
                            <button
                              type="button"
                              onClick={async () => {
                                const amt = parseFloat(recIncomeAmount);
                                if (!recIncomeTitle.trim() || !Number.isFinite(amt) || amt <= 0) return;
                                await dashboardService.createRecurringIncomeCommitment(
                                  {
                                    title: recIncomeTitle.trim(),
                                    expectedAmount: amt,
                                    expectedDate: selectedDate,
                                    cadence: recIncomeCadence,
                                  },
                                  token
                                );
                                setRecIncomeTitle('');
                                setRecIncomeAmount('');
                                setShowAddRecurringIncome(false);
                                await loadOccurrences();
                                showNotice('Recurring income commitment scheduled!');
                              }}
                              className="px-2.5 py-1 rounded bg-emerald-600 text-white text-xs font-semibold"
                            >
                              Add
                            </button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-1.5 max-h-56 overflow-y-auto">
                        {occurrences.slice(0, 12).map((occ) => (
                          <div
                            key={occ.id}
                            className="rounded border border-gray-100 dark:border-gray-800 p-2 space-y-1"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="truncate">
                                <p className="font-semibold text-gray-900 dark:text-white truncate">{occ.title}</p>
                                <p className="text-[10px] text-gray-500">
                                  {occ.expectedDate} · {occ.sourceType} · {occ.status}
                                  {occ.installmentNumber ? ` · #${occ.installmentNumber}` : ''}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                  {Number(occ.expectedAmount || 0).toFixed(0)} {occ.currency || 'MAD'}
                                </span>
                                {Number(occ.paidAmount || 0) > 0 && (
                                  <p className="text-[10px] text-emerald-600 font-mono">
                                    Paid: {Number(occ.paidAmount).toFixed(0)}
                                  </p>
                                )}
                              </div>
                            </div>

                            {(Number(occ.principalComponent || 0) > 0 || Number(occ.interestComponent || 0) > 0) && (
                              <p className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono">
                                Principal {Number(occ.principalComponent || 0).toFixed(2)} · Interest {Number(occ.interestComponent || 0).toFixed(2)}
                              </p>
                            )}

                            {(occ.status === 'scheduled' || occ.status === 'partial') && (
                              <div className="flex flex-wrap gap-1 pt-0.5">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await dashboardService.settleCommitmentOccurrence(
                                      occ.id,
                                      { action: 'pay', walletId: wallets[0]?.id },
                                      token
                                    );
                                    await loadOccurrences();
                                    showNotice(`Settled ${occ.title} and posted transaction.`);
                                  }}
                                  className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-semibold"
                                >
                                  Settle
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const rem = Math.max(0, Number(occ.expectedAmount || 0) - Number(occ.paidAmount || 0));
                                    const half = Number((rem / 2).toFixed(2));
                                    if (half <= 0) return;
                                    await dashboardService.settleCommitmentOccurrence(
                                      occ.id,
                                      { action: 'partial', actualAmount: half, walletId: wallets[0]?.id },
                                      token
                                    );
                                    await loadOccurrences();
                                    showNotice(`Recorded partial payment (${half} MAD) for ${occ.title}.`);
                                  }}
                                  className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                                >
                                  50% Partial
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    const d = new Date(`${occ.expectedDate}T12:00:00Z`);
                                    d.setUTCDate(d.getUTCDate() + 7);
                                    await dashboardService.settleCommitmentOccurrence(
                                      occ.id,
                                      { action: 'reschedule', newDate: d.toISOString().slice(0, 10), reason: 'Rescheduled +7d' },
                                      token
                                    );
                                    await loadOccurrences();
                                    showNotice(`Rescheduled ${occ.title} by +7 days.`);
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-600 text-white text-[10px] font-semibold"
                                >
                                  +7d
                                </button>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await dashboardService.settleCommitmentOccurrence(
                                      occ.id,
                                      { action: 'skip', reason: 'Skipped from calendar' },
                                      token
                                    );
                                    await loadOccurrences();
                                    showNotice(`Skipped ${occ.title}.`);
                                  }}
                                  className="px-2 py-0.5 rounded bg-gray-500 text-white text-[10px] font-semibold"
                                >
                                  Skip
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader><CardTitle>{formatDate(selectedDate)}</CardTitle></CardHeader>
            <CardContent>
              {selected.length ? (
                <div className="space-y-2">
                  {selected.filter((event) => event.kind !== 'payroll').map((event) => {
                    if (event.kind === 'subscription' && event.subscription) {
                      const sub = event.subscription;
                      const linkedWallet = wallets.find((w) => w.id === sub.walletId) || wallets.find((w) => w.isMain) || wallets[0];
                      const isShort = linkedWallet && linkedWallet.balance < (event.amount || 0);

                      return (
                        <div
                          key={event.id}
                          className="rounded-xl border border-purple-200 dark:border-purple-900/60 bg-gradient-to-r from-purple-50/60 via-white to-white dark:from-purple-950/20 dark:via-gray-900 dark:to-gray-900 p-3.5 shadow-xs transition-all hover:border-purple-300 dark:hover:border-purple-800"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-purple-100 dark:bg-purple-900/60 text-xl shadow-xs">
                                {sub.icon || '📱'}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h4 className="font-bold text-sm text-gray-900 dark:text-gray-100 truncate">
                                    {sub.name}
                                  </h4>
                                  <span className="rounded-full bg-purple-100 dark:bg-purple-900/60 px-2 py-0.5 text-[10px] font-bold text-purple-700 dark:text-purple-300">
                                    Recurring {sub.billingCycle}
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                  <div className="flex items-center gap-1.5">
                                    <WalletCards className="h-3.5 w-3.5 text-gray-400" />
                                    <span>
                                      Charged to: <strong>{linkedWallet?.name || 'Default Bank'}</strong>
                                    </span>
                                    {linkedWallet && (
                                      <span className={`text-[11px] font-semibold ${isShort ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                        ({linkedWallet.balance.toFixed(2)} MAD bal {isShort ? '— ⚠️ Low Funds' : ''})
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                              <span className="font-bold text-base text-gray-900 dark:text-gray-100">
                                −{event.amount?.toFixed(2)} MAD
                              </span>
                              {onPaySubscription && (
                                <Button
                                  size="sm"
                                  disabled={payingSubId === sub.id}
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    setPayingSubId(sub.id);
                                    try {
                                      await onPaySubscription(sub.id, {
                                        walletId: sub.walletId || linkedWallet?.id,
                                        date: selectedDate,
                                      });
                                      showNotice(`Paid ${sub.name} (${event.amount?.toFixed(2)} MAD) via ${linkedWallet?.name || 'wallet'}!`);
                                    } catch (err: any) {
                                      showNotice(err.message || 'Payment failed');
                                    } finally {
                                      setPayingSubId(null);
                                    }
                                  }}
                                  className="bg-purple-600 hover:bg-purple-700 text-white text-xs h-8 shadow-xs flex items-center gap-1"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  <span>{payingSubId === sub.id ? 'Paying…' : 'Pay Now'}</span>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setActiveTab('subscriptions')}
                                className="text-xs h-8 text-gray-600 dark:text-gray-300"
                              >
                                Manage
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <button
                        key={event.id}
                        onClick={() =>
                          event.transactionId
                            ? openTransaction(event.transactionId)
                            : event.debtId
                            ? setActiveTab('debts')
                            : event.kind === 'dca' || event.kind === 'investment'
                            ? setActiveTab('investments')
                            : undefined
                        }
                        className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {event.kind === 'dca' ? 'Recommended 15% Payday Stock Allocation • Click to open Stocks' : event.kind}
                          </p>
                        </div>
                        <span className="shrink-0 font-semibold text-gray-900 dark:text-gray-100">
                          {event.amount ? `${event.kind === 'income' ? '+' : event.kind === 'expense' || event.kind === 'subscription' ? '−' : ''}${event.amount.toFixed(2)} MAD` : ''}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-2 text-sm text-gray-500 dark:text-gray-400">No other financial activity.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
};
