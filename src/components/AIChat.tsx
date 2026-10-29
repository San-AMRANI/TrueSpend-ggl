import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  Send,
  Loader2,
  Trash2,
  Mic,
  MicOff,
  Copy,
  Check,
  ChevronDown,
  Sparkles,
  Menu,
  Camera,
  X,
  Volume2,
  VolumeX,
  Download,
  CheckCheck,
  TrendingUp,
  ShieldCheck,
  Zap,
  Cpu,
  Settings2,
  RefreshCw,
  ExternalLink,
  Info,
  Award,
  Layers,
  Wallet as WalletIcon,
  ArrowRightLeft,
  Target,
  Users,
  SlidersHorizontal,
  MessageSquare,
  Plus,
  Pin,
  Edit2,
  Search,
  FolderOpen,
} from 'lucide-react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { SpexAvatar } from './common/SpexAvatar';
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useDashboardData } from '../hooks/useDashboardData';
import {
  buildAiContextSnapshot,
  type AiDataFocusScope,
  type AiResponseDepth,
} from '../lib/aiContext';
import { playAudioBlob, playBrowserSpeech } from '../lib/speechEngine';

/**
 * Ensures Markdown tables have a blank line before the header row and valid GFM separator rows
 * so react-markdown + remark-gfm parses AI-generated tables reliably even when adjacent to text.
 */
function normalizeMarkdownTables(raw: string): string {
  if (!raw) return '';
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    const nextTrimmed = i + 1 < lines.length ? lines[i + 1].trim() : '';

    const looksLikeTableRow =
      trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.split('|').length >= 3;
    const nextLooksLikeSeparator =
      nextTrimmed.startsWith('|') &&
      nextTrimmed.endsWith('|') &&
      /^\|[\s:|-]+\|$/.test(nextTrimmed) &&
      nextTrimmed.includes('-');

    if (looksLikeTableRow && nextLooksLikeSeparator && out.length > 0) {
      const prevTrimmed = out[out.length - 1].trim();
      if (prevTrimmed !== '' && !prevTrimmed.startsWith('|')) {
        out.push('');
      }
    }

    out.push(line);
  }

  return out.join('\n');
}

const MARKDOWN_COMPONENTS = {
  table: ({ children, ...props }: any) => (
    <div className="my-3 w-full overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700 bg-white/95 dark:bg-gray-900/90 shadow-2xs">
      <table className="w-full border-collapse text-left text-xs sm:text-sm" {...props}>
        {children}
      </table>
    </div>
  ),
  thead: ({ children, ...props }: any) => (
    <thead
      className="bg-gray-100/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700"
      {...props}
    >
      {children}
    </thead>
  ),
  tbody: ({ children, ...props }: any) => (
    <tbody className="divide-y divide-gray-100 dark:divide-gray-800" {...props}>
      {children}
    </tbody>
  ),
  tr: ({ children, ...props }: any) => (
    <tr className="hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors" {...props}>
      {children}
    </tr>
  ),
  th: ({ children, ...props }: any) => (
    <th
      className="px-3.5 py-2.5 font-semibold text-xs uppercase tracking-wider text-gray-600 dark:text-gray-300 whitespace-nowrap"
      {...props}
    >
      {children}
    </th>
  ),
  td: ({ children, ...props }: any) => (
    <td className="px-3.5 py-2.5 text-gray-800 dark:text-gray-200 align-top" {...props}>
      {children}
    </td>
  ),
};

const CHAT_SESSION_STORAGE_KEY = 'truespend_chat_session';

export interface FocusScopeDefinition {
  id: AiDataFocusScope;
  label: string;
  shortLabel: string;
  description: string;
  icon: React.FC<{ className?: string }>;
  prompts: string[];
}

export const DATA_FOCUS_SCOPES: FocusScopeDefinition[] = [
  {
    id: 'all',
    label: 'All Data (360° Full Context)',
    shortLabel: 'All at Once',
    description:
      'Complete visibility across Investments & Binance, All Transactions, Wallets, Budgets, Debts, Goals & Forecast simultaneously.',
    icon: Layers,
    prompts: [
      '🌐 Run a deep 360° executive audit across my Wallets, Transactions, Budgets & Live Binance Portfolio',
      '📈 How do my Binance & Stock investments interact with my Safe-to-Spend liquidity and 879 MAD reserve?',
      '💡 Give me 4 creative, high-impact strategies to optimize both my cash burn and investment portfolio this cycle',
    ],
  },
  {
    id: 'investments',
    label: 'Investments, Binance & Stocks',
    shortLabel: 'Stocks & Binance',
    description:
      'Deep focus on Live Binance Spot/Funding/Earn, $879 MAD Capital Reserve P&L reconciliation, trade fee drag, breakeven prices & dividends.',
    icon: TrendingUp,
    prompts: [
      '📈 Reconcile my 879 MAD Investment Reserve against my live Binance position ($USD & MAD) and explain every dirham of gain/loss',
      '💸 Forensic breakdown of all my positions: entry fees, exit fees, total loss on fees, exact breakeven prices & open-lot P&L',
      '🏆 Analyze my stocks & crypto holdings, dividend yield / 5-year DRIP projections, and propose a smart recovery & allocation plan',
    ],
  },
  {
    id: 'transactions',
    label: 'All Transactions & Ledger',
    shortLabel: 'Transactions',
    description:
      'Deep focus on your complete transaction history, category burn rates, recurring merchants, spending leaks & cash-flow trends.',
    icon: ArrowRightLeft,
    prompts: [
      '💳 Deep-dive into all my transactions: identify my top spending categories, merchant patterns, and hidden leaks',
      '📊 Compare my current financial cycle spending pace against previous cycles and highlight anomalies',
      '🔍 Which expenses gave me the lowest value this cycle and how much Safe-to-Spend can I reclaim?',
    ],
  },
  {
    id: 'wallets',
    label: 'Wallets & Safe-to-Spend',
    shortLabel: 'Wallets',
    description:
      'Deep focus on Bank, Cash, Savings & Investment wallets, Safe-to-Spend waterfall math, emergency buffer & capital flows.',
    icon: WalletIcon,
    prompts: [
      '🏦 Audit all my Wallets (Bank, Cash, Savings, Investment) and walk through my exact Safe-to-Spend waterfall math',
      '🔄 Analyze my capital transfers between Bank and Investment wallets and recommend optimal liquidity balancing',
      '🛡️ Is my Emergency Buffer and Daily Allowance properly distributed across my active accounts?',
    ],
  },
  {
    id: 'budgets',
    label: 'Budgets & Category Caps',
    shortLabel: 'Budgets',
    description:
      'Deep focus on category budget limits, ideal vs. actual burn pace, 50/30/20 macro split & overspend prevention.',
    icon: Target,
    prompts: [
      '🎯 Audit all my category budgets: which categories are on pace, warning, or at risk of exhaustion before payday?',
      '⚖️ Analyze my Needs / Wants / Savings macro split against the 50/30/20 benchmark and suggest exact budget adjustments',
      '💡 Propose an optimized budget plan for the rest of this financial cycle based on my real spending habits',
    ],
  },
  {
    id: 'debts_goals',
    label: 'Debts, Goals & Subscriptions',
    shortLabel: 'Debts & Goals',
    description:
      'Deep focus on Payable/Receivable debts, savings goals progress, and recurring monthly subscription burn.',
    icon: Users,
    prompts: [
      '🤝 Review all my Payable & Receivable debts, active Subscriptions, and Savings Goals with a prioritized payoff/funding plan',
      '🔁 Audit my recurring subscriptions and fixed obligations: how much monthly burn can I optimize?',
      '🎯 How fast can I hit my savings goals while keeping my daily allowance comfortable?',
    ],
  },
  {
    id: 'forecast',
    label: 'Forecast & Cycle Report Card',
    shortLabel: 'Forecast & Grade',
    description:
      'Deep focus on 90-day & 12-month net worth projections, survival runway, What-If simulations & Cycle Report Card grade.',
    icon: Award,
    prompts: [
      '🎓 Give me my complete Financial Cycle Report Card, letter grade, top wins, top leaks & payday capital allocation plan',
      '🔮 Project my Net Worth, Liquidity & Investment Portfolio over the next 90 days and 12 months',
      '⚡ Simulate: What if I invest 500 MAD more each payday while cutting 15% of variable dining/shopping spend?',
    ],
  },
];

export const RESPONSE_DEPTH_OPTIONS: {
  id: AiResponseDepth;
  label: string;
  shortLabel: string;
  badge: string;
  description: string;
}[] = [
  {
    id: 'deep_creative',
    label: 'Deep & Creative (Max Output)',
    shortLabel: 'Deep & Creative',
    badge: '8K Tokens • Rich Tables',
    description:
      'Expansive, multi-section executive analysis with full forensic math, Markdown tables, and creative wealth strategies.',
  },
  {
    id: 'balanced',
    label: 'Balanced CFO',
    shortLabel: 'Balanced',
    badge: 'Standard Depth',
    description:
      'Structured breakdown with clear tables, key metrics, and actionable next steps.',
  },
  {
    id: 'concise',
    label: 'Concise & Fast',
    shortLabel: 'Concise',
    badge: 'Quick Summary',
    description:
      'Compact bullet points focused strictly on immediate numbers and quick answers.',
  },
];

const PROMPT_TOPICS = [
  {
    id: 'stocks',
    label: 'Stocks & Binance',
    icon: TrendingUp,
    prompts: [
      '📈 Reconcile my 879 MAD Investment Reserve vs live Binance balance & explain my net gain/loss',
      '💸 Show fees, loss on fees, breakeven price & open-lot P&L for every position and trade',
      '🏆 Analyze my stocks, dividends & 5-year DRIP compounding + suggest creative portfolio moves',
    ],
  },
  {
    id: 'audit',
    label: '360° Full Audit',
    icon: ShieldCheck,
    prompts: [
      '🌐 Run a complete 360° audit across Wallets, Transactions, Budgets & Live Investments',
      '📈 Calculate my current Safe-to-Spend waterfall, runway, and net worth',
      '💡 Where are my biggest spending leaks and wealth opportunities this cycle?',
    ],
  },
  {
    id: 'daily',
    label: 'Daily Burn & Wallets',
    icon: Zap,
    prompts: [
      '💰 What can I safely spend today and how are my wallets balanced?',
      '💳 Deep-dive into all my recent transactions and category burn rates',
      '📅 How many days left until payday and how is my pace tracking?',
    ],
  },
  {
    id: 'retrospective',
    label: 'Report Card',
    icon: Award,
    prompts: [
      '🎓 Give me my financial cycle report card, letter grade & archetype',
      '🏆 What were my biggest wins and spending leaks this cycle?',
      '💰 Recommend my next payday capital allocations across Savings & Stocks',
    ],
  },
  {
    id: 'whatif',
    label: 'What-If Simulator',
    icon: Sparkles,
    prompts: [
      '🔮 What if I make an unplanned 800 MAD purchase today?',
      '📈 What if I allocate 600 MAD from Safe-to-Spend into dividend stocks?',
      '🎯 What if I boost my savings goal by 500 MAD and trim dining by 20%?',
    ],
  },
  {
    id: 'receipt',
    label: 'Receipts & Multi-Log',
    icon: Camera,
    prompts: [
      '🧾 I have a receipt to scan and log',
      '☕ Log coffee: 30 MAD Cash at Starbucks',
      '🛒 Log groceries: 450 MAD Bank at Marjane',
    ],
  },
];

const FALLBACK_SUGGESTIONS = [
  '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
  '🌐 Run a complete 360° audit across all my data',
  '💳 Analyze all my transactions and spending categories',
];

export interface ModelOption {
  id: string;
  name: string;
  shortName: string;
  badge: string;
  quotaSummary: string;
  description: string;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'auto',
    name: 'Auto (Smart Fallback)',
    shortName: 'Smart Auto',
    badge: 'Recommended',
    quotaSummary: 'Dynamic • Auto failover',
    description:
      'Prioritizes high-speed Gemini 3 Flash and auto-cascades to Gemini 3.8 Flash & Flash Lite with local engine failover.',
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash',
    shortName: '3 Flash',
    badge: 'High Availability',
    quotaSummary: '500 req/day (Free Tier)',
    description:
      'Ultra-responsive, high-capacity model with exceptional resilience during peak traffic and demand spikes.',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    shortName: '3.8 Flash',
    badge: 'Deep Intelligence',
    quotaSummary: '20 req/day (Free Tier)',
    description:
      'Deep financial reasoning, stock forensics, scenario forecasting, and high accuracy receipt parsing.',
  },
  {
    id: 'gemini-3.1-flash-lite-preview',
    name: 'Gemini 3.1 Flash Lite',
    shortName: '3.1 Flash Lite',
    badge: '500 req/day',
    quotaSummary: '500 req/day (Free Tier)',
    description:
      'Massive daily free quota, ultra-low latency, optimal for high-frequency day-to-day transaction logging.',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    shortName: 'Flash Latest',
    badge: 'Standard Stable',
    quotaSummary: '20 req/day (Free Tier)',
    description:
      'Production stable release fallback for high reliability and general finance management.',
  },
];

export interface ModelStatusInfo {
  id: string;
  name: string;
  badge: string;
  dailyQuota: number | string;
  rpm: number;
  description: string;
  recommendedFor: string;
  isAvailable: boolean;
  isExhausted: boolean;
  cooldownRemainingSeconds: number;
}

function getChatSessionId() {
  const existing = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
  if (existing && /^[A-Za-z0-9_-]{1,128}$/.test(existing)) return existing;

  const sessionId = crypto.randomUUID().replace(/-/g, '_');
  localStorage.setItem(CHAT_SESSION_STORAGE_KEY, sessionId);
  return sessionId;
}

function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

interface AiAction {
  type: string;
  summary: string;
  parameters: Record<string, unknown>;
}

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  imageUrl?: string;
  modelUsed?: string;
  requestedModel?: string;
  responseTimeMs?: number;
  quotaFallback?: boolean;
  fallbackReason?: string;
  focusScopesUsed?: AiDataFocusScope[];
  responseDepthUsed?: AiResponseDepth;
  actions?: AiAction[];
  actionStatus?: 'approved' | 'rejected';
  suggestions?: string[];
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  focusScopes: AiDataFocusScope[];
  responseDepth: AiResponseDepth;
  pinned?: boolean;
  messages: Message[];
}

const CONVERSATIONS_STORAGE_KEY = 'truespend_chat_conversations_v1';
const ACTIVE_CONVERSATION_STORAGE_KEY = 'truespend_active_conversation_id';

function createDefaultWelcomeMessage(focusScopes: AiDataFocusScope[] = ['all']): Message {
  const primaryScope =
    DATA_FOCUS_SCOPES.find((s) => s.id === focusScopes[0]) || DATA_FOCUS_SCOPES[0];
  return {
    role: 'assistant',
    content:
      "Hey there! 👋 I'm **Spex**, your TrueSpend 360° financial & investment strategist powered by **Google Gemini**.\n\nI have deep, real-time visibility into your **Live Binance Multi-Wallet (Spot, Funding Stocks & Earn)**, **$879 MAD Investment Capital Reconciliation**, **trade fee & breakeven forensics**, **all transactions**, **wallets**, **budgets**, **debts**, and **goals**.\n\n🎯 **Pro Tip:** Use **Conversations** to organize separate threads (e.g., *Binance & Stocks*, *Monthly Budget Audit*, *Debt & Split Planning*) and select your **Context Focus** above!",
    timestamp: Date.now(),
    suggestions: primaryScope.prompts,
  };
}

function deriveConversationTitle(messages: Message[], fallback = 'New Financial Thread'): string {
  const firstUserMsg = messages.find((m) => m.role === 'user' && m.content.trim().length > 0);
  if (!firstUserMsg) return fallback;
  const cleaned = firstUserMsg.content
    .replace(/^[^\w\d$€£]+/, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return fallback;
  return cleaned.length > 44 ? `${cleaned.slice(0, 42)}…` : cleaned;
}

interface AIChatProps {
  onDataChange?: () => void;
}

// Animated typing dots
function TypingDots() {
  return (
    <div className="flex items-center gap-1.5 py-1">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-2 w-2 rounded-full bg-indigo-400 dark:bg-indigo-500 opacity-60"
          style={{ animation: `typingBounce 1.2s ease-in-out ${i * 0.18}s infinite` }}
        />
      ))}
    </div>
  );
}

// Single message bubble
function MessageBubble({
  msg,
  idx,
  onAction,
  onSpeak,
  isPlayingAudio,
  isAudioLoading,
}: {
  msg: Message;
  idx: number;
  onAction: (index: number, approve: boolean) => void;
  onSpeak?: (text: string, index: number) => void;
  isPlayingAudio?: boolean;
  isAudioLoading?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [relTime, setRelTime] = useState(() => formatRelativeTime(msg.timestamp));
  const isUser = msg.role === 'user';

  useEffect(() => {
    const id = setInterval(() => setRelTime(formatRelativeTime(msg.timestamp)), 30_000);
    return () => clearInterval(id);
  }, [msg.timestamp]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(msg.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  }, [msg.content]);

  return (
    <div
      className={cn(
        'group flex flex-col gap-1 w-full',
        isUser ? 'items-end' : 'items-start',
        'animate-slideIn',
      )}
      style={{ animationDelay: `${idx * 0.02}s`, animationFillMode: 'both' }}
    >
      {/* Avatar row for assistant */}
      {!isUser && (
        <div className="flex items-center gap-1.5 sm:gap-2 ml-0.5 mb-0.5 flex-wrap">
          <SpexAvatar className="h-5 w-5 sm:h-6 sm:w-6" />
          <span className="text-[11px] text-gray-700 dark:text-gray-200 font-semibold">Spex</span>
          {msg.modelUsed ? (
            <span
              className={cn(
                'text-[9px] font-mono px-1.5 py-0.5 rounded-md border flex items-center gap-1 shadow-2xs',
                msg.quotaFallback
                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/40'
                  : 'bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-900/40',
              )}
              title={msg.fallbackReason || `Generated by ${msg.modelUsed}`}
            >
              {msg.quotaFallback ? '🔄 ' : '⚡ '}
              {msg.modelUsed.replace('gemini-', '')}
            </span>
          ) : null}
          {msg.focusScopesUsed && msg.focusScopesUsed.length > 0 && (
            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/50 truncate max-w-[140px] sm:max-w-none">
              🎯{' '}
              {msg.focusScopesUsed.includes('all')
                ? '360° All'
                : msg.focusScopesUsed
                    .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                    .join(' + ')}
            </span>
          )}
          {msg.responseTimeMs ? (
            <span className="hidden sm:inline text-[9px] text-gray-400 dark:text-gray-500 font-mono">
              {(msg.responseTimeMs / 1000).toFixed(1)}s
            </span>
          ) : null}
          {msg.quotaFallback && (
            <span
              className="hidden sm:inline text-[8px] font-medium text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-1 py-0.2 rounded"
              title={msg.fallbackReason}
            >
              Auto Failover
            </span>
          )}
        </div>
      )}

      <div
        className={cn(
          'flex gap-2',
          isUser
            ? 'flex-row-reverse max-w-[85%] sm:max-w-[65%] lg:max-w-[55%]'
            : 'flex-row w-full max-w-full',
        )}
      >
        <div
          className={cn(
            'relative rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5 shadow-sm text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 dark:bg-indigo-700 text-white rounded-br-none'
              : 'w-full bg-white/95 dark:bg-gray-800/95 backdrop-blur-[2px] text-gray-800 dark:text-gray-100 border border-gray-200/80 dark:border-gray-700/70 rounded-bl-none',
          )}
        >
          {msg.imageUrl && (
            <div className="mb-2.5 overflow-hidden rounded-xl border border-white/20 bg-black/10">
              <img
                src={msg.imageUrl}
                alt="Uploaded receipt or document"
                className="max-h-56 w-auto object-contain rounded-lg"
              />
            </div>
          )}

          {isUser ? (
            <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          ) : (
            <div className="prose prose-sm max-w-none w-full text-gray-800 dark:text-gray-200 prose-p:leading-relaxed prose-p:my-1.5 prose-pre:text-gray-800 dark:prose-pre:text-gray-200 prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900 prose-strong:text-indigo-800 dark:prose-strong:text-indigo-300 prose-headings:text-indigo-900 dark:prose-headings:text-indigo-300 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-ul:my-1.5 prose-li:my-0.5 break-words">
              <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
                {normalizeMarkdownTables(msg.content)}
              </Markdown>
            </div>
          )}

          {/* Action buttons — assistant messages */}
          {!isUser && (
            <div className="absolute -top-2.5 right-2 flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
              <button
                type="button"
                onClick={() => onSpeak?.(msg.content, idx)}
                title={isPlayingAudio ? 'Stop speech' : 'Listen with Gemini Speech (TTS)'}
                className={cn(
                  'rounded-full p-1 border shadow-xs transition-colors',
                  isPlayingAudio
                    ? 'bg-indigo-600 text-white border-indigo-600 animate-pulse'
                    : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600',
                )}
              >
                {isAudioLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : isPlayingAudio ? (
                  <VolumeX className="w-3.5 h-3.5" />
                ) : (
                  <Volume2 className="w-3.5 h-3.5" />
                )}
              </button>

              <button
                type="button"
                onClick={handleCopy}
                title="Copy message"
                className="bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-300 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-xs hover:bg-gray-50 dark:hover:bg-gray-600 hover:text-indigo-600 transition-colors"
              >
                {copied ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action proposal panel */}
      {!isUser && msg.actions && msg.actions.length > 0 && (
        <div className="mt-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50/90 dark:bg-indigo-950/40 p-3 w-full max-w-full animate-fadeIn shadow-xs">
          <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-indigo-200/60 dark:border-indigo-800/60">
            <span className="text-[11px] font-bold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              {msg.actions.length === 1
                ? 'Proposed Financial Action'
                : `${msg.actions.length} Proposed Actions`}
            </span>
            {msg.actions.length > 1 && !msg.actionStatus && (
              <button
                type="button"
                onClick={() => onAction(idx, true)}
                className="rounded-lg bg-indigo-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Approve All
              </button>
            )}
          </div>

          <div className="space-y-1.5">
            {msg.actions.map((action, actionIndex) => (
              <div
                key={actionIndex}
                className="flex items-start gap-2 bg-white/70 dark:bg-gray-800/60 border border-indigo-100 dark:border-indigo-900/40 rounded-lg p-2 text-[11px] text-gray-800 dark:text-gray-200"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-gray-100">{action.summary}</p>
                </div>
              </div>
            ))}
          </div>

          {!msg.actionStatus ? (
            <div className="mt-2.5 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onAction(idx, true)}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 transition-colors shadow-xs flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Approve
              </button>
              <button
                type="button"
                onClick={() => onAction(idx, false)}
                className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
              >
                ✕ Reject
              </button>
            </div>
          ) : (
            <p
              className={cn(
                'mt-2 text-[11px] font-semibold flex items-center gap-1',
                msg.actionStatus === 'approved'
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-500 dark:text-red-400',
              )}
            >
              {msg.actionStatus === 'approved'
                ? '✅ Approved and applied to your account.'
                : '✕ Rejected — no changes made.'}
            </p>
          )}
        </div>
      )}

      {/* Timestamp */}
      <span
        className={cn(
          'text-[10px] text-gray-300 dark:text-gray-600 select-none',
          isUser ? 'mr-1' : 'ml-8',
        )}
      >
        {relTime}
      </span>
    </div>
  );
}

export function AIChat({ onDataChange }: AIChatProps = {}) {
  // Data Context Focus Selection (supports 'all' or multi-selecting specific scopes)
  const [focusScopes, setFocusScopes] = useState<AiDataFocusScope[]>(() => {
    try {
      const saved = localStorage.getItem('truespend_ai_focus_scopes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ['all'];
  });

  // Response Size & Creativity Depth Selection
  const [responseDepth, setResponseDepth] = useState<AiResponseDepth>(() => {
    const saved = localStorage.getItem('truespend_ai_response_depth') as AiResponseDepth | null;
    if (saved === 'deep_creative' || saved === 'balanced' || saved === 'concise') {
      return saved;
    }
    return 'deep_creative';
  });

  // Multi-Conversation State (with automatic migration from legacy truespend_chat_history_v2)
  const [conversations, setConversations] = useState<ChatConversation[]>(() => {
    try {
      const savedConvs = localStorage.getItem(CONVERSATIONS_STORAGE_KEY);
      if (savedConvs) {
        const parsed = JSON.parse(savedConvs);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse conversations list', e);
    }

    // Migrate legacy single-thread history if present
    let initialMessages: Message[] = [createDefaultWelcomeMessage(['all'])];
    try {
      const legacy = localStorage.getItem('truespend_chat_history_v2');
      if (legacy) {
        const parsedLegacy = JSON.parse(legacy);
        if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
          initialMessages = parsedLegacy;
        }
      }
    } catch {}

    const firstConv: ChatConversation = {
      id: `conv_${Date.now()}`,
      title: deriveConversationTitle(initialMessages, '360° Portfolio & Finance Session'),
      createdAt: initialMessages[0]?.timestamp || Date.now(),
      updatedAt: initialMessages[initialMessages.length - 1]?.timestamp || Date.now(),
      focusScopes: ['all'],
      responseDepth: 'deep_creative',
      pinned: true,
      messages: initialMessages,
    };
    return [firstConv];
  });

  const [activeConversationId, setActiveConversationId] = useState<string>(() => {
    const savedId = localStorage.getItem(ACTIVE_CONVERSATION_STORAGE_KEY);
    return savedId || '';
  });

  const activeConversation = useMemo(() => {
    return (
      conversations.find((c) => c.id === activeConversationId) ||
      conversations[0]
    );
  }, [conversations, activeConversationId]);

  // Ensure activeConversationId is always valid
  useEffect(() => {
    if (activeConversation && activeConversation.id !== activeConversationId) {
      setActiveConversationId(activeConversation.id);
    }
  }, [activeConversation, activeConversationId]);

  useEffect(() => {
    if (activeConversationId) {
      try {
        localStorage.setItem(ACTIVE_CONVERSATION_STORAGE_KEY, activeConversationId);
      } catch {}
    }
  }, [activeConversationId]);

  const messages = activeConversation?.messages || [];

  const setMessages = useCallback(
    (updater: Message[] | ((prev: Message[]) => Message[])) => {
      setConversations((prevConvs) => {
        const targetId =
          prevConvs.find((c) => c.id === activeConversationId)?.id || prevConvs[0]?.id;
        if (!targetId) return prevConvs;

        return prevConvs.map((conv) => {
          if (conv.id !== targetId) return conv;
          const nextMessages =
            typeof updater === 'function' ? updater(conv.messages) : updater;
          const isDefaultTitle =
            conv.title === 'New Financial Thread' ||
            conv.title === '360° Portfolio & Finance Session' ||
            conv.title.startsWith('New ');
          const nextTitle = isDefaultTitle
            ? deriveConversationTitle(nextMessages, conv.title)
            : conv.title;
          return {
            ...conv,
            messages: nextMessages,
            title: nextTitle,
            updatedAt: Date.now(),
          };
        });
      });
    },
    [activeConversationId],
  );

  // Conversation Sidebar / Drawer UI state
  const [showConversationsPanel, setShowConversationsPanel] = useState(false);
  const [showMobileControlsSheet, setShowMobileControlsSheet] = useState(false);
  const [conversationSearch, setConversationSearch] = useState('');
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState('');

  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId] = useState(getChatSessionId);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [activeTopic, setActiveTopic] = useState<string>('stocks');
  const [playingAudioIndex, setPlayingAudioIndex] = useState<number | null>(null);
  const [audioLoadingIndex, setAudioLoadingIndex] = useState<number | null>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const stopAudioPlayerRef = useRef<(() => void) | null>(null);

  const [isVoiceMode, setIsVoiceMode] = useState<boolean>(() => {
    return localStorage.getItem('truespend_voice_mode') === 'true';
  });

  // Persist all conversations and keep legacy key synced with active thread
  useEffect(() => {
    try {
      localStorage.setItem(CONVERSATIONS_STORAGE_KEY, JSON.stringify(conversations));
      if (activeConversation?.messages) {
        localStorage.setItem(
          'truespend_chat_history_v2',
          JSON.stringify(activeConversation.messages),
        );
      }
    } catch (e) {
      console.error('Failed to persist conversations', e);
    }
  }, [conversations, activeConversation]);

  const handleCreateNewConversation = useCallback(
    (presetScopes?: AiDataFocusScope[]) => {
      if (stopAudioPlayerRef.current) {
        stopAudioPlayerRef.current();
        stopAudioPlayerRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingAudioIndex(null);

      const scopesToUse = presetScopes || focusScopes;
      const scopeLabel = scopesToUse.includes('all')
        ? 'New Financial Thread'
        : `New ${
            DATA_FOCUS_SCOPES.find((s) => s.id === scopesToUse[0])?.shortLabel || 'Focused'
          } Thread`;

      const newConv: ChatConversation = {
        id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: scopeLabel,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        focusScopes: scopesToUse,
        responseDepth,
        pinned: false,
        messages: [createDefaultWelcomeMessage(scopesToUse)],
      };

      setConversations((prev) => [newConv, ...prev]);
      setActiveConversationId(newConv.id);
      setInput('');
      setEditingConvId(null);
      if (typeof window !== 'undefined' && window.innerWidth < 640) {
        setShowConversationsPanel(false);
        setShowMobileControlsSheet(false);
      }
    },
    [focusScopes, responseDepth],
  );

  const handleSelectConversation = useCallback((conv: ChatConversation) => {
    setActiveConversationId(conv.id);
    if (conv.focusScopes && conv.focusScopes.length > 0) {
      setFocusScopes(conv.focusScopes);
    }
    if (conv.responseDepth) {
      setResponseDepth(conv.responseDepth);
    }
    setEditingConvId(null);
    if (typeof window !== 'undefined' && window.innerWidth < 640) {
      setShowConversationsPanel(false);
    }
  }, []);

  const handleDeleteConversation = useCallback(
    (convId: string, e?: React.MouseEvent) => {
      e?.stopPropagation();
      setConversations((prev) => {
        const remaining = prev.filter((c) => c.id !== convId);
        if (remaining.length === 0) {
          const fresh: ChatConversation = {
            id: `conv_${Date.now()}`,
            title: 'New Financial Thread',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            focusScopes,
            responseDepth,
            pinned: false,
            messages: [createDefaultWelcomeMessage(focusScopes)],
          };
          setActiveConversationId(fresh.id);
          return [fresh];
        }
        if (convId === activeConversationId) {
          setActiveConversationId(remaining[0].id);
        }
        return remaining;
      });
    },
    [activeConversationId, focusScopes, responseDepth],
  );

  const handleTogglePinConversation = useCallback((convId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setConversations((prev) =>
      prev.map((c) => (c.id === convId ? { ...c, pinned: !c.pinned } : c)),
    );
  }, []);

  const handleSaveRenameConversation = useCallback((convId: string) => {
    const trimmed = editingConvTitle.trim();
    if (trimmed) {
      setConversations((prev) =>
        prev.map((c) => (c.id === convId ? { ...c, title: trimmed, updatedAt: Date.now() } : c)),
      );
    }
    setEditingConvId(null);
    setEditingConvTitle('');
  }, [editingConvTitle]);

  const filteredConversations = useMemo(() => {
    const q = conversationSearch.trim().toLowerCase();
    const list = conversations.filter((c) => {
      if (!q) return true;
      if (c.title.toLowerCase().includes(q)) return true;
      return c.messages.some((m) => m.content.toLowerCase().includes(q));
    });
    return [...list].sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return b.updatedAt - a.updatedAt;
    });
  }, [conversations, conversationSearch]);

  const handleToggleFocusScope = (scopeId: AiDataFocusScope) => {
    setFocusScopes((prev) => {
      let next: AiDataFocusScope[];
      if (scopeId === 'all') {
        next = ['all'];
      } else {
        const withoutAll = prev.filter((s) => s !== 'all');
        if (withoutAll.includes(scopeId)) {
          const filtered = withoutAll.filter((s) => s !== scopeId);
          next = filtered.length === 0 ? ['all'] : filtered;
        } else {
          next = [...withoutAll, scopeId];
        }
      }
      try {
        localStorage.setItem('truespend_ai_focus_scopes', JSON.stringify(next));
      } catch {}
      setConversations((convs) =>
        convs.map((c) => (c.id === activeConversationId ? { ...c, focusScopes: next } : c)),
      );
      return next;
    });
  };

  const handleChangeResponseDepth = (depth: AiResponseDepth) => {
    setResponseDepth(depth);
    try {
      localStorage.setItem('truespend_ai_response_depth', depth);
    } catch {}
    setConversations((convs) =>
      convs.map((c) => (c.id === activeConversationId ? { ...c, responseDepth: depth } : c)),
    );
  };

  const toggleVoiceMode = () => {
    setIsVoiceMode((prev) => {
      const next = !prev;
      localStorage.setItem('truespend_voice_mode', String(next));
      return next;
    });
  };

  // Model Routing & Quota Failover state
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    return localStorage.getItem('truespend_selected_model') || 'auto';
  });
  const [allowFallback, setAllowFallback] = useState<boolean>(() => {
    return localStorage.getItem('truespend_allow_fallback') !== 'false';
  });
  const [showModelDropdown, setShowModelDropdown] = useState(false);
  const [showQuotaModal, setShowQuotaModal] = useState(false);
  const [modelStatuses, setModelStatuses] = useState<ModelStatusInfo[]>([]);
  const [isResettingCooldowns, setIsResettingCooldowns] = useState(false);
  const [isAutoFallenBack, setIsAutoFallenBack] = useState(false);

  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const [selectedImage, setSelectedImage] = useState<{
    data: string;
    mimeType: string;
    previewUrl: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voiceSupported] = useState(
    () => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window,
  );
  const { token } = useAuth();

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchModelStatuses = useCallback(async () => {
    try {
      const res = await fetch('/api/chat/models', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.models)) {
          setModelStatuses(data.models);
        }
        setIsAutoFallenBack(Boolean(data.isAutoFallenBack));
      }
    } catch {}
  }, [token]);

  useEffect(() => {
    fetchModelStatuses();
  }, [fetchModelStatuses]);

  const handleModelChange = (modelId: string) => {
    setSelectedModel(modelId);
    localStorage.setItem('truespend_selected_model', modelId);
    setShowModelDropdown(false);
  };

  const handleToggleFallback = (enabled: boolean) => {
    setAllowFallback(enabled);
    localStorage.setItem('truespend_allow_fallback', enabled ? 'true' : 'false');
  };

  const handleResetCooldowns = async () => {
    setIsResettingCooldowns(true);
    try {
      const res = await fetch('/api/chat/reset-cooldown', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        await fetchModelStatuses();
      }
    } catch {} finally {
      setIsResettingCooldowns(false);
    }
  };

  const {
    kpis,
    transactions,
    debts,
    budgets,
    payrolls,
    goals,
    subscriptions,
    contexts,
    investmentsData,
    fetchData,
  } = useDashboardData(token);

  const aiContext = useMemo(
    () =>
      buildAiContextSnapshot({
        kpis,
        transactions,
        debts,
        budgets,
        payrolls,
        goals,
        subscriptions,
        contexts,
        investmentsData,
        focusScopes,
        responseDepth,
      }),
    [
      kpis,
      transactions,
      debts,
      budgets,
      payrolls,
      goals,
      subscriptions,
      contexts,
      investmentsData,
      focusScopes,
      responseDepth,
    ],
  );

  // Scope badge counts for live visual feedback
  const scopeCounts: Record<AiDataFocusScope, string> = useMemo(() => {
    const posCount = investmentsData?.positions?.length || 0;
    const txCount = transactions?.length || 0;
    const walletCount = kpis?.accounts?.length || 0;
    const budgetCount = budgets?.length || 0;
    const debtGoalCount =
      (debts?.length || 0) + (goals?.length || 0) + (subscriptions?.length || 0);
    return {
      all: '360°',
      investments: `${posCount} pos`,
      transactions: `${txCount} tx`,
      wallets: `${walletCount} accts`,
      budgets: `${budgetCount} caps`,
      debts_goals: `${debtGoalCount} items`,
      forecast: '90d/12m',
    };
  }, [
    investmentsData?.positions?.length,
    transactions?.length,
    kpis?.accounts?.length,
    budgets?.length,
    debts?.length,
    goals?.length,
    subscriptions?.length,
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = useCallback((smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  }, []);

  useEffect(() => {
    scrollToBottom(messages.length <= 1);
  }, [messages, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom =
        container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(distFromBottom > 100);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const handleReset = () => {
    if (confirm('Clear the chat history and start a fresh session?')) {
      if (stopAudioPlayerRef.current) {
        stopAudioPlayerRef.current();
        stopAudioPlayerRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingAudioIndex(null);
      const primaryScope =
        DATA_FOCUS_SCOPES.find((s) => s.id === focusScopes[0]) || DATA_FOCUS_SCOPES[0];
      setMessages([
        {
          role: 'assistant',
          content:
            'Fresh session started! 👋 Select any **Data Focus** scope above (or keep **All at Once**) and ask me anything about your stocks, Binance positions, transactions, budgets, or wallets.',
          timestamp: Date.now(),
          suggestions: primaryScope.prompts,
        },
      ]);
    }
  };

  useEffect(() => {
    return () => {
      if (stopAudioPlayerRef.current) {
        stopAudioPlayerRef.current();
        stopAudioPlayerRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
    };
  }, []);

  const handleExportChat = () => {
    const exportText = messages
      .filter((m) => m.role !== 'system')
      .map(
        (m) =>
          `### ${m.role === 'user' ? '👤 You' : '🤖 Spex (Google Gemini AI)'} — ${new Date(
            m.timestamp,
          ).toLocaleTimeString()}\n\n${m.content}\n`,
      )
      .join('\n---\n\n');

    const blob = new Blob(
      [
        `# TrueSpend AI Financial & Portfolio Advisory Report\nDate: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}\n\n---\n\n${exportText}`,
      ],
      { type: 'text/markdown' },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `truespend-ai-report-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const startBrowserSpeech = useCallback((text: string, index: number) => {
    setAudioLoadingIndex(null);
    setPlayingAudioIndex(index);

    const stopSpeech = playBrowserSpeech(text, {
      onStart: () => {
        setPlayingAudioIndex(index);
      },
      onEnd: () => {
        setPlayingAudioIndex(null);
        stopAudioPlayerRef.current = null;
      },
      onError: () => {
        setPlayingAudioIndex(null);
        stopAudioPlayerRef.current = null;
      },
    });

    stopAudioPlayerRef.current = stopSpeech;
  }, []);

  const handleSpeak = useCallback(
    async (text: string, index: number) => {
      if (playingAudioIndex === index) {
        if (stopAudioPlayerRef.current) {
          stopAudioPlayerRef.current();
          stopAudioPlayerRef.current = null;
        }
        if (currentAudioRef.current) {
          currentAudioRef.current.pause();
          currentAudioRef.current = null;
        }
        setPlayingAudioIndex(null);
        return;
      }

      if (stopAudioPlayerRef.current) {
        stopAudioPlayerRef.current();
        stopAudioPlayerRef.current = null;
      }
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current = null;
      }
      setPlayingAudioIndex(null);
      setAudioLoadingIndex(index);

      try {
        const res = await fetch('/api/chat/tts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) throw new Error('TTS request failed');

        const { audio, mimeType } = await res.json();
        if (!audio) throw new Error('No audio in response');

        const player = playAudioBlob(audio, mimeType || 'audio/wav', {
          onStart: () => {
            setAudioLoadingIndex(null);
            setPlayingAudioIndex(index);
          },
          onEnd: () => {
            setPlayingAudioIndex(null);
            stopAudioPlayerRef.current = null;
          },
          onError: (err) => {
            console.warn('Audio playback error, falling back to browser speech engine:', err);
            startBrowserSpeech(text, index);
          },
        });

        stopAudioPlayerRef.current = player.stop;
      } catch (err) {
        console.warn('Gemini TTS failed, falling back to browser SpeechSynthesis:', err);
        startBrowserSpeech(text, index);
      } finally {
        setAudioLoadingIndex(null);
      }
    },
    [playingAudioIndex, token, startBrowserSpeech],
  );

  const handleSend = useCallback(
    async (draft = input) => {
      const content = draft.trim();
      if ((!content && !selectedImage) || isLoading) return;

      const currentImage = selectedImage;
      const userMsg: Message = {
        role: 'user',
        content: content || 'Please analyze this receipt and propose a transaction.',
        imageUrl: currentImage?.previewUrl,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setInput('');
      setSelectedImage(null);
      setIsLoading(true);

      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }

      try {
        const apiMessages = [...messages, userMsg]
          .filter((m) => m.role !== 'system')
          .slice(-18)
          .map(({ role, content: messageContent }) => ({
            role,
            content: messageContent.slice(0, 12000),
          }));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            messages: apiMessages,
            contextData: aiContext,
            sessionId: chatSessionId,
            image: currentImage
              ? { data: currentImage.data, mimeType: currentImage.mimeType }
              : undefined,
            selectedModel: selectedModel === 'auto' ? 'auto' : selectedModel,
            allowFallback,
            focusScopes,
            responseDepth,
          }),
        });

        if (!response.ok) {
          if (response.status === 401) {
            window.dispatchEvent(new Event('auth:unauthorized'));
          }
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || 'Failed to get response');
        }

        const data = await response.json();
        if (data.reply) {
          const replyText = data.reply;
          setMessages((prev) => {
            const nextList = [
              ...prev,
              {
                role: 'assistant' as const,
                content: replyText,
                actions: data.actions || [],
                suggestions: data.suggestions?.length ? data.suggestions : FALLBACK_SUGGESTIONS,
                modelUsed: data.modelUsed,
                requestedModel: data.requestedModel,
                responseTimeMs: data.responseTimeMs,
                quotaFallback: data.quotaFallback,
                fallbackReason: data.fallbackReason,
                focusScopesUsed: focusScopes,
                responseDepthUsed: responseDepth,
                timestamp: Date.now(),
              },
            ];
            if (isVoiceMode) {
              const targetIdx = nextList.length - 1;
              setTimeout(() => {
                handleSpeak(replyText, targetIdx);
              }, 120);
            }
            return nextList;
          });
          fetchModelStatuses();
        } else {
          setMessages((prev) => [
            ...prev,
            {
              role: 'assistant',
              content:
                "I've analyzed your financial situation. Let me know if you need any adjustments.",
              timestamp: Date.now(),
            },
          ]);
        }
      } catch (error: any) {
        console.error('Chat error:', error);
        let userFacingError =
          error.message && error.message !== 'Failed to fetch'
            ? error.message
            : 'Sorry, I ran into a temporary error communicating with Gemini. Please try again.';
        try {
          const raw = String(userFacingError).replace(/^⚠️\s*/, '').trim();
          if (raw.startsWith('{') && raw.endsWith('}')) {
            const parsed = JSON.parse(raw);
            if (parsed?.error?.message) {
              userFacingError = parsed.error.message;
            }
          }
        } catch {}
        const errorMessage = `⚠️ ${userFacingError}`;
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: errorMessage,
            timestamp: Date.now(),
            suggestions: [
              '📈 Deep audit of my Binance & Stock positions, fees & breakeven',
              '📊 Run a complete financial health audit',
              '💰 What can I safely spend today?',
            ],
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      input,
      selectedImage,
      isLoading,
      messages,
      token,
      aiContext,
      chatSessionId,
      selectedModel,
      allowFallback,
      focusScopes,
      responseDepth,
      fetchModelStatuses,
      isVoiceMode,
      handleSpeak,
    ],
  );

  useEffect(() => {
    const handler = (e: any) => {
      const prompt = e.detail?.prompt;
      if (prompt && typeof prompt === 'string') {
        handleSend(prompt);
      }
    };
    window.addEventListener('truespend:sendChatPrompt', handler);
    return () => window.removeEventListener('truespend:sendChatPrompt', handler);
  }, [handleSend]);

  const handleAction = async (index: number, approve: boolean) => {
    const message = messages[index];
    if (!message.actions?.length) return;
    if (!approve) {
      setMessages((prev) =>
        prev.map((item, i) => (i === index ? { ...item, actionStatus: 'rejected' } : item)),
      );
      return;
    }
    try {
      const response = await fetch('/api/chat/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actions: message.actions }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          window.dispatchEvent(new Event('auth:unauthorized'));
        }
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Action could not be completed');
      }
      await fetchData();
      onDataChange?.();
      setMessages((prev) =>
        prev.map((item, i) => (i === index ? { ...item, actionStatus: 'approved' } : item)),
      );
    } catch (error: any) {
      console.error(error);
      window.dispatchEvent(
        new CustomEvent('truespend:toast', {
          detail: { message: error.message || 'The action could not be completed.', type: 'error' },
        }),
      );
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 150)}px`;
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setSelectedImage({
        data: dataUrl,
        mimeType: file.type || 'image/jpeg',
        previewUrl: dataUrl,
      });
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleVoice = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput((prev) => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, voiceSupported]);

  // Suggestions dynamically adapt to the selected Focus Scope or Topic
  const currentTopicData = PROMPT_TOPICS.find((t) => t.id === activeTopic) || PROMPT_TOPICS[0];
  const primaryFocusScopeObj =
    DATA_FOCUS_SCOPES.find((s) => s.id === focusScopes[0]) || DATA_FOCUS_SCOPES[0];
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === 'assistant');

  const activeSuggestions = useMemo(() => {
    if (!focusScopes.includes('all')) {
      return primaryFocusScopeObj.prompts;
    }
    if (messages.length <= 1) {
      return currentTopicData.prompts;
    }
    return lastAssistantMsg?.suggestions?.length
      ? lastAssistantMsg.suggestions
      : currentTopicData.prompts;
  }, [focusScopes, primaryFocusScopeObj, messages.length, currentTopicData, lastAssistantMsg]);

  const charLimit = 4000;
  const charsLeft = charLimit - input.length;

  return (
    <>
      <style>{`
        @keyframes typingBounce {
          0%, 80%, 100% { transform: translateY(0); opacity: 0.6; }
          40% { transform: translateY(-6px); opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-slideIn { animation: slideIn 0.25s ease-out; }
        .animate-fadeIn { animation: fadeIn 0.3s ease-out; }
      `}</style>

      <div
        className={cn(
          'fixed inset-0 z-[60] flex flex-col bg-gray-50 dark:bg-gray-950',
          'sm:static sm:z-auto sm:rounded-2xl sm:shadow-sm sm:border sm:border-gray-200 sm:dark:border-gray-800 sm:overflow-hidden sm:h-[calc(100vh-8.5rem)] sm:min-h-[600px]',
        )}
      >
        {/* ─── Mobile Ordered Top Header ─────────────────────────── */}
        <div className="sm:hidden flex items-center justify-between gap-2 px-3 py-2.5 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-b border-gray-200/80 dark:border-gray-800 flex-shrink-0 z-30">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('truespend:openSidebar'))}
              title="Open navigation menu"
              className="p-2 -ml-1 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800 transition-colors shrink-0"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMobileControlsSheet(false);
                setShowConversationsPanel((prev) => !prev);
              }}
              className="flex items-center gap-2 min-w-0 flex-1 text-left rounded-xl py-0.5 pr-1.5 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors"
              title="Tap to switch or manage conversations"
            >
              <SpexAvatar className="h-8 w-8 shrink-0" animated />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1">
                  <p className="text-xs font-bold text-gray-900 dark:text-white truncate">
                    {activeConversation?.title || 'Spex Financial AI'}
                  </p>
                  <ChevronDown
                    className={cn(
                      'w-3.5 h-3.5 text-gray-400 shrink-0 transition-transform',
                      showConversationsPanel && 'rotate-180 text-indigo-600 dark:text-indigo-400',
                    )}
                  />
                </div>
                <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate leading-tight">
                  Spex •{' '}
                  {focusScopes.includes('all')
                    ? '360° All Data'
                    : focusScopes
                        .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                        .join(' + ')}{' '}
                  •{' '}
                  {RESPONSE_DEPTH_OPTIONS.find((r) => r.id === responseDepth)?.shortLabel || 'Deep'}
                </p>
              </div>
            </button>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => handleCreateNewConversation()}
              title="New conversation"
              className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"
            >
              <Plus className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={() => {
                setShowMobileControlsSheet(false);
                setShowConversationsPanel((prev) => !prev);
              }}
              title="Conversations history"
              className={cn(
                'relative p-2 rounded-xl transition-colors',
                showConversationsPanel
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <MessageSquare className="w-4 h-4" />
              <span
                className={cn(
                  'absolute -top-0.5 -right-0.5 min-w-[15px] h-[15px] rounded-full text-[9px] font-bold flex items-center justify-center px-0.5',
                  showConversationsPanel
                    ? 'bg-white text-indigo-700'
                    : 'bg-indigo-600 text-white',
                )}
              >
                {conversations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowConversationsPanel(false);
                setShowMobileControlsSheet((prev) => !prev);
              }}
              title="AI Context, Depth, Topics & Settings"
              className={cn(
                'relative p-2 rounded-xl transition-colors',
                showMobileControlsSheet
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
              )}
            >
              <SlidersHorizontal className="w-4 h-4" />
              {(!focusScopes.includes('all') || isVoiceMode) && !showMobileControlsSheet && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-gray-900" />
              )}
            </button>
          </div>
        </div>

        {/* ─── Mobile Slim Status & Quick-Access Bar ─────────────── */}
        <div className="sm:hidden flex items-center justify-between gap-1.5 px-3 py-1.5 bg-gray-50/95 dark:bg-gray-900/95 border-b border-gray-200/70 dark:border-gray-800/80 flex-shrink-0 z-20">
          <div className="flex items-center gap-1.5 min-w-0 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => {
                setShowConversationsPanel(false);
                setShowMobileControlsSheet((prev) => !prev);
              }}
              className={cn(
                'inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold whitespace-nowrap border transition-colors',
                focusScopes.includes('all')
                  ? 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-200 border-gray-200 dark:border-gray-700'
                  : 'bg-emerald-600 text-white border-emerald-600',
              )}
            >
              <SlidersHorizontal className="w-3 h-3 text-indigo-500 dark:text-indigo-400 shrink-0" />
              <span>
                {focusScopes.includes('all')
                  ? '360° All Data'
                  : focusScopes
                      .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                      .join(' + ')}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const order: AiResponseDepth[] = ['deep_creative', 'balanced', 'concise'];
                const nextIdx = (order.indexOf(responseDepth) + 1) % order.length;
                handleChangeResponseDepth(order[nextIdx]);
              }}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-indigo-50/90 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800/60 whitespace-nowrap"
              title="Tap to cycle response depth"
            >
              <Sparkles className="w-3 h-3 shrink-0" />
              <span>
                {RESPONSE_DEPTH_OPTIONS.find((r) => r.id === responseDepth)?.shortLabel || 'Deep'}
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              setShowConversationsPanel(false);
              setShowMobileControlsSheet((prev) => !prev);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700 whitespace-nowrap shrink-0"
          >
            <span>{currentTopicData.label}</span>
            <ChevronDown
              className={cn(
                'w-3 h-3 text-gray-400 transition-transform',
                showMobileControlsSheet && 'rotate-180',
              )}
            />
          </button>
        </div>

        {/* ─── Mobile Ordered Controls & Focus Sheet ─────────────── */}
        {showMobileControlsSheet && (
          <div className="sm:hidden fixed inset-0 z-50 flex flex-col">
            <div
              className="fixed inset-0 bg-black/45 backdrop-blur-xs animate-fadeIn"
              onClick={() => setShowMobileControlsSheet(false)}
            />
            <div className="relative z-10 mt-auto max-h-[84vh] w-full rounded-t-3xl bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shadow-2xl flex flex-col overflow-hidden animate-slideIn">
              <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400">
                    <SlidersHorizontal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                      Spex AI Controls &amp; Context Focus
                    </h3>
                    <p className="text-[11px] text-gray-500 dark:text-gray-400">
                      Customize data scope, response depth, topics &amp; tools
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMobileControlsSheet(false)}
                  className="p-1.5 rounded-xl text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-5">
                {/* 1. Data Context Focus Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      1. Data Context Focus
                    </span>
                    <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium">
                      Multi-select supported
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {DATA_FOCUS_SCOPES.map((scope) => {
                      const Icon = scope.icon;
                      const isSelected = focusScopes.includes(scope.id);
                      return (
                        <button
                          key={scope.id}
                          type="button"
                          onClick={() => handleToggleFocusScope(scope.id)}
                          className={cn(
                            'flex items-center justify-between gap-2 rounded-xl p-2.5 text-left border transition-all',
                            scope.id === 'all' && 'col-span-2',
                            isSelected
                              ? scope.id === 'all'
                                ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-xs'
                                : 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                              : 'bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-200 border-gray-200 dark:border-gray-700',
                          )}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="w-4 h-4 shrink-0" />
                            <div className="min-w-0">
                              <p className="text-xs font-semibold truncate">{scope.shortLabel}</p>
                              {scope.id === 'all' && (
                                <p
                                  className={cn(
                                    'text-[10px] truncate',
                                    isSelected
                                      ? 'text-gray-300 dark:text-gray-600'
                                      : 'text-gray-400 dark:text-gray-500',
                                  )}
                                >
                                  Full cross-account financial &amp; Binance visibility
                                </p>
                              )}
                            </div>
                          </div>
                          <span
                            className={cn(
                              'text-[10px] font-mono px-1.5 py-0.5 rounded-md shrink-0',
                              isSelected
                                ? 'bg-white/20 text-current'
                                : 'bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                            )}
                          >
                            {scopeCounts[scope.id]}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Response Depth Selector */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    2. Response Depth &amp; Creativity
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {RESPONSE_DEPTH_OPTIONS.map((opt) => {
                      const isSelected = responseDepth === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => handleChangeResponseDepth(opt.id)}
                          className={cn(
                            'flex flex-col items-center justify-center rounded-xl p-2.5 text-center border transition-all',
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                              : 'bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                          )}
                        >
                          <span className="text-xs font-bold">{opt.shortLabel}</span>
                          <span
                            className={cn(
                              'text-[10px] mt-0.5 line-clamp-1',
                              isSelected ? 'text-indigo-100' : 'text-gray-400 dark:text-gray-500',
                            )}
                          >
                            {opt.id === 'deep_creative'
                              ? 'Full tables & math'
                              : opt.id === 'balanced'
                                ? 'Clear & structured'
                                : 'Quick summary'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Prompt Topic Starters */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    3. Suggestion Prompt Topics
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {PROMPT_TOPICS.map((topic) => {
                      const Icon = topic.icon;
                      const isActive = activeTopic === topic.id;
                      return (
                        <button
                          key={topic.id}
                          type="button"
                          onClick={() => {
                            setActiveTopic(topic.id);
                            setShowMobileControlsSheet(false);
                          }}
                          className={cn(
                            'flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold border transition-all',
                            isActive
                              ? 'bg-indigo-50 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700'
                              : 'bg-gray-50 dark:bg-gray-800/80 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700',
                          )}
                        >
                          <Icon className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          <span className="truncate">{topic.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 4. Model Routing & Thread Utilities */}
                <div>
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                    4. AI Model &amp; Thread Tools
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileControlsSheet(false);
                        fetchModelStatuses();
                        setShowQuotaModal(true);
                      }}
                      className="flex items-center gap-2 rounded-xl p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-left"
                    >
                      <Cpu className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {selectedModel === 'auto'
                            ? isAutoFallenBack
                              ? 'Auto (3.1 Lite)'
                              : 'Smart Auto'
                            : AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.shortName ||
                              selectedModel}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">Model &amp; Quotas</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={toggleVoiceMode}
                      className={cn(
                        'flex items-center gap-2 rounded-xl p-2.5 border text-left transition-colors',
                        isVoiceMode
                          ? 'bg-emerald-50 dark:bg-emerald-950/70 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                          : 'bg-gray-50 dark:bg-gray-800/80 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-200',
                      )}
                    >
                      {isVoiceMode ? (
                        <Volume2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      ) : (
                        <VolumeX className="w-4 h-4 text-gray-400 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">
                          {isVoiceMode ? 'Voice Auto-Read On' : 'Voice Auto-Read Off'}
                        </p>
                        <p className="text-[10px] text-gray-400 truncate">Spex TTS Speech</p>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileControlsSheet(false);
                        handleExportChat();
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl p-2.5 bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-200"
                    >
                      <Download className="w-3.5 h-3.5 text-indigo-500" />
                      <span>Export Report</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setShowMobileControlsSheet(false);
                        handleReset();
                      }}
                      className="flex items-center justify-center gap-1.5 rounded-xl p-2.5 bg-rose-50/70 dark:bg-rose-950/30 border border-rose-200/70 dark:border-rose-900/50 text-xs font-semibold text-rose-600 dark:text-rose-400"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Clear Thread</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="px-4 py-3 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-100 dark:border-gray-800">
                <button
                  type="button"
                  onClick={() => setShowMobileControlsSheet(false)}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-xs transition-colors"
                >
                  Apply &amp; Return to Chat
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Desktop header ─── */}
        <div className="hidden sm:flex items-center justify-between px-5 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0 text-gray-900 dark:text-gray-100">
          <div className="flex items-center gap-3">
            <SpexAvatar className="h-11 w-11" animated />
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                  Spex 360° Financial &amp; Portfolio Intelligence
                </p>
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 dark:bg-indigo-950/70 border border-indigo-200/70 dark:border-indigo-800/60 px-2 py-0.5 text-[10px] font-semibold text-indigo-700 dark:text-indigo-300">
                  <Sparkles className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                  Google Gemini AI
                </span>
              </div>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-tight">
                Live Binance &amp; Stocks Forensics • Full Transaction &amp; Wallet Context • Expansive Output Mode
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 relative">
            {/* Multi-Conversation Controls */}
            <button
              type="button"
              onClick={() => setShowConversationsPanel((prev) => !prev)}
              title="Open conversations history & threads"
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all border shadow-xs',
                showConversationsPanel
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200',
              )}
            >
              <FolderOpen className="w-3.5 h-3.5" />
              <span className="max-w-[130px] truncate">
                {activeConversation?.title || 'Conversations'}
              </span>
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.2 text-[10px] font-mono',
                  showConversationsPanel
                    ? 'bg-white/20 text-white'
                    : 'bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300',
                )}
              >
                {conversations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleCreateNewConversation()}
              title="Start a new conversation thread"
              className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1.5 text-xs font-semibold transition-colors shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New Chat</span>
            </button>

            {/* Response Depth / Size Selector */}
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-0.5 text-[11px]">
              {RESPONSE_DEPTH_OPTIONS.map((opt) => {
                const isSelected = responseDepth === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeResponseDepth(opt.id)}
                    title={`${opt.label}: ${opt.description}`}
                    className={cn(
                      'px-2 py-1 rounded-md font-medium transition-colors whitespace-nowrap',
                      isSelected
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white',
                    )}
                  >
                    {opt.shortLabel}
                  </button>
                );
              })}
            </div>

            {/* Model Selector Dropdown */}
            <div className="relative" ref={modelDropdownRef}>
              <button
                type="button"
                onClick={() => {
                  setShowModelDropdown((prev) => !prev);
                  fetchModelStatuses();
                }}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all border shadow-xs',
                  selectedModel === 'auto'
                    ? isAutoFallenBack
                      ? 'bg-amber-50 dark:bg-amber-950/60 hover:bg-amber-100 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200'
                      : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200'
                    : 'bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-200',
                )}
                title="Select Gemini AI Model or Switch Mode"
              >
                <Cpu className="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" />
                <span className="font-semibold max-w-[130px] truncate">
                  {selectedModel === 'auto'
                    ? isAutoFallenBack
                      ? 'Auto (3.1 Lite Active)'
                      : 'Smart Auto'
                    : AVAILABLE_MODELS.find((m) => m.id === selectedModel)?.shortName ||
                      selectedModel}
                </span>
                <ChevronDown
                  className={cn(
                    'w-3 h-3 text-gray-500 dark:text-gray-400 transition-transform',
                    showModelDropdown && 'rotate-180',
                  )}
                />
              </button>

              {showModelDropdown && (
                <div className="absolute right-0 top-full mt-2 w-80 rounded-xl bg-white dark:bg-gray-800 shadow-2xl border border-gray-200 dark:border-gray-700 py-2.5 px-3 z-50 text-gray-900 dark:text-gray-100 animate-fadeIn">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs font-bold text-gray-900 dark:text-white">
                        AI Model Routing
                      </p>
                      <p className="text-[10px] text-gray-500 dark:text-gray-400">
                        Manual switch &amp; smart quota failover
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowModelDropdown(false);
                        setShowQuotaModal(true);
                      }}
                      className="text-[10px] text-indigo-600 dark:text-indigo-400 hover:underline font-medium flex items-center gap-0.5"
                    >
                      <Info className="w-3 h-3" />
                      Quota Info
                    </button>
                  </div>

                  <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                    {AVAILABLE_MODELS.map((model) => {
                      const isSelected = selectedModel === model.id;
                      const status = modelStatuses.find((s) => s.id === model.id);
                      const isExhausted = status?.isExhausted;

                      return (
                        <button
                          key={model.id}
                          type="button"
                          onClick={() => handleModelChange(model.id)}
                          className={cn(
                            'w-full text-left p-2 rounded-lg text-xs transition-colors border',
                            isSelected
                              ? 'bg-indigo-50 dark:bg-indigo-950/70 border-indigo-200 dark:border-indigo-800/80 text-indigo-900 dark:text-indigo-100'
                              : 'bg-transparent hover:bg-gray-50 dark:hover:bg-gray-750 border-transparent text-gray-700 dark:text-gray-300',
                          )}
                        >
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="font-semibold flex items-center gap-1.5">
                              {model.name}
                              {isSelected && (
                                <Check className="w-3 h-3 text-indigo-600 dark:text-indigo-400 inline" />
                              )}
                            </span>
                            <span
                              className={cn(
                                'text-[9px] px-1.5 py-0.2 rounded-full font-mono font-medium',
                                isExhausted
                                  ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300',
                              )}
                            >
                              {isExhausted ? 'Rate Limited' : model.badge}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 dark:text-gray-400 leading-tight">
                            {model.description}
                          </p>
                          <p className="text-[9px] text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                            📊 {model.quotaSummary}
                          </p>
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-2.5 pt-2 border-t border-gray-100 dark:border-gray-700">
                    <label className="flex items-start gap-2 cursor-pointer select-none text-[11px] text-gray-700 dark:text-gray-300">
                      <input
                        type="checkbox"
                        checked={allowFallback}
                        onChange={(e) => handleToggleFallback(e.target.checked)}
                        className="mt-0.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5"
                      />
                      <div>
                        <span className="font-semibold block">Auto-fallback on rate limits</span>
                        <span className="text-[9px] text-gray-400 dark:text-gray-500 block leading-tight">
                          If chosen model runs out of requests or hits 429, auto-switches to 3.1 Lite (500/day).
                        </span>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={toggleVoiceMode}
              title={
                isVoiceMode
                  ? 'Voice Mode Active (Spex auto-speaks responses)'
                  : 'Voice Mode Inactive (Click to auto-speak responses)'
              }
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-all shadow-xs border',
                isVoiceMode
                  ? 'bg-emerald-50 dark:bg-emerald-950/60 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
                  : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200',
              )}
            >
              {isVoiceMode ? (
                <Volume2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 animate-pulse" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-gray-400" />
              )}
              <span>{isVoiceMode ? 'Voice On' : 'Voice'}</span>
            </button>

            <button
              type="button"
              onClick={handleExportChat}
              title="Export financial report (Markdown)"
              className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button
              type="button"
              onClick={handleReset}
              title="Clear chat"
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ─── Desktop Interactive Data Context Focus Selector Bar ───────────── */}
        <div className="hidden sm:flex flex-col gap-1.5 px-5 py-2 bg-gray-50/95 dark:bg-gray-900/95 border-b border-gray-200/80 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center justify-between gap-2 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mr-1 whitespace-nowrap">
                <SlidersHorizontal className="w-3 h-3" />
                Context Focus:
              </span>
              {DATA_FOCUS_SCOPES.map((scope) => {
                const Icon = scope.icon;
                const isSelected = focusScopes.includes(scope.id);
                return (
                  <button
                    key={scope.id}
                    type="button"
                    onClick={() => handleToggleFocusScope(scope.id)}
                    title={scope.description}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-all whitespace-nowrap border',
                      isSelected
                        ? scope.id === 'all'
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white shadow-2xs'
                          : 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700 hover:text-gray-900 dark:hover:text-white',
                    )}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{scope.shortLabel}</span>
                    <span
                      className={cn(
                        'text-[9px] font-mono px-1 py-0.2 rounded',
                        isSelected
                          ? 'bg-white/20 text-current'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400',
                      )}
                    >
                      {scopeCounts[scope.id]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Topic Mode Selector Row (Desktop) */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mr-1 whitespace-nowrap">
              Prompts:
            </span>
            {PROMPT_TOPICS.map((topic) => {
              const Icon = topic.icon;
              const isActive = activeTopic === topic.id;
              return (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setActiveTopic(topic.id)}
                  className={cn(
                    'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-medium transition-all whitespace-nowrap',
                    isActive
                      ? 'bg-indigo-100 dark:bg-indigo-950/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                      : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-800 dark:hover:text-gray-200',
                  )}
                >
                  <Icon className="w-3 h-3" />
                  {topic.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* ─── Main Body: Optional Conversations Sidebar + Messages Area ─── */}
        <div className="relative flex-1 overflow-hidden flex">
          {/* Mobile Overlay Backdrop for Conversations Drawer */}
          {showConversationsPanel && (
            <div
              className="sm:hidden fixed inset-0 bg-black/40 backdrop-blur-xs z-30 animate-fadeIn"
              onClick={() => setShowConversationsPanel(false)}
            />
          )}

          {/* Collapsible Conversations Drawer / Sidebar */}
          {showConversationsPanel && (
            <div className="fixed sm:static inset-y-0 left-0 w-[85vw] max-w-[320px] sm:w-80 flex-shrink-0 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 flex flex-col z-40 sm:z-20 shadow-2xl sm:shadow-none animate-fadeIn">
              <div className="p-3 border-b border-gray-100 dark:border-gray-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <MessageSquare className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                    <span className="text-xs font-bold text-gray-900 dark:text-white uppercase tracking-wider">
                      Conversations ({conversations.length})
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleCreateNewConversation()}
                      className="inline-flex items-center gap-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white px-2.5 py-1 text-[11px] font-semibold transition-colors"
                    >
                      <Plus className="w-3 h-3" /> New
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowConversationsPanel(false)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
                      title="Close sidebar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder="Search threads or messages…"
                    className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 pl-8 pr-7 py-1.5 text-xs text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-indigo-500"
                  />
                  {conversationSearch && (
                    <button
                      type="button"
                      onClick={() => setConversationSearch('')}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {filteredConversations.map((conv) => {
                  const isActive = conv.id === activeConversation?.id;
                  const userMsgCount = conv.messages.filter((m) => m.role === 'user').length;
                  const lastMsg = conv.messages[conv.messages.length - 1];
                  const isEditing = editingConvId === conv.id;

                  return (
                    <div
                      key={conv.id}
                      onClick={() => handleSelectConversation(conv)}
                      className={cn(
                        'group rounded-xl p-2.5 cursor-pointer transition-all border',
                        isActive
                          ? 'bg-indigo-50/90 dark:bg-indigo-950/60 border-indigo-200 dark:border-indigo-800/80 shadow-2xs'
                          : 'bg-transparent border-transparent hover:bg-gray-50 dark:hover:bg-gray-800/60',
                      )}
                    >
                      <div className="flex items-start justify-between gap-1.5">
                        {isEditing ? (
                          <div
                            className="flex items-center gap-1 flex-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="text"
                              value={editingConvTitle}
                              onChange={(e) => setEditingConvTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveRenameConversation(conv.id);
                                if (e.key === 'Escape') setEditingConvId(null);
                              }}
                              autoFocus
                              className="w-full rounded border border-indigo-400 bg-white dark:bg-gray-900 px-1.5 py-0.5 text-xs font-semibold text-gray-900 dark:text-white focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveRenameConversation(conv.id)}
                              className="p-1 text-emerald-600 hover:bg-emerald-50 rounded"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              {conv.pinned && (
                                <Pin className="w-3 h-3 text-amber-500 shrink-0 fill-amber-500" />
                              )}
                              <p
                                className={cn(
                                  'text-xs font-semibold truncate',
                                  isActive
                                    ? 'text-indigo-950 dark:text-indigo-100'
                                    : 'text-gray-800 dark:text-gray-200',
                                )}
                              >
                                {conv.title}
                              </p>
                            </div>
                            <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate mt-0.5">
                              {lastMsg?.content.replace(/[#*`]/g, '').slice(0, 60) || 'Empty thread'}
                            </p>
                          </div>
                        )}

                        {!isEditing && (
                          <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                            <button
                              type="button"
                              onClick={(e) => handleTogglePinConversation(conv.id, e)}
                              title={conv.pinned ? 'Unpin conversation' : 'Pin conversation'}
                              className="p-1 rounded hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-amber-500"
                            >
                              <Pin className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingConvId(conv.id);
                                setEditingConvTitle(conv.title);
                              }}
                              title="Rename conversation"
                              className="p-1 rounded hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDeleteConversation(conv.id, e)}
                              title="Delete conversation"
                              className="p-1 rounded hover:bg-white dark:hover:bg-gray-700 text-gray-400 hover:text-rose-600"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-gray-400 dark:text-gray-500">
                        <span className="inline-flex items-center gap-1 font-medium text-indigo-600 dark:text-indigo-400">
                          🎯{' '}
                          {conv.focusScopes?.includes('all')
                            ? '360° All'
                            : (conv.focusScopes || ['all'])
                                .map(
                                  (s) =>
                                    DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s,
                                )
                                .join(' + ')}
                        </span>
                        <span>
                          {userMsgCount} prompt{userMsgCount === 1 ? '' : 's'} •{' '}
                          {formatRelativeTime(conv.updatedAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {filteredConversations.length === 0 && (
                  <div className="py-8 text-center text-xs text-gray-400">
                    No matching conversations found.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex-1 overflow-hidden flex flex-col">
            <div
              aria-hidden="true"
              className="pointer-events-none select-none absolute inset-0 flex items-center justify-center z-0 overflow-hidden"
            >
              <SpexAvatar className="w-52 h-52 sm:w-80 sm:h-80 md:w-96 md:h-96 opacity-[0.09] dark:opacity-[0.12] transition-opacity" />
            </div>

            <div
              ref={messagesContainerRef}
              className="relative z-10 flex-1 overflow-y-auto px-3 py-3.5 sm:px-5 sm:py-4 space-y-4 scroll-smooth"
              style={{ overscrollBehavior: 'contain' }}
            >
              {messages
                .filter((m) => m.role !== 'system')
                .map((msg, idx) => (
                  <MessageBubble
                    key={idx}
                    msg={msg}
                    idx={idx}
                    onAction={handleAction}
                    onSpeak={handleSpeak}
                    isPlayingAudio={playingAudioIndex === idx}
                    isAudioLoading={audioLoadingIndex === idx}
                  />
                ))}

              {isLoading && (
                <div className="flex items-start gap-2.5 w-full animate-slideIn">
                  <SpexAvatar className="h-7 w-7 mt-0.5 flex-shrink-0" animated />
                  <div className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-[2px] border border-gray-200/80 dark:border-gray-700/70 rounded-2xl rounded-bl-none px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm flex items-center gap-2.5">
                    <TypingDots />
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      Analyzing{' '}
                      {focusScopes.includes('all')
                        ? '360° financial data'
                        : focusScopes
                            .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                            .join(' + ')}
                      …
                    </span>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* ─── Scroll to bottom button ───────────────────────────── */}
        {showScrollBtn && (
          <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-4 sm:bottom-28 z-20 rounded-full bg-indigo-600 dark:bg-indigo-700 text-white p-2 shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all animate-fadeIn"
            title="Scroll to latest"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* ─── Bottom Dock: Suggestion Chips + Input Bar ─────────── */}
        <div className="flex-shrink-0 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-t border-gray-200/80 dark:border-gray-800 px-3 sm:px-5 pt-2 pb-2.5 sm:pb-3 z-20">
          {activeSuggestions.length > 0 && !isLoading && (
            <div className="flex gap-1.5 sm:gap-2 pb-2 overflow-x-auto no-scrollbar">
              {activeSuggestions.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  disabled={isLoading}
                  onClick={() => void handleSend(prompt)}
                  className="whitespace-nowrap rounded-xl border border-indigo-200/80 dark:border-indigo-800/60 bg-indigo-50/50 dark:bg-gray-800/90 px-2.5 py-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100/70 dark:hover:bg-indigo-950/60 transition-colors disabled:opacity-50 flex-shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          {selectedImage && (
            <div className="mb-2 inline-flex items-center gap-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/50 p-1.5 pr-3 text-xs animate-fadeIn shadow-xs">
              <img
                src={selectedImage.previewUrl}
                alt="Receipt preview"
                className="h-10 w-10 rounded-lg object-cover border border-indigo-200 dark:border-indigo-700"
              />
              <div className="flex flex-col">
                <span className="text-[11px] font-semibold text-indigo-900 dark:text-indigo-200 flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-600 dark:text-indigo-400" />
                  Receipt Attached
                </span>
                <span className="text-[10px] text-indigo-600 dark:text-indigo-400">
                  Gemini Vision will extract store &amp; amount
                </span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="ml-1 rounded-full p-1 text-gray-400 hover:bg-white hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200 transition-colors"
                title="Remove image"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <div className="relative flex items-end gap-1.5 sm:gap-2 bg-gray-50 dark:bg-gray-800/90 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all shadow-2xs">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder={
                selectedImage
                  ? 'Add a note about this receipt…'
                  : `Ask Spex (${
                      focusScopes.includes('all')
                        ? '360° Data'
                        : focusScopes
                            .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                            .join(' + ')
                    })…`
              }
              maxLength={charLimit}
              className="flex-1 resize-none bg-transparent pl-3.5 pr-1.5 py-2.5 sm:pl-4 sm:py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none leading-relaxed"
              disabled={isLoading}
              style={{ minHeight: '42px', maxHeight: '130px' }}
            />
            {charsLeft < 400 && (
              <span
                className={cn(
                  'absolute bottom-3 right-[88px] text-[10px] select-none',
                  charsLeft < 50 ? 'text-red-400' : 'text-gray-300 dark:text-gray-600',
                )}
              >
                {charsLeft}
              </span>
            )}
            <div className="flex items-center gap-0.5 sm:gap-1 pr-1.5 pb-1.5 sm:pr-2 sm:pb-2">
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                title="Scan receipt or invoice (Gemini Multimodal Vision)"
                className="p-2 rounded-full transition-all text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                <Camera className="w-4 h-4" />
              </button>

              {voiceSupported && (
                <button
                  type="button"
                  onClick={handleVoice}
                  title={isListening ? 'Stop listening' : 'Voice dictation'}
                  className={cn(
                    'p-2 rounded-full transition-all',
                    isListening
                      ? 'bg-red-100 dark:bg-red-900/30 text-red-500 animate-pulse'
                      : 'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  )}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}

              <button
                type="button"
                onClick={toggleVoiceMode}
                title={
                  isVoiceMode
                    ? 'Voice Mode Active: Spex will automatically read AI replies aloud'
                    : 'Enable Voice Mode: Spex will read replies aloud'
                }
                className={cn(
                  'hidden sm:inline-flex p-2 rounded-full transition-all',
                  isVoiceMode
                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 ring-1 ring-emerald-500/40'
                    : 'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                )}
              >
                {isVoiceMode ? (
                  <Volume2 className="w-4 h-4 animate-pulse" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
              </button>

              <button
                type="button"
                onClick={() => handleSend()}
                disabled={(!input.trim() && !selectedImage) || isLoading}
                className="p-2 rounded-full bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-xs"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="hidden sm:block text-center text-[10px] text-gray-400 dark:text-gray-500 mt-1.5 select-none">
            Powered by Google Gemini • Focus:{' '}
            {focusScopes.includes('all')
              ? 'All 360° Data'
              : focusScopes
                  .map((s) => DATA_FOCUS_SCOPES.find((d) => d.id === s)?.shortLabel || s)
                  .join(' + ')}{' '}
            • Output:{' '}
            {RESPONSE_DEPTH_OPTIONS.find((r) => r.id === responseDepth)?.label || 'Deep & Creative'}
          </p>
        </div>
      </div>

      {/* ─── Gemini Quotas & Model Routing Modal ──────────────────────── */}
      {showQuotaModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="relative w-full max-w-xl max-h-[90vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-white/20 backdrop-blur-xs">
                  <Cpu className="w-5 h-5 text-indigo-100" />
                </div>
                <div>
                  <h3 className="text-base font-bold leading-tight">
                    Gemini Model Routing &amp; Quotas
                  </h3>
                  <p className="text-xs text-indigo-200/90 leading-tight">
                    Smart auto failover, manual switching &amp; real-time quota diagnostics
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/20 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-gray-700 dark:text-gray-300">
              <div className="rounded-xl p-4 bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 space-y-2">
                <div className="flex items-center gap-2 text-indigo-900 dark:text-indigo-200 font-bold text-xs">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>How Gemini Free Tier Quotas Work Across Models</span>
                </div>
                <p className="text-xs leading-relaxed text-indigo-800 dark:text-indigo-300">
                  Google Gemini API quotas (RPD = Requests Per Day, RPM = Requests Per Minute) are{' '}
                  <strong>tracked separately per model</strong>. When Gemini 3.8 Flash hits its 20
                  requests/day limit, <strong>Gemini 3.1 Flash Lite still has 500 requests/day available</strong>!
                </p>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-3">
                  Select Routing Strategy
                </h4>
                <div className="space-y-2">
                  {AVAILABLE_MODELS.map((model) => {
                    const isSelected = selectedModel === model.id;
                    const status = modelStatuses.find((s) => s.id === model.id);
                    const isExhausted = status?.isExhausted;

                    return (
                      <div
                        key={model.id}
                        onClick={() => handleModelChange(model.id)}
                        className={cn(
                          'flex items-start justify-between p-3 rounded-xl border cursor-pointer transition-all',
                          isSelected
                            ? 'bg-indigo-50/70 dark:bg-indigo-950/50 border-indigo-300 dark:border-indigo-700 shadow-xs'
                            : 'bg-gray-50 dark:bg-gray-800/60 border-gray-200 dark:border-gray-700/60 hover:bg-gray-100/70 dark:hover:bg-gray-800',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="radio"
                            name="gemini-model"
                            checked={isSelected}
                            onChange={() => handleModelChange(model.id)}
                            className="mt-1 text-indigo-600 focus:ring-indigo-500"
                          />
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-gray-900 dark:text-white text-xs">
                                {model.name}
                              </span>
                              <span
                                className={cn(
                                  'text-[9px] px-2 py-0.5 rounded-full font-mono font-medium',
                                  isExhausted
                                    ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                                    : 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300',
                                )}
                              >
                                {isExhausted ? '⚠️ Quota Cooldown' : model.badge}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug">
                              {model.description}
                            </p>
                            <span className="inline-block text-[10px] text-indigo-600 dark:text-indigo-400 font-mono mt-1">
                              📊 Quota: {model.quotaSummary}
                            </span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                    Live System Monitor
                  </h4>
                  <button
                    type="button"
                    onClick={handleResetCooldowns}
                    disabled={isResettingCooldowns}
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 font-semibold transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={cn('w-3.5 h-3.5', isResettingCooldowns && 'animate-spin')} />
                    Clear Cooldown Timers
                  </button>
                </div>

                <div className="space-y-2">
                  {modelStatuses.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-700 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={cn(
                            'h-2.5 w-2.5 rounded-full',
                            m.isExhausted ? 'bg-amber-500 animate-pulse' : 'bg-green-500',
                          )}
                        />
                        <span className="font-semibold text-gray-900 dark:text-white">{m.name}</span>
                        <span className="text-[10px] text-gray-400 font-mono">
                          ({m.dailyQuota} req/day)
                        </span>
                      </div>
                      <div>
                        {m.isExhausted ? (
                          <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900/40">
                            Cooldown: {Math.ceil(m.cooldownRemainingSeconds / 60)}m left
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-green-700 dark:text-green-300 bg-green-50 dark:bg-green-950/60 px-2 py-0.5 rounded-full border border-green-200 dark:border-green-900/40">
                            Healthy &amp; Ready
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-200 dark:border-gray-800 flex flex-wrap items-center gap-3">
                <a
                  href="https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Live Quotas on Google Cloud Console
                </a>
                <span className="text-gray-300 dark:text-gray-700">•</span>
                <a
                  href="https://aistudio.google.com/app/plan_information"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Google AI Studio Plan Information
                </a>
              </div>
            </div>

            <div className="px-6 py-3.5 bg-gray-50 dark:bg-gray-800/80 border-t border-gray-200 dark:border-gray-800 flex justify-end">
              <button
                type="button"
                onClick={() => setShowQuotaModal(false)}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
