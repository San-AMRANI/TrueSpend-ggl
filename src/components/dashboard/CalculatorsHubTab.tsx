import React, { useState, useMemo } from 'react';
import {
  Calculator,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Briefcase,
  Users,
  Flame,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Coins,
  Hourglass,
  ArrowUpRight,
  Scale,
  Calendar,
  Layers,
  ChevronRight,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import {
  KPI,
  Transaction,
  Payroll,
  Debt,
  CategoryBudget,
  Goal,
  DashboardTab,
  UserSettings,
} from '../../types';
import { computeFinancialState } from '../../lib/financialEngine';
import {
  calculateAffordability,
  calculateLoanAmortization,
  calculateMoroccanSalaryTax,
  calculateInflationDecay,
  calculateBillSplit,
  AffordabilityInput,
} from '../../lib/calculatorsEngine';
import { TactileSmartCalculator } from './TactileSmartCalculator';

interface CalculatorsHubTabProps {
  kpis: KPI | null;
  amount: number;
  setAmount: (amount: number) => void;
  transactions: Transaction[];
  payrolls: Payroll[];
  debts: Debt[];
  budgets: CategoryBudget[];
  goals?: Goal[];
  userSettings?: UserSettings | null;
  onNavigateToTab?: (tab: DashboardTab) => void;
  onCreateGoal?: (payload: any) => Promise<any>;
  onSaveCategoryBudget?: (category: string, year: number, month: number, amount: number) => Promise<any>;
  onSaveSettings?: (settings: Partial<UserSettings>) => Promise<any>;
}

export const CalculatorsHubTab: React.FC<CalculatorsHubTabProps> = ({
  kpis,
  amount: whatIfAmount,
  setAmount: setWhatIfAmount,
  transactions,
  payrolls,
  debts,
  budgets,
  goals = [],
  userSettings,
  onNavigateToTab,
  onCreateGoal,
  onSaveCategoryBudget,
  onSaveSettings,
}) => {
  // Calculator mode selection
  const [activeCalculator, setActiveCalculator] = useState<
    'smart-calc' | 'affordability' | 'loan-payoff' | 'salary-waterfall' | 'what-if' | 'inflation' | 'bill-split'
  >('smart-calc');

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const monthlySalary = userSettings?.salary || kpis?.salary || 12000;
  const realHourlyWage = Math.max(1, monthlySalary / (40 * 4.333));

  // ==========================================
  // 1. PURCHASE AFFORDABILITY STATE
  // ==========================================
  const [affordInput, setAffordInput] = useState<AffordabilityInput>({
    itemPrice: 4500,
    paymentMethod: 'cash',
    downPayment: 1500,
    monthlyPayment: 600,
    installmentMonths: 6,
    monthlyOngoingCosts: 150,
    yearsOfOwnership: 3,
  });

  const affordabilityResult = useMemo(() => {
    return calculateAffordability(affordInput, kpis, realHourlyWage);
  }, [affordInput, kpis, realHourlyWage]);

  // ==========================================
  // 2. LOAN & DEBT AMORTIZATION STATE
  // ==========================================
  const [loanPrincipal, setLoanPrincipal] = useState<number>(50000);
  const [loanInterestRate, setLoanInterestRate] = useState<number>(7.5);
  const [loanTermMonths, setLoanTermMonths] = useState<number>(36);
  const [loanExtraPayment, setLoanExtraPayment] = useState<number>(400);

  const loanResult = useMemo(() => {
    return calculateLoanAmortization(loanPrincipal, loanInterestRate, loanTermMonths, loanExtraPayment);
  }, [loanPrincipal, loanInterestRate, loanTermMonths, loanExtraPayment]);

  // Load from existing debts
  const handleLoadDebt = (debt: Debt) => {
    const balance = parseFloat(debt.remainingBalance) || 0;
    if (balance > 0) {
      setLoanPrincipal(balance);
      setLoanTermMonths(24);
      setLoanInterestRate(12.0);
      showToast(`Loaded "${debt.contactName}" debt (${balance.toLocaleString()} MAD) into accelerator!`);
    }
  };

  // ==========================================
  // 3. SALARY & WATERFALL STATE
  // ==========================================
  const [grossSalaryInput, setGrossSalaryInput] = useState<number>(15000);

  const salaryTaxResult = useMemo(() => {
    return calculateMoroccanSalaryTax(grossSalaryInput);
  }, [grossSalaryInput]);

  const handleApplySalaryToSettings = async () => {
    if (onSaveSettings) {
      try {
        await onSaveSettings({ salary: salaryTaxResult.netMonthlySalary });
        showToast(`✅ Net monthly salary updated to ${salaryTaxResult.netMonthlySalary.toLocaleString()} MAD!`);
      } catch (err) {
        showToast('Error saving salary setting.');
      }
    }
  };

  // ==========================================
  // 4. LIVE WHAT-IF SIMULATION STATE
  // ==========================================
  const [whatIfScenario, setWhatIfScenario] = useState<'purchase' | 'save' | 'salary'>('purchase');

  const simResult = useMemo(() => {
    if (!kpis) return null;
    if (whatIfAmount <= 0) return null;

    const effAmount = whatIfScenario === 'salary' ? -whatIfAmount : whatIfAmount;
    const mainBank = kpis.accounts.find((w) => w.type === 'Bank' && w.isMain) || kpis.accounts.find((w) => w.type === 'Bank');

    const dummyTransaction: Transaction = {
      id: 'what-if-dummy',
      userId: 'dummy',
      createdAt: new Date().toISOString(),
      amount: Math.abs(effAmount).toString(),
      type: effAmount < 0 ? 'Income' : 'Expense',
      walletId: mainBank ? mainBank.id : 'Bank',
      category: whatIfScenario === 'save' ? 'Savings Contribution' : 'What-If Simulation',
    };

    const simTransactions = [...transactions, dummyTransaction];

    return computeFinancialState({
      transactions: simTransactions,
      payrolls,
      debts,
      budgets,
      wallets: kpis.accounts,
      userSettings: {
        emergencyBuffer: kpis.emergencyBuffer,
        salary: kpis.salary || 0,
      },
    });
  }, [kpis, whatIfAmount, whatIfScenario, transactions, payrolls, debts, budgets]);

  // ==========================================
  // 5. INFLATION DECAY STATE
  // ==========================================
  const [inflationPrincipal, setInflationPrincipal] = useState<number>(kpis?.totalLiquidity || 50000);
  const [inflationRate, setInflationRate] = useState<number>(5.5);
  const [inflationYears, setInflationYears] = useState<number>(10);

  const inflationResult = useMemo(() => {
    return calculateInflationDecay(inflationPrincipal, inflationRate, inflationYears);
  }, [inflationPrincipal, inflationRate, inflationYears]);

  // ==========================================
  // 6. FAIR-SHARE BILL SPLIT STATE
  // ==========================================
  const [billSubtotal, setBillSubtotal] = useState<number>(680);
  const [billTipPercent, setBillTipPercent] = useState<number>(10);
  const [billPeopleCount, setBillPeopleCount] = useState<number>(4);

  const billSplitResult = useMemo(() => {
    return calculateBillSplit(billSubtotal, billTipPercent, billPeopleCount);
  }, [billSubtotal, billTipPercent, billPeopleCount]);

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-12">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-3 text-sm font-semibold shadow-2xl flex items-center gap-2 border border-gray-700 animate-bounce">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Banner */}
      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
                <Calculator className="h-3.5 w-3.5 text-indigo-400" /> Tactical Decision Suite
              </span>
              <span className="text-xs text-gray-400">· 6 Specialized Engines</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Smart Financial Calculators & Decision Studio
            </h1>
            <p className="text-sm text-gray-300 leading-relaxed">
              Stress-test major purchases, accelerate debt payoffs, audit paycheck tax brackets, and simulate cash-flow ripples before spending.
            </p>
          </div>

          {/* Quick Stat Pill */}
          <div className="shrink-0 bg-white/10 dark:bg-black/30 backdrop-blur-md rounded-xl p-4 border border-white/10 flex items-center gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-xs font-medium text-gray-300">Available Safe-to-Spend</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-black text-white">
                  {(kpis?.safeToSpend ?? 0).toFixed(0)}
                </span>
                <span className="text-xs text-emerald-300 font-bold">MAD</span>
              </div>
              <p className="text-[11px] text-gray-400">
                Runway: {kpis?.runwayDays ?? 0} days · Buffer: {(kpis?.emergencyBuffer ?? 0).toLocaleString()} MAD
              </p>
            </div>
          </div>
        </div>

        {/* Engine Navigation Pills */}
        <div className="relative z-10 mt-6 pt-5 border-t border-white/10 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setActiveCalculator('smart-calc')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'smart-calc'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Calculator className="h-4 w-4 text-indigo-400" />
            1. Smart Calculator
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('affordability')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'affordability'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            2. Purchase Affordability & TCO
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('loan-payoff')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'loan-payoff'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <CreditCard className="h-4 w-4 text-indigo-400" />
            3. Loan & Debt Accelerator
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('salary-waterfall')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'salary-waterfall'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Briefcase className="h-4 w-4 text-amber-400" />
            4. Net Salary & 4-Bucket Waterfall
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('what-if')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'what-if'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <TrendingUp className="h-4 w-4 text-sky-400" />
            5. Live Ledger Simulator (What-If)
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('inflation')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'inflation'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Flame className="h-4 w-4 text-rose-400" />
            6. Inflation & Purchasing Decay
          </button>

          <button
            type="button"
            onClick={() => setActiveCalculator('bill-split')}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeCalculator === 'bill-split'
                ? 'bg-white text-gray-900 shadow-md scale-[1.02]'
                : 'bg-white/10 text-gray-200 hover:bg-white/20'
            }`}
          >
            <Users className="h-4 w-4 text-purple-400" />
            7. Fair-Share Bill Splitter
          </button>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 0. TACTILE SMART CALCULATOR (DEFAULT & CORE APP TOOL)     */}
      {/* ========================================================= */}
      {activeCalculator === 'smart-calc' && (
        <div className="space-y-6 animate-fadeIn">
          <TactileSmartCalculator
            kpis={kpis}
            debts={debts}
            goals={goals}
            userSettings={userSettings}
            onNavigateToTab={onNavigateToTab}
            onSetWhatIfAmount={setWhatIfAmount}
            onCreateGoal={onCreateGoal}
          />
        </div>
      )}

      {/* ========================================================= */}
      {/* 1. PURCHASE AFFORDABILITY & TRUE COST OF OWNERSHIP (TCO) */}
      {/* ========================================================= */}
      {activeCalculator === 'affordability' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Form */}
            <Card className="lg:col-span-6 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Decision Parameters & Hidden Cost Audit
                </CardTitle>
                <CardDescription className="text-xs">
                  Factor in hidden recurring maintenance, insurance, subscriptions, and financing costs.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Price Tag */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Sticker Price (MAD)
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={affordInput.itemPrice}
                    onChange={(e) =>
                      setAffordInput({ ...affordInput, itemPrice: parseFloat(e.target.value) || 0 })
                    }
                    className="text-base font-bold"
                  />
                </div>

                {/* Payment Method */}
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1.5">
                    Financing Method
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAffordInput({ ...affordInput, paymentMethod: 'cash' })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        affordInput.paymentMethod === 'cash'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      💵 100% Upfront Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => setAffordInput({ ...affordInput, paymentMethod: 'installment' })}
                      className={`p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        affordInput.paymentMethod === 'installment'
                          ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
                          : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      📑 Installments / Loan
                    </button>
                  </div>
                </div>

                {/* Installment Sub-options */}
                {affordInput.paymentMethod === 'installment' && (
                  <div className="p-3.5 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                          Down Payment (MAD)
                        </label>
                        <Input
                          type="number"
                          value={affordInput.downPayment}
                          onChange={(e) =>
                            setAffordInput({ ...affordInput, downPayment: parseFloat(e.target.value) || 0 })
                          }
                          className="text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                          Monthly Installment (MAD)
                        </label>
                        <Input
                          type="number"
                          value={affordInput.monthlyPayment}
                          onChange={(e) =>
                            setAffordInput({ ...affordInput, monthlyPayment: parseFloat(e.target.value) || 0 })
                          }
                          className="text-xs"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-gray-600 dark:text-gray-400 block mb-1">
                        Term Duration (Months)
                      </label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {[3, 6, 12, 24].map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setAffordInput({ ...affordInput, installmentMonths: m })}
                            className={`py-1 text-xs font-semibold rounded border ${
                              affordInput.installmentMonths === m
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'border-gray-200 dark:border-gray-800 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            {m} Mo
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Hidden / Ongoing Costs */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Monthly Recurring Costs (MAD)
                    </label>
                    <Input
                      type="number"
                      placeholder="Insurance, subs, fuel..."
                      value={affordInput.monthlyOngoingCosts}
                      onChange={(e) =>
                        setAffordInput({ ...affordInput, monthlyOngoingCosts: parseFloat(e.target.value) || 0 })
                      }
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Years of Ownership
                    </label>
                    <Input
                      type="number"
                      value={affordInput.yearsOfOwnership}
                      onChange={(e) =>
                        setAffordInput({ ...affordInput, yearsOfOwnership: parseFloat(e.target.value) || 1 })
                      }
                      className="text-xs"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Verdict & Impact Summary */}
            <Card className="lg:col-span-6 border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Scale className="h-4 w-4 text-indigo-500" />
                    Affordability Diagnostic
                  </CardTitle>
                  <span className={`text-xs font-black uppercase px-2.5 py-1 rounded-full bg-gray-100 dark:bg-gray-800 ${affordabilityResult.verdictColor}`}>
                    {affordabilityResult.verdict}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 3 Key Numbers */}
                <div className="grid grid-cols-3 gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50">
                  <div>
                    <span className="text-[10px] font-medium text-gray-500 block">Immediate Cash Outlay</span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                      {affordabilityResult.totalInitialOutlay.toLocaleString()} MAD
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-gray-500 block">{affordInput.yearsOfOwnership}-Yr True Cost (TCO)</span>
                    <span className="text-base font-black text-indigo-600 dark:text-indigo-400">
                      {affordabilityResult.trueCostOfOwnership.toLocaleString()} MAD
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] font-medium text-gray-500 block">Life Energy Cost</span>
                    <span className="text-base font-extrabold text-amber-600 dark:text-amber-400">
                      {affordabilityResult.lifeHoursDemanded} Hrs
                    </span>
                  </div>
                </div>

                {/* Safe to Spend Delta */}
                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Safe-to-Spend Liquidity:</span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">
                      {affordabilityResult.safeToSpendImpact.currentSafeToSpend.toLocaleString()} →{' '}
                      <span className={affordabilityResult.safeToSpendImpact.newSafeToSpend < 0 ? 'text-rose-500' : 'text-emerald-500'}>
                        {affordabilityResult.safeToSpendImpact.newSafeToSpend.toLocaleString()} MAD
                      </span>
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-gray-400 font-medium">Emergency Moat Status:</span>
                    <span className={`font-bold ${affordabilityResult.emergencyMoatPreserved ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {affordabilityResult.emergencyMoatPreserved ? '🛡️ Buffer Intact' : '⚠️ Breaches Emergency Fund'}
                    </span>
                  </div>
                </div>

                {/* Advice Notes */}
                <div className="space-y-1.5">
                  {affordabilityResult.advice.map((adv, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <CheckCircle2 className="h-3.5 w-3.5 text-indigo-500 shrink-0 mt-0.5" />
                      <span>{adv}</span>
                    </div>
                  ))}
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateToTab?.('impulse-shield')}
                    className="text-xs"
                  >
                    Send to Impulse Cooldown Vault
                  </Button>
                  {onCreateGoal && (
                    <Button
                      size="sm"
                      onClick={() => {
                        onCreateGoal({
                          name: `Fund ${affordInput.itemPrice.toLocaleString()} MAD Purchase`,
                          targetAmount: affordInput.itemPrice,
                          currentAmount: 0,
                          category: 'Major Purchase',
                        });
                        showToast('🎯 Goal created for this purchase!');
                      }}
                      className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold ml-auto"
                    >
                      Create Sinking Goal
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. LOAN & DEBT AMORTIZATION PAYOFF ACCELERATOR */}
      {/* ========================================================= */}
      {activeCalculator === 'loan-payoff' && (
        <div className="space-y-6 animate-fadeIn">
          {/* Quick Import from user debts */}
          {debts.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 p-3 rounded-xl border border-indigo-100 dark:border-indigo-900/40 bg-indigo-50/40 dark:bg-indigo-950/20 text-xs">
              <span className="font-bold text-indigo-950 dark:text-indigo-200">
                Quick-Load Your TrueSpend Debts:
              </span>
              {debts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => handleLoadDebt(d)}
                  className="px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-50"
                >
                  {d.contactName} ({parseFloat(d.remainingBalance).toLocaleString()} MAD)
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Input Levers */}
            <Card className="lg:col-span-5 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-indigo-500" />
                  Loan & Financing Variables
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Principal Balance (MAD)
                  </label>
                  <Input
                    type="number"
                    value={loanPrincipal}
                    onChange={(e) => setLoanPrincipal(parseFloat(e.target.value) || 0)}
                    className="text-base font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Annual APR Interest (%)
                    </label>
                    <Input
                      type="number"
                      step="0.1"
                      value={loanInterestRate}
                      onChange={(e) => setLoanInterestRate(parseFloat(e.target.value) || 0)}
                      className="text-xs"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                      Loan Term (Months)
                    </label>
                    <Input
                      type="number"
                      value={loanTermMonths}
                      onChange={(e) => setLoanTermMonths(parseFloat(e.target.value) || 1)}
                      className="text-xs"
                    />
                  </div>
                </div>

                {/* Extra Payment Accelerator Slider */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                      Extra Monthly Accelerator Payment
                    </label>
                    <span className="text-xs font-extrabold text-emerald-600 dark:text-emerald-400">
                      +{loanExtraPayment.toLocaleString()} MAD/mo
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="5000"
                    step="50"
                    value={loanExtraPayment}
                    onChange={(e) => setLoanExtraPayment(parseFloat(e.target.value) || 0)}
                    className="w-full accent-emerald-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                    <span>+0 MAD</span>
                    <span>+1,000 MAD</span>
                    <span>+2,500 MAD</span>
                    <span>+5,000 MAD</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Payoff Results */}
            <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-emerald-500" />
                  Acceleration Impact & Interest Slashed
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                    <span className="text-[10px] font-medium text-gray-500 block">Standard Payment</span>
                    <span className="text-base font-extrabold text-gray-900 dark:text-gray-100">
                      {loanResult.baseMonthlyPayment.toLocaleString()} MAD
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-950/30">
                    <span className="text-[10px] font-medium text-indigo-700 dark:text-indigo-300 block">Accelerated Payment</span>
                    <span className="text-base font-extrabold text-indigo-600 dark:text-indigo-400">
                      {loanResult.acceleratedMonthlyPayment.toLocaleString()} MAD
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30">
                    <span className="text-[10px] font-medium text-emerald-700 dark:text-emerald-300 block">Interest Slashed</span>
                    <span className="text-base font-black text-emerald-600 dark:text-emerald-400">
                      +{loanResult.interestSaved.toLocaleString()} MAD
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30">
                    <span className="text-[10px] font-medium text-amber-800 dark:text-amber-300 block">Months Saved</span>
                    <span className="text-base font-black text-amber-600 dark:text-amber-400">
                      {loanResult.monthsSaved} Months
                    </span>
                  </div>
                </div>

                {/* Amortization Schedule Preview */}
                <div className="pt-2">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-2">
                    Key Payoff Checkpoints (Accelerated)
                  </p>
                  <div className="max-h-52 overflow-y-auto border border-gray-100 dark:border-gray-800 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800/60 sticky top-0 text-gray-500 font-semibold">
                        <tr>
                          <th className="p-2.5">Month</th>
                          <th className="p-2.5">Principal Paid</th>
                          <th className="p-2.5">Interest</th>
                          <th className="p-2.5 text-right">Remaining Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {loanResult.schedule.map((step) => (
                          <tr key={step.month} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                            <td className="p-2.5 font-bold">Month {step.month}</td>
                            <td className="p-2.5 font-semibold text-emerald-600">
                              {step.principal.toLocaleString()} MAD
                            </td>
                            <td className="p-2.5 text-gray-500">{step.interest.toLocaleString()} MAD</td>
                            <td className="p-2.5 text-right font-black text-gray-900 dark:text-gray-100">
                              {step.remainingBalance.toLocaleString()} MAD
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. NET SALARY & 4-BUCKET PAYCHECK WATERFALL */}
      {/* ========================================================= */}
      {activeCalculator === 'salary-waterfall' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Gross Salary Input */}
            <Card className="lg:col-span-5 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-amber-500" />
                  Moroccan Gross-to-Net Tax Audit
                </CardTitle>
                <CardDescription className="text-xs">
                  Accurate calculation of CNSS, AMO, Professional Expense deductions, and progressive IR brackets.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Monthly Gross Base Salary (MAD)
                  </label>
                  <Input
                    type="number"
                    value={grossSalaryInput}
                    onChange={(e) => setGrossSalaryInput(parseFloat(e.target.value) || 0)}
                    className="text-lg font-black"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[8000, 12000, 18000, 25000, 40000].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setGrossSalaryInput(s)}
                        className="text-[11px] px-2 py-1 rounded border border-gray-200 dark:border-gray-800 font-semibold"
                      >
                        {s.toLocaleString()} MAD
                      </button>
                    ))}
                  </div>
                </div>

                {/* Deductions Breakdown Table */}
                <div className="p-3.5 rounded-xl border border-gray-100 dark:border-gray-800 space-y-2 text-xs">
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>CNSS Social Security (4.48%):</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      -{salaryTaxResult.cnssContribution.toLocaleString()} MAD
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>AMO Medical Coverage (2.26%):</span>
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      -{salaryTaxResult.amoContribution.toLocaleString()} MAD
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-gray-600 dark:text-gray-400">
                    <span>IR Income Tax (Progressive):</span>
                    <span className="font-semibold text-rose-600 dark:text-rose-400">
                      -{salaryTaxResult.incomeTaxIR.toLocaleString()} MAD
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-gray-100 dark:border-gray-800 font-bold">
                    <span>Effective Total Tax Drag:</span>
                    <span className="text-amber-600">{salaryTaxResult.effectiveTaxRatePercent}%</span>
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleApplySalaryToSettings}
                  className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Set as TrueSpend Net Salary Setting
                </Button>
              </CardContent>
            </Card>

            {/* 4-Bucket Waterfall Distribution */}
            <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Layers className="h-4 w-4 text-indigo-500" />
                  Net Take-Home Pay: {salaryTaxResult.netMonthlySalary.toLocaleString()} MAD / month
                </CardTitle>
                <CardDescription className="text-xs">
                  The mathematically optimal 4-bucket distribution recommended for TrueSpend:
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Essentials 50% */}
                  <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-900/40 bg-blue-50/40 dark:bg-blue-950/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                        1. Essentials & Shelter (50%)
                      </span>
                      <span className="text-xs font-extrabold text-blue-700 dark:text-blue-400">
                        {salaryTaxResult.waterfallBuckets.essentials50.toLocaleString()} MAD
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Rent, groceries, utilities, transit, core medical expenses.
                    </p>
                  </div>

                  {/* Compounding Wealth 20% */}
                  <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-900/40 bg-emerald-50/40 dark:bg-emerald-950/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                        2. Wealth Compounding (20%)
                      </span>
                      <span className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400">
                        {salaryTaxResult.waterfallBuckets.compounding20.toLocaleString()} MAD
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Index funds, emergency moat, high-interest debt payoffs.
                    </p>
                  </div>

                  {/* Sinking Goals 20% */}
                  <div className="p-4 rounded-xl border border-purple-200 dark:border-purple-900/40 bg-purple-50/40 dark:bg-purple-950/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-purple-900 dark:text-purple-300">
                        3. Sinking Goals (20%)
                      </span>
                      <span className="text-xs font-extrabold text-purple-700 dark:text-purple-400">
                        {salaryTaxResult.waterfallBuckets.goals20.toLocaleString()} MAD
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Vacations, home upgrades, education, electronics replacement.
                    </p>
                  </div>

                  {/* Guilt-Free 10% */}
                  <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/20">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-bold text-amber-900 dark:text-amber-300">
                        4. Guilt-Free Joy (10%)
                      </span>
                      <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400">
                        {salaryTaxResult.waterfallBuckets.guiltFree10.toLocaleString()} MAD
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Dining out, spontaneous treats, hobbies, entertainment.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. LIVE FINANCIAL STATE & RUNWAY SIMULATOR (WHAT-IF) */}
      {/* ========================================================= */}
      {activeCalculator === 'what-if' && (
        <div className="space-y-6 animate-fadeIn">
          <Card className="border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/30 dark:bg-indigo-900/20">
            <CardHeader>
              <CardTitle className="text-base text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                <span>Simulate Immediate Ledger Shock / Action</span>
                <select
                  value={whatIfScenario}
                  onChange={(e) => setWhatIfScenario(e.target.value as any)}
                  className="bg-white dark:bg-gray-800 text-xs font-bold p-1.5 rounded-lg border border-indigo-300 dark:border-indigo-800 focus:outline-none"
                >
                  <option value="purchase">Try a Purchase / Outflow</option>
                  <option value="save">Contribute to Savings / Goal</option>
                  <option value="salary">Receive Early Bonus / Windfall</option>
                </select>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row">
                <Input
                  type="number"
                  min="0"
                  value={whatIfAmount || ''}
                  onChange={(e) => setWhatIfAmount(Math.max(0, parseFloat(e.target.value) || 0))}
                  placeholder="Simulated Amount in MAD"
                  className="text-base font-bold"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setWhatIfAmount(0)}
                  className="shrink-0"
                >
                  Reset
                </Button>
              </div>

              {whatIfAmount > 0 && simResult && kpis && (
                <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 space-y-4">
                  <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-indigo-500" /> Projected Impact on Core Metrics
                  </h3>

                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                      <p className="text-xs text-gray-500">Safe to Spend</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                        {kpis.safeToSpend.toFixed(0)} →{' '}
                        <span className={simResult.safeToSpend < kpis.safeToSpend ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}>
                          {simResult.safeToSpend.toFixed(0)} MAD
                        </span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                      <p className="text-xs text-gray-500">Runway Days</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                        {kpis.runwayDays}d →{' '}
                        <span className={simResult.runwayDays < kpis.runwayDays ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}>
                          {simResult.runwayDays} days
                        </span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                      <p className="text-xs text-gray-500">Daily Allowance</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                        {kpis.dailyRemaining.toFixed(0)} →{' '}
                        <span className={simResult.dailyRemaining < kpis.dailyRemaining ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}>
                          {simResult.dailyRemaining.toFixed(0)} MAD
                        </span>
                      </p>
                    </div>

                    <div className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800/40">
                      <p className="text-xs text-gray-500">Health Score</p>
                      <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">
                        {kpis.healthScore}/100 →{' '}
                        <span className={simResult.healthScore < kpis.healthScore ? 'text-red-500 font-black' : 'text-emerald-500 font-black'}>
                          {simResult.healthScore}
                        </span>
                      </p>
                    </div>
                  </div>

                  {simResult.dailyStatus === 'critical' && (
                    <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/20 p-3 rounded-lg border border-red-200">
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>Warning: This simulated action pushes your daily allowance into critical alert status.</span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. INFLATION & PURCHASING POWER EROSION */}
      {/* ========================================================= */}
      {activeCalculator === 'inflation' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Card className="lg:col-span-5 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Flame className="h-4 w-4 text-rose-500" />
                  Inflation Rate & Horizon Levers
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Cash Reserve Stash (MAD)
                  </label>
                  <Input
                    type="number"
                    value={inflationPrincipal}
                    onChange={(e) => setInflationPrincipal(parseFloat(e.target.value) || 0)}
                    className="text-base font-bold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Annual Inflation Rate
                    </label>
                    <span className="text-xs font-bold text-rose-600">{inflationRate}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3.5, 5.5, 7.5, 10.0].map((rate) => (
                      <button
                        key={rate}
                        type="button"
                        onClick={() => setInflationRate(rate)}
                        className={`py-1 text-xs font-semibold rounded border ${
                          inflationRate === rate
                            ? 'bg-rose-600 text-white border-rose-600'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Time Horizon (Years)
                  </label>
                  <div className="grid grid-cols-4 gap-1.5">
                    {[3, 5, 10, 20].map((y) => (
                      <button
                        key={y}
                        type="button"
                        onClick={() => setInflationYears(y)}
                        className={`py-1 text-xs font-semibold rounded border ${
                          inflationYears === y
                            ? 'bg-slate-900 text-white dark:bg-white dark:text-gray-900'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        {y} Yrs
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-7 border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Hourglass className="h-4 w-4 text-purple-500" />
                  Purchasing Power Erosion Trajectory
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-rose-50/50 dark:bg-rose-950/20 border border-rose-100 dark:border-rose-900/40">
                  <div>
                    <span className="text-xs text-rose-800 dark:text-rose-300 font-medium">
                      Real Value in {inflationYears} Years
                    </span>
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">
                      {inflationResult.purchasingPowerRemaining.toLocaleString()} MAD
                    </p>
                    <p className="text-[10px] text-rose-700 dark:text-rose-300">
                      -{inflationResult.purchasingPowerLostPercent}% purchasing power lost
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-600 dark:text-gray-400 font-medium">
                      Nominal Cash Needed to Match
                    </span>
                    <p className="text-2xl font-black text-gray-900 dark:text-gray-100 mt-0.5">
                      {inflationResult.nominalNeededToMatch.toLocaleString()} MAD
                    </p>
                    <p className="text-[10px] text-gray-500">to maintain equivalent purchasing power</p>
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Decay by Year (Constant {inflationRate}% Inflation):
                  </p>
                  {inflationResult.trajectory.map((step) => (
                    <div key={step.year} className="flex items-center gap-3 text-xs">
                      <span className="w-16 font-bold text-gray-500">Year {step.year}</span>
                      <div className="flex-1 bg-gray-100 dark:bg-gray-800 h-5 rounded overflow-hidden">
                        <div
                          style={{
                            width: `${(step.realValue / Math.max(1, inflationPrincipal)) * 100}%`,
                          }}
                          className="h-full bg-gradient-to-r from-rose-500 to-amber-500 rounded"
                        />
                      </div>
                      <span className="font-extrabold text-gray-900 dark:text-gray-100 w-24 text-right">
                        {step.realValue.toLocaleString()} MAD
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. FAIR-SHARE BILL SPLITTER */}
      {/* ========================================================= */}
      {activeCalculator === 'bill-split' && (
        <div className="space-y-6 animate-fadeIn">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="border-slate-200 dark:border-slate-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="h-4 w-4 text-purple-500" />
                  Bill & Gratuity Split Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Subtotal Bill (MAD)
                  </label>
                  <Input
                    type="number"
                    value={billSubtotal}
                    onChange={(e) => setBillSubtotal(parseFloat(e.target.value) || 0)}
                    className="text-base font-bold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                      Tip / Gratuity Percentage
                    </label>
                    <span className="text-xs font-bold text-indigo-600">{billTipPercent}%</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[0, 5, 10, 15, 20].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setBillTipPercent(t)}
                        className={`py-1 text-xs font-semibold rounded border ${
                          billTipPercent === t
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'border-gray-200 dark:border-gray-800'
                        }`}
                      >
                        {t}%
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Number of People
                  </label>
                  <Input
                    type="number"
                    min="1"
                    value={billPeopleCount}
                    onChange={(e) => setBillPeopleCount(parseInt(e.target.value, 10) || 1)}
                    className="text-xs"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="border-slate-200 dark:border-slate-800 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Fair Share Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="p-5 rounded-2xl bg-gradient-to-br from-indigo-900 to-slate-900 text-white text-center">
                  <span className="text-xs text-indigo-300 font-medium">Each Person Owes</span>
                  <div className="text-4xl font-black text-white mt-1">
                    {billSplitResult.amountPerPerson.toFixed(2)}{' '}
                    <span className="text-base font-bold text-indigo-300">MAD</span>
                  </div>
                  <p className="text-[11px] text-gray-300 mt-2">
                    Total bill: {billSplitResult.totalWithTip.toFixed(2)} MAD (includes{' '}
                    {billSplitResult.tipAmount.toFixed(2)} MAD tip)
                  </p>
                </div>

                <Button
                  size="sm"
                  onClick={() => onNavigateToTab?.('debts')}
                  className="w-full text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Record Split in Debts & Receivables →
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};
