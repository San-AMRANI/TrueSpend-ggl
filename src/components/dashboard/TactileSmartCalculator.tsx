import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Calculator as CalcIcon,
  Delete,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  Briefcase,
  Users,
  Flame,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Coins,
  History,
  Tag,
  Copy,
  Plus,
  Send,
  ArrowUpRight,
  ArrowDownRight,
  WalletCards,
  Percent,
  Divide,
  X,
  Minus,
  Check,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/Card';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import {
  KPI,
  Transaction,
  Debt,
  Goal,
  DashboardTab,
  UserSettings,
} from '../../types';
import { evaluateExpression } from '../../lib/calculatorParser';
import { useAuth } from '../../context/AuthContext';
import { expenseCategories, incomeAndTransferCategories } from '../../lib/categories';

export interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: number;
  timestamp: string;
  note?: string;
}

interface TactileSmartCalculatorProps {
  kpis: KPI | null;
  debts?: Debt[];
  goals?: Goal[];
  userSettings?: UserSettings | null;
  onNavigateToTab?: (tab: DashboardTab) => void;
  onSetWhatIfAmount?: (amount: number) => void;
  onCreateGoal?: (payload: any) => Promise<any>;
  onTransactionLogged?: () => void;
}

export const TactileSmartCalculator: React.FC<TactileSmartCalculatorProps> = ({
  kpis,
  debts = [],
  goals = [],
  userSettings,
  onNavigateToTab,
  onSetWhatIfAmount,
  onCreateGoal,
  onTransactionLogged,
}) => {
  const { token } = useAuth();

  // Calculator Core State
  const [expression, setExpression] = useState<string>('');
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [memoryValue, setMemoryValue] = useState<number>(0);
  const [isNewCalculation, setIsNewCalculation] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // History / Tape State
  const [history, setHistory] = useState<CalculationHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem('truespend_calc_history');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [showHistory, setShowHistory] = useState<boolean>(false);
  const [historyNoteInput, setHistoryNoteInput] = useState<{ [id: string]: string }>({});

  // Quick Transaction Logging Modal
  const [showQuickLogModal, setShowQuickLogModal] = useState<boolean>(false);
  const [quickLogType, setQuickLogType] = useState<'Expense' | 'Income'>('Expense');
  const [quickLogCategory, setQuickLogCategory] = useState<string>('General Discretionary');
  const [quickLogWalletId, setQuickLogWalletId] = useState<string>('');
  const [quickLogNotes, setQuickLogNotes] = useState<string>('');
  const [isSubmittingTx, setIsSubmittingTx] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const saveHistory = (items: CalculationHistoryItem[]) => {
    setHistory(items);
    try {
      localStorage.setItem('truespend_calc_history', JSON.stringify(items));
    } catch (e) {
      // ignore
    }
  };

  // Current numeric result of calculation
  const numericResult = useMemo(() => {
    const parsed = parseFloat(displayValue.replace(/,/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  }, [displayValue]);

  // Hourly wage calculation
  const monthlySalary = userSettings?.salary || kpis?.salary || 12000;
  const realHourlyWage = Math.max(1, monthlySalary / (40 * 4.333));
  const workHoursDemanded = useMemo(() => {
    if (numericResult <= 0) return 0;
    return parseFloat((numericResult / realHourlyWage).toFixed(1));
  }, [numericResult, realHourlyWage]);

  // 10-Year Compounding projection
  const tenYearCompounded = useMemo(() => {
    if (numericResult <= 0) return 0;
    // FV = P * (1 + 0.10)^10 = 2.5937 * P
    return Math.round(numericResult * 2.5937);
  }, [numericResult]);

  // Live TrueSpend Telemetry Calculations
  const dailyRemaining = kpis?.dailyRemaining ?? 0;
  const dailyPercent = useMemo(() => {
    if (dailyRemaining <= 0 || numericResult <= 0) return 0;
    return Math.round((numericResult / dailyRemaining) * 100);
  }, [numericResult, dailyRemaining]);

  const safeToSpendCurrent = kpis?.safeToSpend ?? 0;
  const safeToSpendPost = useMemo(() => {
    return Math.round(safeToSpendCurrent - numericResult);
  }, [safeToSpendCurrent, numericResult]);

  // Handle typing input
  const handleDigit = (digit: string) => {
    setErrorMessage(null);
    if (isNewCalculation) {
      setDisplayValue(digit);
      setExpression(digit);
      setIsNewCalculation(false);
    } else {
      if (digit === '.' && displayValue.includes('.')) return;
      const nextDisplay = displayValue === '0' && digit !== '.' ? digit : displayValue + digit;
      setDisplayValue(nextDisplay);
      setExpression((prev) => prev + digit);
    }
  };

  const handleOperator = (op: string) => {
    setErrorMessage(null);
    const symbolMap: Record<string, string> = {
      '+': ' + ',
      '-': ' − ',
      '*': ' × ',
      '/': ' ÷ ',
      '%': ' % ',
    };
    const sym = symbolMap[op] || ` ${op} `;

    if (isNewCalculation) {
      setExpression(displayValue + sym);
      setIsNewCalculation(false);
    } else {
      // If last char is already an operator, replace it
      const trimmed = expression.trimEnd();
      const lastChar = trimmed.slice(-1);
      if (['+', '−', '×', '÷', '-', '*', '/'].includes(lastChar)) {
        setExpression(trimmed.slice(0, -1) + sym);
      } else {
        setExpression((prev) => prev + sym);
      }
    }
  };

  const handleClear = () => {
    setExpression('');
    setDisplayValue('0');
    setErrorMessage(null);
    setIsNewCalculation(true);
  };

  const handleBackspace = () => {
    setErrorMessage(null);
    if (isNewCalculation || displayValue.length <= 1) {
      setDisplayValue('0');
      setExpression('');
      setIsNewCalculation(true);
    } else {
      const nextVal = displayValue.slice(0, -1);
      setDisplayValue(nextVal);
      setExpression((prev) => (prev.length > 0 ? prev.slice(0, -1) : ''));
    }
  };

  const handleToggleSign = () => {
    if (displayValue === '0') return;
    if (displayValue.startsWith('-')) {
      setDisplayValue(displayValue.slice(1));
    } else {
      setDisplayValue('-' + displayValue);
    }
  };

  const handleParenthesis = () => {
    const openCount = (expression.match(/\(/g) || []).length;
    const closeCount = (expression.match(/\)/g) || []).length;
    const lastChar = expression.trim().slice(-1);

    if (openCount === closeCount || ['+', '−', '×', '÷', '(', '-', '*', '/'].includes(lastChar)) {
      setExpression((prev) => prev + '(');
    } else {
      setExpression((prev) => prev + ')');
    }
    setIsNewCalculation(false);
  };

  const handleEqual = () => {
    if (!expression && displayValue === '0') return;

    const exprToEvaluate = expression || displayValue;
    const evalRes = evaluateExpression(exprToEvaluate);

    if (!evalRes.success) {
      setErrorMessage(evalRes.error || 'Calculation Error');
      return;
    }

    const finalVal = evalRes.result;
    setDisplayValue(finalVal.toString());

    // Add to history tape
    const newItem: CalculationHistoryItem = {
      id: `calc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      expression: exprToEvaluate,
      result: finalVal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    saveHistory([newItem, ...history.slice(0, 49)]);

    setExpression(`${exprToEvaluate} =`);
    setIsNewCalculation(true);
  };

  // Memory Functions
  const handleMemoryAdd = () => {
    setMemoryValue((prev) => prev + numericResult);
    showToast(`M+ added: ${numericResult} MAD (Memory: ${memoryValue + numericResult})`);
  };
  const handleMemorySub = () => {
    setMemoryValue((prev) => prev - numericResult);
    showToast(`M- subtracted: ${numericResult} MAD (Memory: ${memoryValue - numericResult})`);
  };
  const handleMemoryRecall = () => {
    setDisplayValue(memoryValue.toString());
    setExpression((prev) => (isNewCalculation ? memoryValue.toString() : prev + memoryValue.toString()));
    setIsNewCalculation(false);
    showToast(`Recalled from memory: ${memoryValue} MAD`);
  };
  const handleMemoryClear = () => {
    setMemoryValue(0);
    showToast('Memory cleared (MC)');
  };

  // Quick TrueSpend Variable Injections
  const handleInjectVariable = (val: number, label: string) => {
    const valStr = Math.round(val).toString();
    if (isNewCalculation) {
      setDisplayValue(valStr);
      setExpression(valStr);
      setIsNewCalculation(false);
    } else {
      setDisplayValue(valStr);
      setExpression((prev) => prev + valStr);
    }
    showToast(`Injected ${label} (${valStr} MAD)`);
  };

  // Quick Splitters
  const handleQuickDivide = (people: number) => {
    if (numericResult <= 0) return;
    const splitAmount = parseFloat((numericResult / people).toFixed(2));
    setExpression(`(${numericResult} ÷ ${people})`);
    setDisplayValue(splitAmount.toString());
    setIsNewCalculation(true);
    showToast(`Split among ${people} people: ${splitAmount} MAD each`);
  };

  const handleQuickTip = (tipPercent: number) => {
    if (numericResult <= 0) return;
    const total = parseFloat((numericResult * (1 + tipPercent / 100)).toFixed(2));
    setExpression(`(${numericResult} + ${tipPercent}% tip)`);
    setDisplayValue(total.toString());
    setIsNewCalculation(true);
    showToast(`Added ${tipPercent}% tip: ${total} MAD total`);
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        return;
      }

      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault();
        handleDigit(e.key);
      } else if (e.key === '.') {
        e.preventDefault();
        handleDigit('.');
      } else if (e.key === '+') {
        e.preventDefault();
        handleOperator('+');
      } else if (e.key === '-') {
        e.preventDefault();
        handleOperator('-');
      } else if (e.key === '*' || e.key === 'x') {
        e.preventDefault();
        handleOperator('*');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOperator('/');
      } else if (e.key === '%') {
        e.preventDefault();
        handleOperator('%');
      } else if (e.key === '(' || e.key === ')') {
        e.preventDefault();
        handleParenthesis();
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [displayValue, expression, isNewCalculation]);

  // Quick Transaction Log handler
  const handleOpenQuickLog = (type: 'Expense' | 'Income') => {
    setQuickLogType(type);
    const mainWallet = kpis?.accounts?.find((w) => w.type === 'Bank' && w.isMain) || kpis?.accounts?.[0];
    setQuickLogWalletId(mainWallet?.id || '');
    setQuickLogNotes(expression ? `Calculated: ${expression}` : '');
    setShowQuickLogModal(true);
  };

  const handleExecuteQuickLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      showToast('Please sign in to log transactions');
      return;
    }
    if (numericResult <= 0) {
      showToast('Enter a valid amount greater than 0');
      return;
    }

    setIsSubmittingTx(true);
    try {
      const payload = {
        amount: numericResult.toFixed(2),
        type: quickLogType,
        walletId: quickLogWalletId || kpis?.accounts?.[0]?.id,
        category: quickLogCategory,
        notes: quickLogNotes || 'Logged via TrueSpend Smart Calculator',
        transaction_date: new Date().toISOString().slice(0, 10),
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error('Failed to create transaction');

      showToast(`✅ ${quickLogType} of ${numericResult.toLocaleString()} MAD logged successfully!`);
      setShowQuickLogModal(false);
      onTransactionLogged?.();
    } catch (err: any) {
      showToast(`Error: ${err?.message || 'Failed to save'}`);
    } finally {
      setIsSubmittingTx(false);
    }
  };

  // Test in What-If
  const handleTestInWhatIf = () => {
    if (onSetWhatIfAmount) {
      onSetWhatIfAmount(numericResult);
    }
    onNavigateToTab?.('what-if');
    showToast(`Simulating ${numericResult.toLocaleString()} MAD in What-If engine`);
  };

  // Send to Impulse Shield
  const handleSendToImpulseShield = () => {
    onNavigateToTab?.('impulse-shield');
    showToast(`Opening Impulse Shield for ${numericResult.toLocaleString()} MAD`);
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-gray-900 text-white dark:bg-white dark:text-gray-900 px-4 py-3 text-xs sm:text-sm font-semibold shadow-2xl flex items-center gap-2 border border-gray-700 animate-bounce">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Calculator Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: The Tactical Handheld / Desktop Calculator */}
        <div className="lg:col-span-7 space-y-4">
          <div className="rounded-3xl border border-slate-300 dark:border-slate-800 bg-slate-900 text-white p-5 sm:p-7 shadow-2xl select-none">
            {/* Top Bar: Title & Memory Indicator */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                  <CalcIcon className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs font-extrabold tracking-wide uppercase text-slate-300">
                    TrueSpend Tactical Calculator
                  </span>
                  <span className="text-[10px] text-slate-500 block">Live Ledger Linked</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {memoryValue !== 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400/20 text-amber-300 border border-amber-400/30 animate-pulse">
                    M = {memoryValue.toLocaleString()}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setShowHistory(!showHistory)}
                  className={`p-1.5 rounded-lg border text-xs transition-colors flex items-center gap-1 ${
                    showHistory
                      ? 'bg-indigo-600 border-indigo-500 text-white'
                      : 'border-slate-700 hover:bg-slate-800 text-slate-300'
                  }`}
                  title="Toggle calculation tape"
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Tape ({history.length})</span>
                </button>
              </div>
            </div>

            {/* OLED / LCD Calculator Screen */}
            <div className="rounded-2xl bg-black/60 border border-slate-800 p-4 sm:p-5 mb-4 shadow-inner space-y-2">
              {/* Expression History Line */}
              <div className="h-6 text-right text-xs sm:text-sm font-mono text-slate-400 truncate tracking-wide">
                {expression || ' '}
              </div>

              {/* Main Evaluated Output */}
              <div className="flex items-baseline justify-end gap-2">
                <span className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-white truncate">
                  {errorMessage ? (
                    <span className="text-rose-400 text-2xl sm:text-3xl">{errorMessage}</span>
                  ) : (
                    Number(displayValue).toLocaleString('en-US', { maximumFractionDigits: 6 })
                  )}
                </span>
                <span className="text-xs sm:text-sm font-bold text-amber-400 shrink-0">MAD</span>
              </div>

              {/* TrueSpend Live Impact Telemetry Strip */}
              {numericResult > 0 && !errorMessage && (
                <div className="mt-3 pt-3 border-t border-slate-800/80 space-y-2 text-xs">
                  {/* Daily Allowance Bar */}
                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-[11px]">
                      <span className="text-slate-400">
                        Daily Allowance Share ({dailyRemaining.toFixed(0)} MAD left today):
                      </span>
                      <span
                        className={`font-black ${
                          dailyPercent > 100
                            ? 'text-rose-400'
                            : dailyPercent > 70
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {dailyPercent}% {dailyPercent > 100 ? '⚠️ OVER' : ''}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800 overflow-hidden">
                      <div
                        style={{ width: `${Math.min(100, dailyPercent)}%` }}
                        className={`h-full rounded-full transition-all duration-300 ${
                          dailyPercent > 100
                            ? 'bg-rose-500'
                            : dailyPercent > 70
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                      />
                    </div>
                  </div>

                  {/* Impact Pills */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-slate-400 block">Post Safe-to-Spend</span>
                      <span
                        className={`text-xs font-bold ${
                          safeToSpendPost < 0 ? 'text-rose-400' : 'text-slate-200'
                        }`}
                      >
                        {safeToSpendPost.toLocaleString()} MAD
                      </span>
                    </div>

                    <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-slate-400 block">Life Energy Cost</span>
                      <span className="text-xs font-bold text-amber-300">
                        ⏱️ {workHoursDemanded} hrs
                      </span>
                    </div>

                    <div className="bg-slate-800/60 rounded-lg p-2 text-center">
                      <span className="text-[10px] text-slate-400 block">10-Yr S&P 500</span>
                      <span className="text-xs font-bold text-emerald-400">
                        📈 {tenYearCompounded.toLocaleString()} MAD
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick TrueSpend Variables Bar (Injectors) */}
            <div className="mb-4">
              <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-400 block mb-1.5">
                Quick-Insert TrueSpend Balance Variables:
              </span>
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-thin">
                <button
                  type="button"
                  onClick={() => handleInjectVariable(kpis?.safeToSpend || 0, 'Safe-to-Spend')}
                  className="px-2.5 py-1 rounded-lg border border-indigo-500/40 bg-indigo-950/40 hover:bg-indigo-900/60 text-indigo-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Safe: {(kpis?.safeToSpend || 0).toFixed(0)} MAD
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectVariable(kpis?.dailyRemaining || 0, 'Daily Left')}
                  className="px-2.5 py-1 rounded-lg border border-emerald-500/40 bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Daily: {(kpis?.dailyRemaining || 0).toFixed(0)} MAD
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectVariable(kpis?.totalLiquidity || 0, 'Total Liquidity')}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Liquidity: {(kpis?.totalLiquidity || 0).toFixed(0)} MAD
                </button>

                <button
                  type="button"
                  onClick={() => handleInjectVariable(kpis?.emergencyBuffer || 0, 'Emergency Buffer')}
                  className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                >
                  Buffer: {(kpis?.emergencyBuffer || 0).toFixed(0)} MAD
                </button>

                {kpis?.accounts?.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => handleInjectVariable(acc.balance || 0, acc.name)}
                    className="px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors"
                  >
                    {acc.name}: {acc.balance.toFixed(0)}
                  </button>
                ))}
              </div>
            </div>

            {/* Tactile Keypad */}
            <div className="space-y-2">
              {/* Memory Row */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleMemoryClear}
                  className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-black transition-all border border-slate-700"
                >
                  MC
                </button>
                <button
                  type="button"
                  onClick={handleMemoryRecall}
                  className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-300 text-xs font-black transition-all border border-slate-700"
                >
                  MR
                </button>
                <button
                  type="button"
                  onClick={handleMemoryAdd}
                  className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-indigo-400 text-xs font-black transition-all border border-slate-700"
                >
                  M+
                </button>
                <button
                  type="button"
                  onClick={handleMemorySub}
                  className="h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-indigo-400 text-xs font-black transition-all border border-slate-700"
                >
                  M−
                </button>
              </div>

              {/* Row 1: AC, Del, (), ÷ */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleClear}
                  className="h-14 rounded-2xl bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/60 text-rose-300 text-base font-black active:scale-95 transition-all"
                >
                  AC
                </button>
                <button
                  type="button"
                  onClick={handleBackspace}
                  className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base font-bold active:scale-95 transition-all flex items-center justify-center"
                >
                  <Delete className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={handleParenthesis}
                  className="h-14 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-base font-bold active:scale-95 transition-all"
                >
                  ( )
                </button>
                <button
                  type="button"
                  onClick={() => handleOperator('/')}
                  className="h-14 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 text-xl font-black active:scale-95 transition-all"
                >
                  ÷
                </button>
              </div>

              {/* Row 2: 7, 8, 9, × */}
              <div className="grid grid-cols-4 gap-2">
                {['7', '8', '9'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(num)}
                    className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/80 text-white text-xl font-bold active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('*')}
                  className="h-14 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 text-xl font-black active:scale-95 transition-all"
                >
                  ×
                </button>
              </div>

              {/* Row 3: 4, 5, 6, − */}
              <div className="grid grid-cols-4 gap-2">
                {['4', '5', '6'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(num)}
                    className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/80 text-white text-xl font-bold active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('-')}
                  className="h-14 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 text-xl font-black active:scale-95 transition-all"
                >
                  −
                </button>
              </div>

              {/* Row 4: 1, 2, 3, + */}
              <div className="grid grid-cols-4 gap-2">
                {['1', '2', '3'].map((num) => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => handleDigit(num)}
                    className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/80 text-white text-xl font-bold active:scale-95 transition-all"
                  >
                    {num}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleOperator('+')}
                  className="h-14 rounded-2xl bg-indigo-600/30 hover:bg-indigo-600/50 border border-indigo-500/50 text-indigo-300 text-xl font-black active:scale-95 transition-all"
                >
                  +
                </button>
              </div>

              {/* Row 5: +/-, 0, ., = */}
              <div className="grid grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={handleToggleSign}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-slate-300 text-lg font-bold active:scale-95 transition-all"
                >
                  ±
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('0')}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-slate-700 border border-slate-700/80 text-white text-xl font-bold active:scale-95 transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleDigit('.')}
                  className="h-14 rounded-2xl bg-slate-800/80 hover:bg-slate-750 border border-slate-700 text-white text-xl font-bold active:scale-95 transition-all"
                >
                  .
                </button>
                <button
                  type="button"
                  onClick={handleEqual}
                  className="h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 border border-indigo-400 text-white text-2xl font-black shadow-lg shadow-indigo-600/30 active:scale-95 transition-all"
                >
                  =
                </button>
              </div>
            </div>

            {/* Quick Bill Split & Gratuity Bar */}
            <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-400">Quick Divisor & Tip:</span>
              <div className="flex flex-wrap gap-1.5">
                {[2, 3, 4].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => handleQuickDivide(n)}
                    className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold"
                  >
                    ÷ {n}
                  </button>
                ))}
                {[5, 10, 15].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => handleQuickTip(t)}
                    className="px-2 py-1 rounded-lg border border-slate-700 bg-slate-800/60 hover:bg-slate-700 text-amber-300 text-[11px] font-semibold"
                  >
                    +{t}% Tip
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Instant TrueSpend Action Hub & Tape */}
        <div className="lg:col-span-5 space-y-4">
          {/* Action Hub Card */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Send className="h-4 w-4 text-indigo-500" />
                Action Hub for Calculated Result
              </CardTitle>
              <CardDescription className="text-xs">
                Take immediate financial action on{' '}
                <strong className="text-gray-900 dark:text-gray-100">
                  {numericResult.toLocaleString()} MAD
                </strong>
                :
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Log as Expense / Income */}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  onClick={() => handleOpenQuickLog('Expense')}
                  disabled={numericResult <= 0}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs h-10 flex items-center gap-1.5"
                >
                  <ArrowUpRight className="h-4 w-4" />
                  Log as Expense
                </Button>

                <Button
                  size="sm"
                  onClick={() => handleOpenQuickLog('Income')}
                  disabled={numericResult <= 0}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-10 flex items-center gap-1.5"
                >
                  <ArrowDownRight className="h-4 w-4" />
                  Log as Income
                </Button>
              </div>

              {/* What-If Simulation Trigger */}
              <button
                type="button"
                onClick={handleTestInWhatIf}
                disabled={numericResult <= 0}
                className="w-full p-3 rounded-xl border border-sky-200 dark:border-sky-900/50 bg-sky-50/50 dark:bg-sky-950/20 hover:bg-sky-50 dark:hover:bg-sky-900/30 transition-all flex items-center justify-between text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-500 text-white text-xs font-bold">
                    🔮
                  </div>
                  <div>
                    <span className="text-xs font-bold text-sky-950 dark:text-sky-200 block">
                      Simulate Impact in What-If
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Preview runway & safe-to-spend changes
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-sky-600 shrink-0" />
              </button>

              {/* Send to Impulse Shield */}
              <button
                type="button"
                onClick={handleSendToImpulseShield}
                disabled={numericResult <= 0}
                className="w-full p-3 rounded-xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/50 dark:bg-indigo-950/20 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-all flex items-center justify-between text-left disabled:opacity-50"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white text-xs font-bold">
                    🛡️
                  </div>
                  <div>
                    <span className="text-xs font-bold text-indigo-950 dark:text-indigo-200 block">
                      Send to Impulse Shield Vault
                    </span>
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">
                      Set 24h-72h cooldown before buying
                    </span>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-indigo-600 shrink-0" />
              </button>
            </CardContent>
          </Card>

          {/* Audit Tape / History Card */}
          <Card className="border-slate-200 dark:border-slate-800">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <History className="h-4 w-4 text-slate-500" />
                  Calculation Tape & Notes
                </CardTitle>
                <CardDescription className="text-xs">
                  Review and reuse your previous calculations
                </CardDescription>
              </div>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => saveHistory([])}
                  className="text-xs text-rose-500 hover:text-rose-600"
                >
                  Clear Tape
                </button>
              )}
            </CardHeader>
            <CardContent>
              {history.length === 0 ? (
                <p className="text-xs text-gray-500 text-center py-6">
                  No calculations recorded yet. Use the keypad or physical keyboard to calculate!
                </p>
              ) : (
                <div className="space-y-2.5 max-h-80 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-800/40 space-y-1.5"
                    >
                      <div className="flex items-center justify-between text-[11px] text-gray-500">
                        <span className="font-mono text-gray-600 dark:text-gray-400 truncate max-w-[200px]">
                          {item.expression}
                        </span>
                        <span>{item.timestamp}</span>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-base font-black font-mono text-gray-900 dark:text-gray-100">
                          {item.result.toLocaleString()} MAD
                        </span>

                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              setDisplayValue(item.result.toString());
                              setIsNewCalculation(true);
                              showToast(`Loaded ${item.result} MAD into calculator`);
                            }}
                            className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                          >
                            Recall
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Transaction Logging Modal */}
      {showQuickLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <Card className="w-full max-w-md border-slate-200 dark:border-slate-800 shadow-2xl">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">
                  Log {quickLogType}: {numericResult.toLocaleString()} MAD
                </CardTitle>
                <CardDescription className="text-xs">
                  Quickly commit this calculated amount to your TrueSpend ledger.
                </CardDescription>
              </div>
              <button
                type="button"
                onClick={() => setShowQuickLogModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleExecuteQuickLog} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Select Wallet / Account
                  </label>
                  <Select
                    value={quickLogWalletId}
                    onChange={(e) => setQuickLogWalletId(e.target.value)}
                    className="text-xs"
                  >
                    {kpis?.accounts?.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.balance.toFixed(0)} MAD)
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Category
                  </label>
                  <Select
                    value={quickLogCategory}
                    onChange={(e) => setQuickLogCategory(e.target.value)}
                    className="text-xs"
                  >
                    {(quickLogType === 'Expense' ? expenseCategories : incomeAndTransferCategories).map(
                      (cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      )
                    )}
                  </Select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-700 dark:text-gray-300 block mb-1">
                    Notes / Description
                  </label>
                  <Input
                    type="text"
                    value={quickLogNotes}
                    onChange={(e) => setQuickLogNotes(e.target.value)}
                    placeholder="e.g. Lunch with team, Groceries..."
                    className="text-xs"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowQuickLogModal(false)}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmittingTx}
                    className="text-xs bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                  >
                    {isSubmittingTx ? 'Saving...' : `Confirm & Save ${quickLogType}`}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};
