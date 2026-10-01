import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Calendar, CheckCircle2, ChevronDown, ChevronUp, Edit3, Plus, RefreshCcw, ShieldAlert, Sparkles, XCircle } from 'lucide-react';
import type { FinancialHomeResponse, FinancialPlan, InvestmentAccount, Payroll, PlanAllocation, Wallet } from '../../types';
import { getCurrentFinancialMonth } from '../../lib/financialMonth';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface SalaryPlanTabProps {
  home: FinancialHomeResponse | null;
  plans: FinancialPlan[];
  wallets: Wallet[];
  accounts: InvestmentAccount[];
  payrolls?: Payroll[];
  userSalary?: number;
  saving: boolean;
  onCreate: (input: { incomeAmount: number; payrollId?: string; sourceTransactionId?: string; periodStart?: string; periodEnd?: string }) => Promise<FinancialPlan | undefined>;
  onUpdate: (id: string, allocations: Array<{ id: string; amount?: string; investmentAccountId?: string | null; destinationWalletId?: string | null }>) => Promise<FinancialPlan | undefined>;
  onApprove: (id: string, payload: { allocationIds: string[]; sourceWalletId?: string; confirmWarnings?: string[] }) => Promise<FinancialPlan | undefined>;
  onReplan: (id: string) => Promise<FinancialPlan | undefined>;
  onCancel: (id: string) => Promise<FinancialPlan | undefined>;
}

const number = (value: string | number | undefined | null) => Number(value) || 0;
const label: Record<PlanAllocation['type'], string> = {
  Commitment: 'Required commitments',
  Debt: 'Debt obligations',
  EmergencyBuffer: 'Emergency buffer',
  Goal: 'Time-bound goals',
  Budget: 'Flexible budgets',
  Investment: 'Investment contribution',
  UnallocatedMargin: 'Unallocated safety margin',
};

export const SalaryPlanTab: React.FC<SalaryPlanTabProps> = ({
  home,
  plans,
  wallets,
  accounts,
  payrolls = [],
  userSalary,
  saving,
  onCreate,
  onUpdate,
  onApprove,
  onReplan,
  onCancel,
}) => {
  // Find current or upcoming configured payroll from calendar
  const currentPayroll = useMemo(() => {
    if (!payrolls || !payrolls.length) return null;
    const sorted = [...payrolls].sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    const now = new Date();

    // 1. Look for payroll active in current financial period
    const currentFm = getCurrentFinancialMonth(payrolls, now);
    if (currentFm && currentFm.startPayroll) {
      const match = payrolls.find((p) => p.id === currentFm.startPayroll.id);
      if (match && number(match.amount) > 0) return match;
    }

    // 2. Look for upcoming payroll in this calendar month or next
    const upcoming = sorted.find((p) => new Date(p.scheduledFor) >= new Date(now.getFullYear(), now.getMonth(), 1));
    return upcoming || sorted[sorted.length - 1];
  }, [payrolls]);

  const defaultSuggestedAmount = useMemo(() => {
    if (currentPayroll && number(currentPayroll.amount) > 0) return String(currentPayroll.amount);
    if (userSalary && Number(userSalary) > 0) return String(userSalary);
    if (home?.snapshot?.plan?.unallocatedIncome) return String(home.snapshot.plan.unallocatedIncome);
    return '';
  }, [currentPayroll, userSalary, home]);

  const [income, setIncome] = useState(defaultSuggestedAmount);
  const [showCustomAmount, setShowCustomAmount] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceWalletId, setSourceWalletId] = useState('');
  const [workingPlan, setWorkingPlan] = useState<FinancialPlan | null>(home?.activePlan || plans[0] || null);
  const [edits, setEdits] = useState<Record<string, Partial<Pick<PlanAllocation, 'amount' | 'investmentAccountId' | 'destinationWalletId'>>>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [confirmBufferWarning, setConfirmBufferWarning] = useState(false);

  useEffect(() => {
    if (!income && defaultSuggestedAmount) setIncome(defaultSuggestedAmount);
  }, [defaultSuggestedAmount, income]);

  useEffect(() => {
    const latest = home?.activePlan || plans[0] || null;
    setWorkingPlan(latest);
    setSelectedIds([]);
    setEdits({});
  }, [home?.activePlan?.id, plans.length]);

  const plan = workingPlan;
  const allocations = useMemo(
    () =>
      plan
        ? (plan.allocations || []).map((allocation) => ({
            ...allocation,
            ...edits[allocation.id],
            amount: edits[allocation.id]?.amount ?? allocation.amount,
          }))
        : [],
    [plan, edits]
  );
  const total = allocations.reduce((sum, allocation) => sum + number(allocation.amount), 0);
  const currency = home?.profile?.baseCurrency || 'MAD';
  const sourceWallets = wallets.filter((wallet) => wallet.type === 'Bank' || wallet.type === 'Cash' || wallet.type === 'Savings');

  const updateEdit = (id: string, patch: Partial<Pick<PlanAllocation, 'amount' | 'investmentAccountId' | 'destinationWalletId'>>) =>
    setEdits((current) => ({ ...current, [id]: { ...current[id], ...patch } }));

  const handleCreateFromPayroll = async (payroll: Payroll) => {
    try {
      const created = await onCreate({
        incomeAmount: number(payroll.amount),
        payrollId: payroll.id,
      });
      if (created) {
        setWorkingPlan(created);
        setMessage(`Plan draft generated using your configured salary of ${number(payroll.amount).toLocaleString()} ${currency} from the calendar.`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate plan.');
    }
  };

  const makeDraft = async (event: React.FormEvent) => {
    event.preventDefault();
    const targetAmount = number(income) || number(defaultSuggestedAmount);
    if (!targetAmount || targetAmount <= 0) {
      setMessage('Please enter a valid salary or configure your payroll in the Calendar.');
      return;
    }
    try {
      const created = await onCreate({
        incomeAmount: targetAmount,
        payrollId: currentPayroll?.id,
      });
      if (created) {
        setWorkingPlan(created);
        setMessage('Draft plan generated. Review every allocation before approving.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to generate plan.');
    }
  };

  const saveEdits = async () => {
    if (!plan || !Object.keys(edits).length) return;
    try {
      const updated = await onUpdate(
        plan.id,
        Object.entries(edits).map(([id, edit]) => ({
          id,
          ...edit,
          amount: edit.amount !== undefined ? String(edit.amount) : undefined,
        }))
      );
      if (updated) {
        setWorkingPlan(updated);
        setEdits({});
        setMessage('Draft changes saved as an auditable revision.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save plan edits.');
    }
  };

  const approve = async () => {
    if (!plan) return;
    try {
      const updated = await onApprove(plan.id, {
        allocationIds: selectedIds,
        sourceWalletId: sourceWalletId || undefined,
        confirmWarnings: confirmBufferWarning ? ['investment-before-target-buffer'] : [],
      });
      if (updated) {
        setWorkingPlan(updated);
        setMessage('Selected allocations were approved. Cash movements were only created for transfers, goals, and investment funding.');
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to approve plan.');
    }
  };

  const toggle = (id: string) =>
    setSelectedIds((ids) => (ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id]));

  const selectAll = () =>
    setSelectedIds(selectedIds.length === allocations.length ? [] : allocations.map((allocation) => allocation.id));

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-12">
      <div>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Plan · Salary Plan</p>
        <h2 className="text-2xl font-bold tracking-tight">Plan your income before it disappears into spending.</h2>
        <p className="mt-1 text-sm text-gray-500">
          All suggestions are deterministic, editable, and require your approval before any financial change.
        </p>
      </div>

      {message && (
        <div role="status" className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/30 dark:text-indigo-100 flex justify-between items-center">
          <span>{message}</span>
          <button onClick={() => setMessage(null)} className="text-xs font-semibold underline">Dismiss</button>
        </div>
      )}

      {!plan && (
        <Card className="border-indigo-200 dark:border-indigo-900">
          <CardHeader>
            <CardTitle>Create a salary plan</CardTitle>
            <CardDescription>
              Assign your monthly income to commitments, goals, debt, and investments before spending begins.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Auto-detected Calendar Salary Integration */}
            {currentPayroll ? (
              <div className="rounded-xl bg-gradient-to-r from-indigo-50 to-indigo-100/70 p-5 dark:from-indigo-950/50 dark:to-indigo-900/30 border border-indigo-200 dark:border-indigo-800 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl bg-indigo-600 text-white shrink-0 shadow-sm">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 bg-indigo-100 dark:bg-indigo-900/60 px-2 py-0.5 rounded-full">
                          Configured in Calendar
                        </span>
                        <span className="text-xs text-gray-500">
                          Scheduled: {new Date(currentPayroll.scheduledFor).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                        {number(currentPayroll.amount).toLocaleString()} {currency}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
                        Your salary is already set for each month in your Financial Calendar.
                      </p>
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="lg"
                    disabled={saving}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shrink-0"
                    onClick={() => handleCreateFromPayroll(currentPayroll)}
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Plan with Calendar Salary
                  </Button>
                </div>
              </div>
            ) : userSalary && Number(userSalary) > 0 ? (
              <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60 border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">Configured Monthly Salary: {number(userSalary).toLocaleString()} {currency}</p>
                  <p className="text-xs text-gray-500">From your user settings</p>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  onClick={() => {
                    setIncome(String(userSalary));
                    onCreate({ incomeAmount: number(userSalary) })
                      .then((created) => {
                        if (created) {
                          setWorkingPlan(created);
                          setMessage('Draft generated from your configured monthly salary.');
                        }
                      })
                      .catch((e) => setMessage(e instanceof Error ? e.message : 'Unable to generate plan.'));
                  }}
                >
                  Use {number(userSalary).toLocaleString()} {currency}
                </Button>
              </div>
            ) : null}

            {/* Custom amount toggle */}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowCustomAmount((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                <span>{showCustomAmount ? 'Hide custom amount' : 'Or plan with a different income amount'}</span>
                {showCustomAmount ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>

              {showCustomAmount && (
                <form onSubmit={makeDraft} className="mt-3 flex max-w-md flex-col gap-3 sm:flex-row">
                  <label className="flex-1 text-sm font-medium">
                    Income amount ({currency})
                    <input
                      min="0.01"
                      step="0.01"
                      type="number"
                      value={income}
                      onChange={(event) => setIncome(event.target.value)}
                      placeholder={defaultSuggestedAmount || '20000'}
                      className="mt-1 w-full rounded-md border bg-transparent p-2 text-sm"
                    />
                  </label>
                  <Button className="sm:mt-6" type="submit" disabled={saving}>
                    <Plus className="mr-1 h-4 w-4" />
                    Generate draft
                  </Button>
                </form>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {plan && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Income plan: {number(plan.incomeAmount).toLocaleString()} {plan.baseCurrency}</CardTitle>
                <CardDescription>
                  {plan.status} · {plan.periodStart ? new Date(plan.periodStart).toLocaleDateString() : 'Flexible period'} →{' '}
                  {plan.periodEnd ? new Date(plan.periodEnd).toLocaleDateString() : 'Not set'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => onReplan(plan.id).then((revised) => revised && setWorkingPlan(revised))} disabled={saving}>
                    <RefreshCcw className="mr-1 h-4 w-4" />
                    Re-evaluate
                  </Button>
                  {plan.status !== 'Cancelled' && (
                    <Button variant="ghost" onClick={() => onCancel(plan.id).then((cancelled) => cancelled && setWorkingPlan(cancelled))} disabled={saving}>
                      Cancel plan
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Allocation total</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${Math.abs(total - number(plan.incomeAmount)) <= 0.01 ? 'text-emerald-600' : 'text-red-600'}`}>
                  {total.toFixed(2)} / {number(plan.incomeAmount).toFixed(2)}
                </p>
                <p className="mt-1 text-xs text-gray-500">A draft must total exactly to its income.</p>
              </CardContent>
            </Card>
          </div>

          {((plan.snapshotJson as unknown as { warnings?: string[] })?.warnings || []).map((warning) => (
            <div key={warning} className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {warning}
            </div>
          ))}

          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Allocation review</CardTitle>
                  <CardDescription>Edit an amount, then save the draft. Approve any subset when you are ready.</CardDescription>
                </div>
                <Button variant="outline" onClick={saveEdits} disabled={saving || !Object.keys(edits).length}>
                  <Edit3 className="mr-1 h-4 w-4" />
                  Save edits
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {allocations
                .sort((a, b) => a.priority - b.priority)
                .map((allocation) => (
                  <div key={allocation.id} className="rounded-xl border p-4">
                    <div className="grid gap-3 md:grid-cols-[auto_1fr_150px] md:items-center">
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(allocation.id)}
                          onChange={() => toggle(allocation.id)}
                          aria-label={`Select ${allocation.name}`}
                        />
                        <span className="sr-only">Select</span>
                      </label>
                      <div>
                        <p className="font-semibold">{allocation.name || label[allocation.type]}</p>
                        <p className="mt-1 text-xs text-gray-500">{allocation.rationale}</p>
                        <details className="mt-2 text-xs text-indigo-600">
                          <summary className="cursor-pointer">Why this amount?</summary>
                          <pre className="mt-2 overflow-x-auto rounded bg-gray-50 p-2 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                            {JSON.stringify(allocation.evidenceJson, null, 2)}
                          </pre>
                        </details>
                      </div>
                      <label className="text-sm font-medium">
                        {currency}
                        <input
                          disabled={plan.status !== 'Draft'}
                          min="0"
                          step="0.01"
                          type="number"
                          value={allocation.amount}
                          onChange={(event) => updateEdit(allocation.id, { amount: event.target.value })}
                          className="mt-1 w-full rounded-md border bg-transparent p-2 text-right"
                        />
                      </label>
                    </div>

                    {allocation.type === 'EmergencyBuffer' && (
                      <label className="mt-3 block text-xs font-medium">
                        Destination savings wallet
                        <select
                          disabled={plan.status !== 'Draft'}
                          value={allocation.destinationWalletId || ''}
                          onChange={(event) => updateEdit(allocation.id, { destinationWalletId: event.target.value || null })}
                          className="mt-1 w-full rounded-md border bg-transparent p-2"
                        >
                          <option value="">Choose a wallet before approval</option>
                          {wallets.filter((wallet) => wallet.type === 'Savings').map((wallet) => (
                            <option key={wallet.id} value={wallet.id}>{wallet.name}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    {allocation.type === 'Investment' && (
                      <label className="mt-3 block text-xs font-medium">
                        Investment account
                        <select
                          disabled={plan.status !== 'Draft'}
                          value={allocation.investmentAccountId || ''}
                          onChange={(event) => updateEdit(allocation.id, { investmentAccountId: event.target.value || null })}
                          className="mt-1 w-full rounded-md border bg-transparent p-2"
                        >
                          <option value="">Choose an account before approval</option>
                          {accounts.filter((account) => !account.isArchived).map((account) => (
                            <option key={account.id} value={account.id}>{account.name}</option>
                          ))}
                        </select>
                      </label>
                    )}

                    <p className="mt-2 text-xs font-medium text-gray-500">Status: {allocation.status}</p>
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card className="border-indigo-200 dark:border-indigo-900">
            <CardHeader>
              <CardTitle>Approve selected allocations</CardTitle>
              <CardDescription>
                Budget allocations only save a budget plan. They never create an expense. Goal transfers, emergency transfers, and investment funding create ledger operations atomically.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" onClick={selectAll}>
                  {selectedIds.length === allocations.length ? 'Clear selection' : 'Select all'} ({selectedIds.length})
                </Button>
                <label className="min-w-60 flex-1 text-sm font-medium">
                  Cash source wallet
                  <select
                    value={sourceWalletId}
                    onChange={(event) => setSourceWalletId(event.target.value)}
                    className="mt-1 w-full rounded-md border bg-transparent p-2"
                  >
                    <option value="">Select when approving cash movements</option>
                    {sourceWallets.map((wallet) => (
                      <option key={wallet.id} value={wallet.id}>
                        {wallet.name} · {wallet.balance.toFixed(2)} {currency}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {allocations.some(
                (allocation) =>
                  selectedIds.includes(allocation.id) &&
                  allocation.type === 'Investment' &&
                  number(allocation.amount) > 0 &&
                  home?.snapshot?.buffer &&
                  home.snapshot.buffer.current < home.snapshot.buffer.target
              ) && (
                <label className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                  <input
                    type="checkbox"
                    checked={confirmBufferWarning}
                    onChange={(event) => setConfirmBufferWarning(event.target.checked)}
                  />
                  <span>
                    <ShieldAlert className="mr-1 inline h-4 w-4" />
                    I understand this invests before the emergency-buffer target is reached.
                  </span>
                </label>
              )}

              <Button
                disabled={saving || !selectedIds.length || Math.abs(total - number(plan.incomeAmount)) > 0.01}
                onClick={approve}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" />
                Approve selected allocations
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {plans.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Plan history</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plans.map((item) => (
              <button
                key={item.id}
                onClick={() => {
                  setWorkingPlan(item);
                  setEdits({});
                }}
                className={`flex w-full justify-between rounded-lg border p-3 text-left transition-colors ${
                  item.id === plan?.id ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-950/30' : 'hover:bg-gray-50/50 dark:hover:bg-gray-800/30'
                }`}
              >
                <span className="font-semibold">
                  {number(item.incomeAmount).toFixed(2)} {item.baseCurrency}
                </span>
                <span className="text-sm text-gray-500">
                  {item.status} · {new Date(item.createdAt).toLocaleDateString()}
                </span>
              </button>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
