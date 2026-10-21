import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Landmark, Trash2, WalletCards, CalendarDays, TrendingUp, Repeat, Zap, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react';
import { Debt, Payroll, Transaction, Goal, Subscription, KPI, Wallet } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { CashFlowTab } from './CashFlowTab';

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
  openTransaction,
  setActiveTab,
  onCreatePayroll,
  onDeletePayroll,
  onPaySubscription,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'cashflow'>('calendar');
  const [payingSubId, setPayingSubId] = useState<string | null>(null);
  const today = dateKey(new Date());
  const now = new Date();
  const [ref, setRef] = useState({ year: now.getUTCFullYear(), month: now.getUTCMonth() });
  const [selectedDate, setSelectedDate] = useState(today);
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

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

    // Project active recurring subscriptions onto this calendar month
    const subscriptionEvents: CalendarEvent[] = [];
    const daysInViewMonth = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();

    (subscriptions || []).filter((sub) => sub.status === 'active').forEach((sub) => {
      const subAmount = parseFloat(sub.amount) || 0;
      let billDay = 1;

      if (sub.nextBillingDate) {
        const parsedNext = new Date(sub.nextBillingDate);
        if (!isNaN(parsedNext.getTime())) {
          billDay = parsedNext.getUTCDate();
        }
      }

      // Clamp billing day to the number of days in the currently viewed month
      const effectiveDay = Math.min(Math.max(1, billDay), daysInViewMonth);
      const subDate = dateKey(new Date(Date.UTC(ref.year, ref.month, effectiveDay)));

      subscriptionEvents.push({
        id: `sub-${sub.id}-${ref.year}-${ref.month}-${effectiveDay}`,
        date: subDate,
        kind: 'subscription' as const,
        title: `${sub.icon || '📱'} ${sub.name}`,
        amount: subAmount,
        subscription: sub,
      });
    });

    return [...transactionEvents, ...payrollEvents, ...debtEvents, ...dcaEvents, ...subscriptionEvents];
  }, [debts, payrolls, transactions, subscriptions, ref]);

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
              <CardHeader><CardTitle>Payroll setup</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="font-medium text-gray-900 dark:text-gray-100">{formatDate(selectedDate)}</p>
                {selectedPayroll ? (
                  <>
                    <div className="rounded-lg bg-violet-50 p-3 dark:bg-violet-950/50">
                      <p className="text-xs font-medium uppercase tracking-wide text-violet-600 dark:text-violet-300">Configured payroll</p>
                      <p className="mt-1 text-lg font-bold text-violet-800 dark:text-violet-100">+{Number(selectedPayroll.amount).toFixed(2)} MAD</p>
                      <p className="mt-1 text-xs text-violet-700 dark:text-violet-300">{generatedTransaction ? 'Automatically posted to Bank.' : selectedDate <= today ? 'Will post on your next data refresh.' : 'Will post automatically on this date.'}</p>
                    </div>
                    {generatedTransaction ? (
                      <Button className="w-full" variant="outline" onClick={() => openTransaction(generatedTransaction.id)}>
                        <Landmark className="mr-2 h-4 w-4" />Open payroll transaction
                      </Button>
                    ) : (
                      <Button className="w-full text-red-600" variant="outline" disabled={saving} onClick={removePayroll}>
                        <Trash2 className="mr-2 h-4 w-4" />Remove payroll
                      </Button>
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
                        onClick={() => event.transactionId ? openTransaction(event.transactionId) : event.debtId ? setActiveTab('debts') : undefined}
                        className="flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left hover:bg-gray-50 dark:border-gray-800 dark:hover:bg-gray-800/50"
                      >
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900 dark:text-gray-100">{event.title}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{event.kind}</p>
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
