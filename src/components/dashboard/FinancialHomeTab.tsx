import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, CircleDollarSign, Clock3, PiggyBank, ShieldCheck, Sparkles, WalletCards, X } from 'lucide-react';
import type { DashboardTab, FinancialHomeResponse, FinancialProfile, Goal } from '../../types';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

interface FinancialHomeTabProps {
  home: FinancialHomeResponse;
  goals: Goal[];
  saving: boolean;
  onNavigate: (tab: DashboardTab) => void;
  onCheckup: (profile: Partial<FinancialProfile>) => Promise<FinancialProfile | undefined>;
  onRecommendation: (id: string, action: 'dismiss' | 'snooze' | 'approve') => Promise<unknown>;
}

const amount = (value: number, currency: string) => `${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${currency}`;

export const FinancialHomeTab: React.FC<FinancialHomeTabProps> = ({ home, goals, saving, onNavigate, onCheckup, onRecommendation }) => {
  const [showCheckup, setShowCheckup] = useState(!home.profile.id);
  const [profile, setProfile] = useState<Partial<FinancialProfile>>(home.profile);
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => setProfile(home.profile), [home.profile]);
  const { snapshot, profile: savedProfile } = home;
  const nextAction = home.recommendations[0];
  const currency = savedProfile.baseCurrency;
  const saveCheckup = async (event: React.FormEvent) => {
    event.preventDefault();
    try { await onCheckup(profile); setShowCheckup(false); setNotice('Your financial strategy has been saved.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Unable to save the financial checkup.'); }
  };

  return <div className="mx-auto max-w-7xl space-y-5 pb-12">
    <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div>
        <p className="text-sm font-medium text-indigo-600 dark:text-indigo-400">TrueSpend Financial Operating System</p>
        <h2 className="text-2xl font-bold tracking-tight">Give every dirham a safe job.</h2>
        <p className="mt-1 text-sm text-gray-500">Facts are separated from forecasts. Planning guidance is not regulated investment advice.</p>
      </div>
      <Button variant="outline" onClick={() => setShowCheckup((open) => !open)}>{showCheckup ? 'Hide checkup' : 'Financial checkup'}</Button>
    </div>

    {notice && <div role="status" className="flex items-center justify-between rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-sm text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/40 dark:text-indigo-100"><span>{notice}</span><button aria-label="Dismiss message" onClick={() => setNotice(null)}><X className="h-4 w-4" /></button></div>}
    {home.dataCompleteness.length > 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><div className="flex gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-semibold">Your plan uses a few assumptions</p><ul className="mt-1 list-disc pl-5">{home.dataCompleteness.map((item) => <li key={item}>{item}</li>)}</ul></div></div></div>}

    {showCheckup && <Card className="border-indigo-200 dark:border-indigo-900"><CardHeader><CardTitle>Financial Checkup</CardTitle><CardDescription>These preferences guide protections and recommendations. You can change them later.</CardDescription></CardHeader><CardContent><form onSubmit={saveCheckup} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm font-medium">Currency<select value={profile.baseCurrency || 'MAD'} onChange={(event) => setProfile({ ...profile, baseCurrency: event.target.value })} className="mt-1 w-full rounded-md border bg-transparent p-2"><option>MAD</option><option>USD</option><option>EUR</option></select></label>
      <label className="text-sm font-medium">Strategy<select value={profile.strategy || 'Balanced'} onChange={(event) => setProfile({ ...profile, strategy: event.target.value as FinancialProfile['strategy'] })} className="mt-1 w-full rounded-md border bg-transparent p-2"><option>BufferFirst</option><option>DebtFirst</option><option>GoalFirst</option><option>Balanced</option><option>Custom</option></select></label>
      <label className="text-sm font-medium">Emergency target (months)<input min="0" step="0.5" type="number" value={profile.emergencyTargetMonths || '3'} onChange={(event) => setProfile({ ...profile, emergencyTargetMonths: event.target.value })} className="mt-1 w-full rounded-md border bg-transparent p-2" /></label>
      <label className="text-sm font-medium">Risk comfort<select value={profile.riskPreference || 'Medium'} onChange={(event) => setProfile({ ...profile, riskPreference: event.target.value as FinancialProfile['riskPreference'] })} className="mt-1 w-full rounded-md border bg-transparent p-2"><option>Low</option><option>Medium</option><option>High</option><option>VeryHigh</option></select></label>
      <label className="text-sm font-medium">Income frequency<select value={profile.incomeFrequency || 'monthly'} onChange={(event) => setProfile({ ...profile, incomeFrequency: event.target.value as FinancialProfile['incomeFrequency'] })} className="mt-1 w-full rounded-md border bg-transparent p-2"><option value="monthly">Monthly</option><option value="weekly">Weekly</option><option value="irregular">Irregular</option></select></label>
      <label className="text-sm font-medium">Income stability<select value={profile.incomeStability || 'stable'} onChange={(event) => setProfile({ ...profile, incomeStability: event.target.value as FinancialProfile['incomeStability'] })} className="mt-1 w-full rounded-md border bg-transparent p-2"><option value="stable">Stable</option><option value="variable">Variable</option><option value="irregular">Irregular</option></select></label>
      <label className="text-sm font-medium">Unallocated minimum<input min="0" step="1" type="number" value={profile.minimumUnallocatedAmount || '0'} onChange={(event) => setProfile({ ...profile, minimumUnallocatedAmount: event.target.value })} className="mt-1 w-full rounded-md border bg-transparent p-2" /></label>
      <div className="flex items-end"><Button className="w-full" disabled={saving} type="submit">{saving ? 'Saving…' : 'Save strategy'}</Button></div>
    </form></CardContent></Card>}

    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="border-transparent bg-gradient-to-br from-indigo-700 via-indigo-800 to-slate-950 text-white lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2 text-indigo-100"><ShieldCheck className="h-5 w-5" />Safe to spend today</CardTitle><CardDescription className="text-indigo-200">Immediately spendable cash after protections and known reservations.</CardDescription></CardHeader><CardContent><div className="text-4xl font-bold">{amount(snapshot.safeToSpend, currency)}</div><div className="mt-4 grid gap-2 text-sm sm:grid-cols-2">{snapshot.safeToSpendBreakdown.map((line) => <div key={line.label} className="flex justify-between rounded-lg bg-white/10 px-3 py-2"><span className="text-indigo-100">{line.label}</span><span className="font-semibold">{line.amount >= 0 ? '+' : '−'}{amount(Math.abs(line.amount), currency)}</span></div>)}</div></CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><PiggyBank className="h-5 w-5 text-emerald-600" />Emergency buffer</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{amount(snapshot.buffer.current, currency)}</p><p className="mt-1 text-sm text-gray-500">of {amount(snapshot.buffer.target, currency)} protected target</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800"><div className="h-full bg-emerald-500" style={{ width: `${Math.min(100, snapshot.buffer.target ? snapshot.buffer.current * 100 / snapshot.buffer.target : 0)}%` }} /></div><p className="mt-2 text-xs text-gray-500">{snapshot.buffer.coverageMonths.toFixed(1)} months of observed essentials.</p></CardContent></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-3">
      <Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-amber-500" />Next best action</CardTitle></CardHeader><CardContent>{nextAction ? <div className="rounded-xl bg-gray-50 p-4 dark:bg-gray-800/60"><p className="font-semibold">{nextAction.title}</p><p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{nextAction.summary}</p><details className="mt-3 text-sm"><summary className="cursor-pointer font-medium text-indigo-600">Why this?</summary><p className="mt-2 text-gray-500">{nextAction.rationale}</p></details><div className="mt-4 flex flex-wrap gap-2"><Button onClick={() => onNavigate(nextAction.type === 'SalaryPlanReady' ? 'plan' : 'plan')}>Review action <ArrowRight className="ml-1 h-4 w-4" /></Button><Button variant="outline" onClick={() => onRecommendation(nextAction.id, 'snooze')}>Postpone</Button><Button variant="ghost" onClick={() => onRecommendation(nextAction.id, 'dismiss')}>Dismiss</Button></div></div> : <div className="rounded-xl border border-dashed p-5 text-sm text-gray-500">No urgent coaching actions right now. Your next recommendation will appear here when there is a material, explainable step to consider.</div>}</CardContent></Card>
      <Card><CardHeader><CardTitle className="flex items-center gap-2"><CircleDollarSign className="h-5 w-5 text-indigo-600" />Current plan</CardTitle></CardHeader><CardContent>{home.activePlan ? <><p className="font-semibold">{home.activePlan.status} plan</p><p className="mt-1 text-sm text-gray-500">{amount(snapshot.plan.unallocatedIncome, currency)} remains intentionally unallocated.</p><Button className="mt-4 w-full" variant="outline" onClick={() => onNavigate('plan')}>Open salary plan</Button></> : <><p className="text-sm text-gray-500">No current salary plan is active.</p><Button className="mt-4 w-full" onClick={() => onNavigate('plan')}>Create plan</Button></>}</CardContent></Card>
    </div>

    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <Card><CardHeader><CardTitle className="text-sm text-gray-500">Liquid cash</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{amount(snapshot.liquidCash, currency)}</p><p className="mt-1 text-xs text-gray-500">Cash wallets only</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm text-gray-500">Investments</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{amount(snapshot.investmentMarketValue, currency)}</p><p className="mt-1 text-xs text-gray-500">Separate from spending capacity</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm text-gray-500">Net worth</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{amount(snapshot.netWorth, currency)}</p><p className="mt-1 text-xs text-gray-500">Includes investments and debts</p></CardContent></Card>
      <Card><CardHeader><CardTitle className="text-sm text-gray-500">Investment ceiling</CardTitle></CardHeader><CardContent><p className="text-xl font-bold">{amount(snapshot.investmentCapacity, currency)}</p><p className="mt-1 text-xs text-gray-500">A safe upper bound, not a command</p></CardContent></Card>
    </div>

    <div className="grid gap-4 lg:grid-cols-3"><Card className="lg:col-span-2"><CardHeader><CardTitle className="flex items-center gap-2"><Clock3 className="h-5 w-5 text-indigo-600" />This financial period</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-3"><div><p className="text-xs text-gray-500">Expected end balance</p><p className="text-lg font-semibold">{amount(snapshot.forecast.expected, currency)}</p></div><div><p className="text-xs text-gray-500">Best / worst forecast</p><p className="text-lg font-semibold">{amount(snapshot.forecast.best, currency)} / {amount(snapshot.forecast.worst, currency)}</p></div><div><p className="text-xs text-gray-500">Days remaining</p><p className="text-lg font-semibold">{snapshot.financialPeriod.daysRemaining}</p></div></CardContent></Card><Card><CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5 text-indigo-600" />Progress</CardTitle></CardHeader><CardContent><p className="text-sm text-gray-500">{goals.length} active goal{goals.length === 1 ? '' : 's'} · {amount(snapshot.reservedForGoals, currency)} planned per period</p><Button variant="outline" className="mt-4 w-full" onClick={() => onNavigate('roadmap')}>Open roadmap</Button></CardContent></Card></div>
    <Card><CardHeader><CardTitle>Coaching feed</CardTitle><CardDescription>Only the three most material recommendations appear on Home.</CardDescription></CardHeader><CardContent className="space-y-2">{home.recommendations.length ? home.recommendations.map((item) => <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border p-3"><div><p className="font-medium">{item.title}</p><p className="text-sm text-gray-500">{item.summary}</p></div><CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-500" /></div>) : <p className="text-sm text-gray-500">Nothing needs your attention right now.</p>}</CardContent></Card>
  </div>;
};
