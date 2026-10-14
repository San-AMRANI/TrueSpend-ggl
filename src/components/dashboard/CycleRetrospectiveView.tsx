import React, { useState, useEffect, useMemo, useRef } from 'react';
import { playBrowserSpeech } from '../../lib/speechEngine';
import {
  CycleRetrospectiveData,
  CyclePeriodSummary,
  RetrospectiveLetterGrade,
  DashboardTab,
} from '../../types';
import { dashboardService } from '../../services/api/dashboardService';
import { useAuth } from '../../context/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import {
  Award,
  Sparkles,
  TrendingUp,
  TrendingDown,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  RefreshCw,
  Printer,
  Copy,
  Check,
  Volume2,
  VolumeX,
  ShieldCheck,
  Zap,
  Target,
  ArrowUpRight,
  ArrowDownRight,
  PieChart,
  Sliders,
  DollarSign,
  Clock,
  Compass,
  FileText,
  Cpu,
} from 'lucide-react';

interface CycleRetrospectiveViewProps {
  onNavigateTab?: (tab: DashboardTab) => void;
  compact?: boolean;
}

const GRADE_COLORS: Record<RetrospectiveLetterGrade, { bg: string; text: string; border: string; glow: string }> = {
  'A+': { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'A': { bg: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' },
  'A-': { bg: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', text: 'text-teal-600 dark:text-teal-400', border: 'border-teal-500/30', glow: 'shadow-teal-500/20' },
  'B+': { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  'B': { bg: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
  'B-': { bg: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/30', glow: 'shadow-indigo-500/20' },
  'C+': { bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'C': { bg: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  'D': { bg: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
  'F': { bg: 'bg-rose-500/10 text-rose-600 dark:text-rose-400', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/30', glow: 'shadow-rose-500/20' },
};

export const CycleRetrospectiveView: React.FC<CycleRetrospectiveViewProps> = ({
  onNavigateTab,
  compact = false,
}) => {
  const { token } = useAuth();

  const [cycles, setCycles] = useState<CyclePeriodSummary[]>([]);
  const [selectedCycleId, setSelectedCycleId] = useState<string>('');
  const [retrospective, setRetrospective] = useState<CycleRetrospectiveData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Model selection
  const [selectedModel, setSelectedModel] = useState<string>('auto');
  const [showModelMenu, setShowModelMenu] = useState(false);

  // Audio & Copy state
  const [isSpeaking, setIsSpeaking] = useState(false);
  const stopSpeechRef = useRef<(() => void) | null>(null);
  const [copied, setCopied] = useState(false);

  // Active view tabs for detailed sections
  const [activeSection, setActiveSection] = useState<'verdict' | 'categories' | 'velocity' | 'allocations'>('verdict');

  // Load available financial periods on mount
  useEffect(() => {
    let isMounted = true;
    const fetchCycles = async () => {
      try {
        const periodList = await dashboardService.getCycles(token);
        if (!isMounted) return;
        setCycles(periodList);
        if (periodList.length > 0) {
          const current = periodList.find((c) => c.isCurrent) || periodList[0];
          setSelectedCycleId(current.id);
        }
      } catch (err: any) {
        if (isMounted) setError(err.message || 'Failed to load cycles');
      }
    };
    fetchCycles();
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Load retrospective whenever selectedCycleId or selectedModel changes
  useEffect(() => {
    if (!selectedCycleId) return;

    let isMounted = true;
    const fetchRetrospective = async (force = false) => {
      try {
        setLoading(true);
        setError(null);
        const data = await dashboardService.getCycleRetrospective(
          {
            cycleId: selectedCycleId,
            model: selectedModel,
            forceRefresh: force,
          },
          token
        );
        if (!isMounted) return;
        setRetrospective(data);
      } catch (err: any) {
        if (!isMounted) return;
        setError(err.message || 'Failed to generate cycle report card');
      } finally {
        if (isMounted) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };

    fetchRetrospective();
    return () => {
      isMounted = false;
      if (stopSpeechRef.current) {
        stopSpeechRef.current();
        stopSpeechRef.current = null;
      }
    };
  }, [selectedCycleId, token]);

  const handleRegenerate = async () => {
    if (!selectedCycleId || refreshing) return;
    try {
      setRefreshing(true);
      setError(null);
      const data = await dashboardService.generateCycleRetrospective(
        {
          cycleId: selectedCycleId,
          preferredModel: selectedModel,
          allowFallback: true,
          forceRefresh: true,
        },
        token
      );
      setRetrospective(data);
    } catch (err: any) {
      setError(err.message || 'Failed to re-generate AI analysis');
    } finally {
      setRefreshing(false);
    }
  };

  const handleCopySummary = () => {
    if (!retrospective) return;
    const text = `TrueSpend Cycle Report Card: ${retrospective.periodLabel}
Grade: ${retrospective.letterGrade} (${retrospective.score}/100)
Persona: ${retrospective.financialPersona.title} (${retrospective.financialPersona.trait})

Financial Metrics:
• Inflow: ${retrospective.totalInflow.toLocaleString()} MAD
• Outflow: ${retrospective.totalOutflow.toLocaleString()} MAD
• Net Saved: ${retrospective.netSavings.toLocaleString()} MAD (${retrospective.savingsRate}% savings rate)
• Daily Allowance: ${retrospective.dailyAllowance} MAD/day
• Days on track: ${retrospective.daysUnderAllowanceCount} / ${retrospective.elapsedDays} days

Verdict: ${retrospective.verdictTitle}

Top Wins:
${retrospective.biggestWins.map((w) => `✓ ${w}`).join('\n')}

Key Leaks:
${retrospective.financialLeaks.map((l) => `! ${l}`).join('\n')}

Golden Rule: ${retrospective.goldenRule}`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const handleToggleSpeech = () => {
    if (!retrospective || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    if (isSpeaking) {
      if (stopSpeechRef.current) {
        stopSpeechRef.current();
        stopSpeechRef.current = null;
      }
      setIsSpeaking(false);
      return;
    }

    const textToSpeak = `${retrospective.verdictTitle}. Here is your TrueSpend cycle wrap-up. ${retrospective.executiveSummary}. Your golden rule for next cycle is: ${retrospective.goldenRule}`;

    const stop = playBrowserSpeech(textToSpeak, {
      rate: 1.05,
      pitch: 1.0,
      onStart: () => setIsSpeaking(true),
      onEnd: () => {
        setIsSpeaking(false);
        stopSpeechRef.current = null;
      },
      onError: () => {
        setIsSpeaking(false);
        stopSpeechRef.current = null;
      },
    });

    stopSpeechRef.current = stop;
    setIsSpeaking(true);
  };

  const currentGradeStyle = retrospective ? (GRADE_COLORS[retrospective.letterGrade] || GRADE_COLORS['B']) : GRADE_COLORS['B'];

  if (loading && !retrospective) {
    return (
      <div className="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-8 text-center space-y-4">
        <div className="inline-flex p-4 rounded-2xl bg-indigo-500/10 text-indigo-500 animate-pulse">
          <Award className="w-10 h-10 animate-bounce" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Compiling Financial Cycle Report Card...
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md mx-auto">
          Auditing inflows, category budget compliance, daily spending velocity, and generating AI qualitative insights.
        </p>
        <div className="w-48 h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full mx-auto overflow-hidden">
          <div className="w-full h-full bg-indigo-500 rounded-full animate-indeterminate" />
        </div>
      </div>
    );
  }

  if (error && !retrospective) {
    return (
      <div className="rounded-2xl border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-6 text-center space-y-3">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto" />
        <h4 className="text-base font-semibold text-red-900 dark:text-red-300">Unable to generate retrospective</h4>
        <p className="text-sm text-red-700 dark:text-red-400 max-w-md mx-auto">{error}</p>
        <Button onClick={handleRegenerate} variant="outline" className="mt-2 text-sm">
          <RefreshCw className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  if (!retrospective) return null;

  return (
    <div className="space-y-6 print:m-0 print:p-0">
      {/* ── Top Controls Bar ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm print:hidden">
        {/* Cycle Selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <Calendar className="w-4 h-4 text-indigo-500 shrink-0" />
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            Cycle Period:
          </span>
          <div className="relative">
            <select
              value={selectedCycleId}
              onChange={(e) => setSelectedCycleId(e.target.value)}
              className="appearance-none bg-gray-50 dark:bg-gray-800 border border-gray-300 dark:border-gray-700 text-gray-900 dark:text-white text-xs font-medium rounded-lg pl-3 pr-8 py-1.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.isCurrent ? '⚡ Current Cycle: ' : '🏁 '} {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-2.5 pointer-events-none" />
          </div>

          {retrospective.isCurrentCycle ? (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              Active Cycle (Day {retrospective.elapsedDays} of {retrospective.totalDays})
            </span>
          ) : (
            <span className="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              Closed Payday Retrospective
            </span>
          )}
        </div>

        {/* Action Buttons & Model Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* AI Model Badge */}
          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 transition border border-gray-200 dark:border-gray-700"
              title="Change AI Model"
            >
              <Cpu className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                {selectedModel === 'auto'
                  ? 'Auto Smart Routing'
                  : selectedModel === 'gemini-3.8-flash'
                  ? 'Gemini 3.8 Flash'
                  : selectedModel === 'gemini-3.1-flash-lite'
                  ? '3.1 Flash Lite'
                  : 'Flash Latest'}
              </span>
              <ChevronDown className="w-3 h-3 text-gray-400" />
            </button>

            {showModelMenu && (
              <div className="absolute right-0 mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 p-1.5 z-20 text-xs">
                <div className="px-2 py-1 text-[10px] font-semibold text-gray-400 uppercase">
                  Select Routing Model
                </div>
                {[
                  { id: 'auto', label: 'Auto (Smart Fallback)', desc: 'Prioritizes deep analysis, fails over smoothly' },
                  { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', desc: 'Deep intelligence & reasoning' },
                  { id: 'gemini-3.1-flash-lite', label: 'Gemini 3.1 Flash Lite', desc: '500 calls/day high quota' },
                  { id: 'gemini-flash-latest', label: 'Gemini Flash Latest', desc: 'Standard production fallback' },
                ].map((m) => (
                  <button
                    key={m.id}
                    onClick={() => {
                      setSelectedModel(m.id);
                      setShowModelMenu(false);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-lg flex flex-col transition ${
                      selectedModel === m.id
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-semibold'
                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    <span>{m.label}</span>
                    <span className="text-[10px] text-gray-400">{m.desc}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Regenerate Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={refreshing}
            className="text-xs h-7 px-2.5"
            title="Recalculate and generate a fresh AI analysis"
          >
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Auditing...' : 'Regenerate'}
          </Button>

          {/* Audio Speech */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleToggleSpeech}
            className={`text-xs h-7 px-2.5 ${isSpeaking ? 'bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40' : ''}`}
            title="Listen to Executive Briefing"
          >
            {isSpeaking ? <VolumeX className="w-3.5 h-3.5 mr-1" /> : <Volume2 className="w-3.5 h-3.5 mr-1" />}
            {isSpeaking ? 'Stop' : 'Listen'}
          </Button>

          {/* Copy Summary */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopySummary}
            className="text-xs h-7 px-2.5"
            title="Copy Report Card to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 mr-1" />}
            {copied ? 'Copied' : 'Share'}
          </Button>

          {/* Print PDF */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrint}
            className="text-xs h-7 px-2.5"
            title="Print or export as PDF"
          >
            <Printer className="w-3.5 h-3.5 mr-1" />
            Print
          </Button>
        </div>
      </div>

      {/* ── Official TrueSpend Report Card Hero ───────────────────────── */}
      <div className="relative overflow-hidden rounded-3xl border border-gray-200 dark:border-gray-800 bg-gradient-to-br from-gray-900 via-gray-900 to-indigo-950 text-white p-6 sm:p-8 shadow-xl">
        {/* Background Decorative Rings */}
        <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
        <div className="absolute -left-16 -bottom-16 w-64 h-64 rounded-full bg-emerald-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Left: Persona, Title, and Verdict */}
          <div className="space-y-3 max-w-2xl">
            {/* Header Tags */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-white/10 backdrop-blur-md border border-white/15 text-indigo-200">
                <Award className="w-3.5 h-3.5 text-amber-400" />
                TrueSpend Financial Operating System
              </span>

              <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <Sparkles className="w-3 h-3" />
                {retrospective.financialPersona.icon} {retrospective.financialPersona.title}
              </span>

              <span className="text-xs text-gray-400">
                • {retrospective.periodLabel}
              </span>
            </div>

            {/* Verdict Headline */}
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-tight">
              {retrospective.verdictTitle}
            </h2>

            {/* Persona Description */}
            <p className="text-sm text-gray-300 leading-relaxed">
              {retrospective.financialPersona.description}{' '}
              <span className="text-indigo-300 font-medium">({retrospective.financialPersona.trait})</span>
            </p>

            {/* Engine Subtitle */}
            <div className="flex items-center gap-3 pt-1 text-xs text-gray-400">
              <span className="flex items-center gap-1">
                <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                {retrospective.modelUsed}
              </span>
              <span>•</span>
              <span>Audited on {new Date(retrospective.generatedAt).toLocaleDateString()}</span>
            </div>
          </div>

          {/* Right: The Letter Grade Seal & Performance Score Gauge */}
          <div className="flex sm:flex-col items-center justify-center sm:items-end gap-4 shrink-0">
            {/* Academic Letter Grade Stamp */}
            <div className="relative flex flex-col items-center justify-center w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-white/10 dark:bg-gray-800/60 backdrop-blur-xl border-2 border-indigo-500/40 shadow-2xl p-3 text-center">
              <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-300">
                Grade
              </span>
              <span className={`text-4xl sm:text-5xl font-black tracking-tight ${currentGradeStyle.text}`}>
                {retrospective.letterGrade}
              </span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="text-xs font-bold text-white">{retrospective.score}</span>
                <span className="text-[10px] text-gray-400">/ 100</span>
              </div>
            </div>

            {/* Score interpretation badge */}
            <div className="text-right">
              <span className="text-xs text-gray-300">
                {retrospective.score >= 85
                  ? '🌟 Outstanding Discipline'
                  : retrospective.score >= 70
                  ? '🛡️ Strong Performance'
                  : retrospective.score >= 55
                  ? '⚖️ Stable & Controlled'
                  : '⚠️ Action Required'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Key Figures Scorecard Grid ──────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3 sm:gap-4">
        {/* Total Inflow */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Total Inflow</span>
              <ArrowDownRight className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {retrospective.totalInflow.toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-500">MAD</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Salary + logged deposits</p>
          </CardContent>
        </Card>

        {/* Total Outflow */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>True Spend</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {retrospective.totalOutflow.toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-500">MAD</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Net economic consumption</p>
          </CardContent>
        </Card>

        {/* Net Savings Surplus */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Net Surplus</span>
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className={`text-lg sm:text-xl font-bold truncate ${
              retrospective.netSavings >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {retrospective.netSavings >= 0 ? '+' : ''}
              {retrospective.netSavings.toLocaleString()}{' '}
              <span className="text-xs font-normal text-gray-500">MAD</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Capital added to reserves</p>
          </CardContent>
        </Card>

        {/* Savings Rate */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Savings Rate</span>
              <TrendingUp className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {retrospective.savingsRate}%
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {retrospective.savingsRate >= 20 ? 'Target ≥20% Met 🎯' : 'Target: 20%'}
            </p>
          </CardContent>
        </Card>

        {/* Daily Allowance vs Avg Daily Spend */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Daily Pace</span>
              <Clock className="w-3.5 h-3.5 text-indigo-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {retrospective.avgDailySpend}{' '}
              <span className="text-xs font-normal text-gray-500">MAD/d</span>
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Target allowance: {retrospective.dailyAllowance} MAD
            </p>
          </CardContent>
        </Card>

        {/* Daily Discipline Ratio */}
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardContent className="p-4 space-y-1">
            <div className="flex items-center justify-between text-gray-500 dark:text-gray-400 text-xs font-medium">
              <span>Discipline</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            </div>
            <div className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {retrospective.daysUnderAllowanceCount} / {retrospective.elapsedDays}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              {Math.round((retrospective.daysUnderAllowanceCount / Math.max(1, retrospective.elapsedDays)) * 100)}% days on track
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Sub-Navigation Sections ───────────────────────────────────── */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-800 pb-2 print:hidden overflow-x-auto">
        <button
          onClick={() => setActiveSection('verdict')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
            activeSection === 'verdict'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          ✨ AI Verdict & Wins/Leaks
        </button>
        <button
          onClick={() => setActiveSection('allocations')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
            activeSection === 'allocations'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          💰 Payday Action Plan
        </button>
        <button
          onClick={() => setActiveSection('categories')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
            activeSection === 'categories'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          📊 Category Report Card ({retrospective.categories.length})
        </button>
        <button
          onClick={() => setActiveSection('velocity')}
          className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition whitespace-nowrap ${
            activeSection === 'velocity'
              ? 'bg-indigo-600 text-white shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
        >
          📈 Daily Velocity Timeline
        </button>
      </div>

      {/* ── SECTION: AI Verdict, Wins, Leaks & Golden Rule ────────────── */}
      {(activeSection === 'verdict' || compact) && (
        <div className="space-y-6">
          {/* Executive Summary */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Executive Audit Narrative
                </CardTitle>
                <span className="text-xs text-gray-400">
                  TrueSpend Intelligence Retrospective
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-line">
                {retrospective.executiveSummary}
              </p>
            </CardContent>
          </Card>

          {/* Wins & Leaks Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Wins Card */}
            <Card className="border-emerald-500/20 bg-emerald-50/30 dark:bg-emerald-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-emerald-800 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  Financial Victories & Wins (The High Points)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {retrospective.biggestWins.map((win, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/60 border border-emerald-500/20 text-xs text-gray-800 dark:text-gray-200"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500 text-white font-bold text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{win}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Leaks Card */}
            <Card className="border-rose-500/20 bg-rose-50/30 dark:bg-rose-950/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-bold text-rose-800 dark:text-rose-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400" />
                  Spending Friction Points & Leaks (The Drain)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {retrospective.financialLeaks.map((leak, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl bg-white/80 dark:bg-gray-900/60 border border-rose-500/20 text-xs text-gray-800 dark:text-gray-200"
                  >
                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white font-bold text-[10px] shrink-0 mt-0.5">
                      {idx + 1}
                    </span>
                    <span className="leading-snug">{leak}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Golden Rule Banner */}
          <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent p-4 sm:p-5 flex items-start gap-3.5">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                Single Golden Rule for Next Cycle
              </span>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-snug">
                "{retrospective.goldenRule}"
              </p>
            </div>
          </div>

          {/* Macro 50/30/20 Split */}
          <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-500" />
                  Realized Macro Split (50/30/20 Benchmark)
                </CardTitle>
                <span className="text-xs text-gray-400">Needs vs Wants vs Savings</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Stacked Progress Bar */}
              <div className="w-full h-4 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden flex">
                <div
                  style={{ width: `${retrospective.macroSplit.needs.percent}%` }}
                  className="bg-blue-500 h-full transition-all duration-300"
                  title={`Needs: ${retrospective.macroSplit.needs.percent}%`}
                />
                <div
                  style={{ width: `${retrospective.macroSplit.wants.percent}%` }}
                  className="bg-amber-500 h-full transition-all duration-300"
                  title={`Wants: ${retrospective.macroSplit.wants.percent}%`}
                />
                <div
                  style={{ width: `${retrospective.macroSplit.savings.percent}%` }}
                  className="bg-emerald-500 h-full transition-all duration-300"
                  title={`Savings & Investments: ${retrospective.macroSplit.savings.percent}%`}
                />
              </div>

              {/* Legend & Breakdown */}
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500" /> Needs
                  </div>
                  <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {retrospective.macroSplit.needs.percent}%
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {retrospective.macroSplit.needs.amount.toLocaleString()} MAD (Goal: 50%)
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    <span className="w-2 h-2 rounded-full bg-amber-500" /> Wants
                  </div>
                  <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {retrospective.macroSplit.wants.percent}%
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {retrospective.macroSplit.wants.amount.toLocaleString()} MAD (Goal: 30%)
                  </div>
                </div>

                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" /> Savings & Debt
                  </div>
                  <div className="text-base font-bold text-gray-900 dark:text-white mt-0.5">
                    {retrospective.macroSplit.savings.percent}%
                  </div>
                  <div className="text-[11px] text-gray-500 dark:text-gray-400">
                    {retrospective.macroSplit.savings.amount.toLocaleString()} MAD (Goal: 20%)
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── SECTION: Payday Action Plan / Allocations ─────────────────── */}
      {activeSection === 'allocations' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Target className="w-4 h-4 text-indigo-500" />
                Payday Capital Allocations (Next Cycle Setup)
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recommended immediate routing when your salary deposit lands in your bank account
              </p>
            </div>
            {onNavigateTab && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onNavigateTab('budgets')}
                className="text-xs"
              >
                Configure Budgets
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {retrospective.paydayAllocations.map((alloc, idx) => (
              <Card key={idx} className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 flex flex-col justify-between shadow-sm">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-500">
                      Bucket #{idx + 1}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-300 font-semibold">
                      {alloc.bucket}
                    </span>
                  </div>
                  <CardTitle className="text-lg font-bold text-gray-900 dark:text-white mt-1">
                    {alloc.recommendedAmount > 0 ? `${alloc.recommendedAmount.toLocaleString()} MAD` : 'Calibrated'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
                  <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                    {alloc.rationale}
                  </p>
                  <div className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 text-xs font-medium text-gray-900 dark:text-white flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{alloc.actionableStep}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── SECTION: Category Matrix Report Card ─────────────────────── */}
      {activeSection === 'categories' && (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-gray-100 dark:border-gray-800">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-500" />
                Category Performance Matrix & Letter Grades
              </CardTitle>
              <span className="text-xs text-gray-400">
                Sorted by highest spend
              </span>
            </div>
          </CardHeader>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400 font-semibold">
                <tr>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Actual Spent</th>
                  <th className="py-2.5 px-4 text-right">Planned Budget</th>
                  <th className="py-2.5 px-4 text-right">Difference</th>
                  <th className="py-2.5 px-4 text-center">% Used</th>
                  <th className="py-2.5 px-4 text-center">Grade</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-700 dark:text-gray-300">
                {retrospective.categories.map((cat, idx) => {
                  const gradeBadge = GRADE_COLORS[cat.grade] || GRADE_COLORS['B'];
                  return (
                    <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition">
                      <td className="py-3 px-4 font-medium text-gray-900 dark:text-white flex items-center gap-2">
                        <span>{cat.category}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {cat.actual.toLocaleString()} MAD
                      </td>
                      <td className="py-3 px-4 text-right text-gray-500">
                        {cat.budget > 0 ? `${cat.budget.toLocaleString()} MAD` : '—'}
                      </td>
                      <td className={`py-3 px-4 text-right font-medium ${
                        cat.difference >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                      }`}>
                        {cat.budget > 0 ? `${cat.difference >= 0 ? '+' : ''}${cat.difference.toLocaleString()} MAD` : '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="w-16 bg-gray-200 dark:bg-gray-700 h-1.5 rounded-full overflow-hidden">
                            <div
                              className={`h-full ${
                                cat.percentUsed > 100 ? 'bg-rose-500' : cat.percentUsed > 80 ? 'bg-amber-500' : 'bg-emerald-500'
                              }`}
                              style={{ width: `${Math.min(100, cat.percentUsed)}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-bold text-gray-700 dark:text-gray-300">
                            {cat.percentUsed}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-md font-extrabold text-xs border ${gradeBadge.bg} ${gradeBadge.border}`}>
                          {cat.grade}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                          cat.status === 'under'
                            ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                            : cat.status === 'on_track'
                            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400'
                            : cat.status === 'warning'
                            ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400'
                        }`}>
                          {cat.status === 'under' ? 'Under Budget' : cat.status === 'on_track' ? 'On Track' : cat.status === 'warning' ? 'Near Limit' : 'Over Limit'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── SECTION: Daily Velocity Timeline ─────────────────────────── */}
      {activeSection === 'velocity' && (
        <Card className="bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 shadow-sm">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-4 h-4 text-indigo-500" />
                Daily Velocity Progression across {retrospective.elapsedDays} Days
              </CardTitle>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Daily Allowance Ceiling: {retrospective.dailyAllowance} MAD/day
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Visual Bar Map */}
            <div className="grid grid-cols-7 sm:grid-cols-10 md:grid-cols-15 gap-1.5 pt-2">
              {retrospective.dailyVelocity.map((day) => (
                <div
                  key={day.dayNumber}
                  className={`p-2 rounded-xl border flex flex-col items-center justify-between text-center transition ${
                    day.isUnderBudget
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-800 dark:text-emerald-300'
                      : 'bg-rose-500/10 border-rose-500/20 text-rose-800 dark:text-rose-300'
                  }`}
                  title={`Day ${day.dayNumber} (${day.date}): ${day.spent} MAD spent (Allowance: ${day.allowance} MAD)`}
                >
                  <span className="text-[10px] font-bold text-gray-500">D{day.dayNumber}</span>
                  <span className="text-xs font-extrabold mt-1 truncate">
                    {Math.round(day.spent)}
                  </span>
                  <span className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5">
                    {day.dayOfWeek}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-emerald-500/30 border border-emerald-500/50" />
                <span>Under Daily Allowance ({retrospective.daysUnderAllowanceCount} days)</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-md bg-rose-500/30 border border-rose-500/50" />
                <span>Burst / Over Allowance ({retrospective.daysOverAllowanceCount} days)</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Comparison vs Prior Cycle (if present) ──────────────────── */}
      {retrospective.comparison && (
        <Card className="bg-gradient-to-r from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900/90 dark:to-gray-900 border border-gray-200 dark:border-gray-800">
          <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500 shrink-0">
                <Sliders className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-semibold text-gray-900 dark:text-white">
                  Trajectory vs Prior Cycle ({retrospective.comparison.previousPeriodLabel})
                </span>
                <p className="text-[11px] text-gray-500">Tracking cycle-over-cycle financial compounding</p>
              </div>
            </div>

            <div className="flex items-center gap-4 text-xs font-semibold">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Expenses:</span>
                <span className={retrospective.comparison.expensesChangePercent <= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {retrospective.comparison.expensesChangePercent > 0 ? '+' : ''}
                  {retrospective.comparison.expensesChangePercent}%
                </span>
              </div>

              <div className="flex items-center gap-1">
                <span className="text-gray-500">Savings:</span>
                <span className={retrospective.comparison.savingsChangePercent >= 0 ? 'text-emerald-500' : 'text-rose-500'}>
                  {retrospective.comparison.savingsChangePercent > 0 ? '+' : ''}
                  {retrospective.comparison.savingsChangePercent}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
