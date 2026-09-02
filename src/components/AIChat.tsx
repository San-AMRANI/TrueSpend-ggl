import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Send, Loader2, Trash2, Mic, MicOff, Copy, Check, ChevronDown, Sparkles, Bot, Menu, Camera, ImageIcon } from 'lucide-react';
import Markdown from 'react-markdown';

const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;
import { useAuth } from '../context/AuthContext';
import Tesseract from 'tesseract.js';
import { cn } from '../lib/utils';
import { useDashboardData } from '../hooks/useDashboardData';
import { buildAiContextSnapshot } from '../lib/aiContext';

const CHAT_SESSION_STORAGE_KEY = 'truespend_chat_session';
const QUICK_PROMPTS = [
  '💰 What can I safely spend today?',
  '📊 How am I doing this month?',
  '🎯 Where can I cut spending?',
  '📅 When is my next payday?',
];

// Contextual fallback suggestions when AI doesn't provide them
const FALLBACK_SUGGESTIONS = [
  'How am I doing this month?',
  'What are my biggest expenses?',
  'Show me my daily allowance',
];

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

interface AiAction { type: string; summary: string; parameters: Record<string, unknown>; }
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: AiAction[];
  actionStatus?: 'approved' | 'rejected';
  suggestions?: string[];
  timestamp: number;
  imageUrl?: string;
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
}: {
  msg: Message;
  idx: number;
  onAction: (index: number, approve: boolean) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [relTime, setRelTime] = useState(() => formatRelativeTime(msg.timestamp));
  const isUser = msg.role === 'user';

  // Update relative time every 30 seconds
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
        <div className="flex items-center gap-1.5 ml-1 mb-0.5">
          <div className="h-5 w-5 rounded-full bg-indigo-600 dark:bg-indigo-700 flex items-center justify-center flex-shrink-0 overflow-hidden">
            <img src={appIconSrc} alt="Spex" className="w-3.5 h-3.5 object-contain" />
          </div>
          <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">Spex</span>
        </div>
      )}

      <div className={cn('flex gap-2 max-w-[88%]', isUser ? 'flex-row-reverse' : 'flex-row')}>
        <div
          className={cn(
            'relative rounded-2xl px-4 py-3 shadow-sm text-sm leading-relaxed',
            isUser
              ? 'bg-indigo-600 dark:bg-indigo-700 text-white rounded-br-none'
              : 'bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700/60 rounded-bl-none',
          )}
        >
          {isUser ? (
            <div className="flex flex-col gap-2">
              {msg.imageUrl && (
                <img
                  src={msg.imageUrl}
                  alt="Receipt preview"
                  className="rounded-lg max-h-40 w-auto object-contain border border-white/30"
                />
              )}
              {msg.content && <span className="whitespace-pre-wrap">{msg.content}</span>}
            </div>
          ) : (
            <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 prose-p:leading-relaxed prose-p:my-1 prose-pre:text-gray-800 dark:prose-pre:text-gray-200 prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900 prose-strong:text-indigo-800 dark:prose-strong:text-indigo-300 prose-headings:text-indigo-900 dark:prose-headings:text-indigo-300 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400 prose-ul:my-1 prose-li:my-0">
              <Markdown>{msg.content}</Markdown>
            </div>
          )}

          {/* Copy button — assistant messages */}
          {!isUser && (
            <button
              onClick={handleCopy}
              title="Copy message"
              className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-full p-1 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600"
            >
              {copied ? (
                <Check className="w-3 h-3 text-green-500" />
              ) : (
                <Copy className="w-3 h-3 text-gray-400 dark:text-gray-300" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Action proposal panel */}
      {!isUser && msg.actions && msg.actions.length > 0 && (
        <div className="ml-7 mt-1 rounded-xl border border-indigo-200 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/40 p-3 max-w-[88%] animate-fadeIn">
          <p className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-400 mb-1.5 flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Proposed action{msg.actions.length > 1 ? 's' : ''}
          </p>
          {msg.actions.map((action, actionIndex) => (
            <p key={actionIndex} className="text-[11px] text-indigo-800 dark:text-indigo-200 mb-0.5">
              • {action.summary}
            </p>
          ))}
          {!msg.actionStatus ? (
            <div className="mt-2.5 flex gap-2">
              <button
                onClick={() => onAction(idx, true)}
                className="rounded-lg bg-indigo-600 dark:bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-700 dark:hover:bg-indigo-500 transition-colors"
              >
                ✅ Approve
              </button>
              <button
                onClick={() => onAction(idx, false)}
                className="rounded-lg border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 px-3 py-1.5 text-[11px] font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/50 transition-colors"
              >
                ✕ Reject
              </button>
            </div>
          ) : (
            <p className={cn('mt-2 text-[11px] font-semibold', msg.actionStatus === 'approved' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400')}>
              {msg.actionStatus === 'approved' ? '✅ Approved and applied.' : '✕ Rejected — no changes made.'}
            </p>
          )}
        </div>
      )}

      {/* Timestamp */}
      <span className={cn('text-[10px] text-gray-300 dark:text-gray-600 select-none', isUser ? 'mr-1' : 'ml-8')}>
        {relTime}
      </span>
    </div>
  );
}

export function AIChat({ onDataChange }: AIChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('truespend_chat_history_v2');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    return [
      {
        role: 'assistant',
        content: "Hey there! 👋 I'm **Spex**, your TrueSpend financial assistant.\n\nI know your finances inside out — ask me anything, from checking your daily allowance to logging a transaction or analyzing your spending patterns. What can I help you with?",
        timestamp: Date.now(),
        suggestions: QUICK_PROMPTS.map(p => p.replace(/^[^\s]+\s/, '')),
      },
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatSessionId] = useState(getChatSessionId);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isOcrLoading, setIsOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [voiceSupported] = useState(() => 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { token } = useAuth();

  const {
    kpis,
    transactions,
    debts,
    budgets,
    emergencyBuffer,
    payrolls,
    fetchData,
  } = useDashboardData(token);

  const aiContext = useMemo(
    () => buildAiContextSnapshot({ kpis, transactions, debts, budgets, emergencyBuffer, payrolls }),
    [kpis, transactions, debts, budgets, emergencyBuffer, payrolls],
  );

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
    localStorage.setItem('truespend_chat_history_v2', JSON.stringify(messages));
  }, [messages]);

  // Track scroll position to show/hide scroll-to-bottom button
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onScroll = () => {
      const distFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
      setShowScrollBtn(distFromBottom > 100);
    };
    container.addEventListener('scroll', onScroll, { passive: true });
    return () => container.removeEventListener('scroll', onScroll);
  }, []);

  const handleReset = () => {
    if (confirm('Clear the chat history?')) {
      setMessages([{
        role: 'assistant',
        content: "Hey there! 👋 I'm **Spex**, your TrueSpend financial assistant. Fresh start — what can I help you with?",
        timestamp: Date.now(),
        suggestions: QUICK_PROMPTS.map(p => p.replace(/^[^\s]+\s/, '')),
      }]);
    }
  };

  const handleSend = async (
  draft = input,
  options: { imageUrl?: string; content?: string; skipUserMessage?: boolean } = {},
) => {
    const content = (options.content ?? draft).trim();
    if (!content || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content,
      timestamp: Date.now(),
      imageUrl: options.imageUrl,
    };
    if (!options.skipUserMessage) {
      setMessages((prev) => [...prev, userMsg]);
    }
    setInput('');
    setIsLoading(true);

    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }

    try {
      const apiMessages = [...messages, userMsg]
        .filter(m => m.role !== 'system')
        .slice(-10)
        .map(({ role, content: messageContent }) => ({ role, content: messageContent.slice(0, 1400) }));

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          messages: apiMessages,
          contextData: aiContext,
          sessionId: chatSessionId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to get response');
      }

      const data = await response.json();
      if (data.reply) {
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: data.reply,
            actions: data.actions || [],
            suggestions: data.suggestions?.length ? data.suggestions : FALLBACK_SUGGESTIONS,
            timestamp: Date.now(),
          },
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: "I'm sorry, I didn't get a proper response. Please try again.", timestamp: Date.now() },
        ]);
      }
    } catch (error: any) {
      console.error('Chat error:', error);
      const errorMessage =
        error.message && error.message !== 'Failed to fetch'
          ? `⚠️ ${error.message}`
          : '⚠️ Sorry, I ran into an error. Please try again.';
      setMessages(prev => [...prev, { role: 'assistant', content: errorMessage, timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (index: number, approve: boolean) => {
    const message = messages[index];
    if (!message.actions?.length) return;
    if (!approve) {
      setMessages(prev => prev.map((item, i) => (i === index ? { ...item, actionStatus: 'rejected' } : item)));
      return;
    }
    try {
      const response = await fetch('/api/chat/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ actions: message.actions }),
      });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Action could not be completed');
      }
      await fetchData();
      onDataChange?.();
      setMessages(prev => prev.map((item, i) => (i === index ? { ...item, actionStatus: 'approved' } : item)));
    } catch (error: any) {
      console.error(error);
      alert(error.message || 'The action could not be completed.');
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
    // Auto-grow textarea up to 5 lines
    const ta = e.target;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  };

  /**
   * Handles a receipt image upload.
   * Flow: read file -> show in conversation as user message -> run OCR (Tesseract)
   *       -> ask server to parse structured fields -> if confident, ask Spex to propose
   *       a transaction; if not, show the OCR text so the user can confirm / correct.
   */
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Please upload an image file (JPG, PNG, or HEIC).',
          timestamp: Date.now(),
        },
      ]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Read the image into a data URL so we can preview it in the conversation.
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    }).catch((err) => {
      console.error('FileReader error:', err);
      return '';
    });

    if (!imageUrl) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ I could not read that image file. Please try a different one.',
          timestamp: Date.now(),
        },
      ]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsOcrLoading(true);
    setOcrStatus('Preparing OCR…');

    try {
      // Run Tesseract in the browser. eng+fra covers most receipts in MA.
      const result = await Tesseract.recognize(file, 'eng+fra', {
        logger: (m: any) => {
          if (m.status) setOcrStatus(`${m.status}${m.progress != null ? ` ${Math.round(m.progress * 100)}%` : ''}`);
        },
      });

      const ocrText = (result?.data?.text || '').trim();
      const signalChars = [...ocrText].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;

      // If OCR produced basically nothing, surface that to the user clearly.
      if (!ocrText || ocrText.length < 12 || signalChars < 5) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: '📷 Receipt image', timestamp: Date.now(), imageUrl },
          {
            role: 'assistant',
            content:
              "I couldn't read any text from that image. The photo may be too dark, blurry, or at an awkward angle. Please try again with a sharper, well-lit photo, or type the transaction manually.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Ask the backend to parse the OCR text into structured fields.
      const parseResponse = await fetch('/api/receipts/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: ocrText }),
      });

      if (!parseResponse.ok) {
        const errData = await parseResponse.json().catch(() => ({} as any));
        throw new Error(errData.error || `Receipt parsing failed (${parseResponse.status}).`);
      }

      const parsedData = await parseResponse.json().catch(() => ({} as any));
      const proposal = parsedData?.proposal;

      // Always show the user image so they have feedback something happened.
      const userCaption = `📷 Receipt image${proposal?.merchant ? ` — ${proposal.merchant}` : ''}`;

      if (!proposal || proposal.amount === null || proposal.confidence < 60) {
        // Low confidence — show the OCR text so the user can correct/edit instead.
        const previewSnippet = ocrText.length > 600 ? `${ocrText.slice(0, 600)}…` : ocrText;
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: userCaption, timestamp: Date.now(), imageUrl },
          {
            role: 'assistant',
            content:
              `I read the receipt but couldn't reliably extract the totals. Here is what I got — feel free to confirm the amounts or type them manually.\n\n` +
              `\`\`\`\n${previewSnippet}\n\`\`\``,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // High-confidence parse: send a structured prompt to Spex.
      const proposalSummary = JSON.stringify({
        amount: proposal.amount,
        currency: proposal.currency,
        merchant: proposal.merchant,
        date: proposal.date,
        category: proposal.category,
        wallet: proposal.wallet,
        confidence: proposal.confidence,
        notes: proposal.notes,
      });
      const ocrPrompt =
        `I uploaded a receipt. Review the parsed proposal below against the OCR text and propose a transaction ` +
        `only if it matches. Use the OCR text as the source of truth when in doubt.\n\n` +
        `Parsed proposal: ${proposalSummary}\n\n` +
        `OCR text:\n${ocrText.slice(0, 1500)}`;

      // Show the user the image we received, then let Spex respond to the structured prompt.
      // We've already pushed the user-facing image message, so skip the duplicate user bubble.
      setMessages((prev) => [...prev, { role: 'user', content: userCaption, timestamp: Date.now(), imageUrl }]);
      await handleSend(ocrPrompt, { skipUserMessage: true });
    } catch (err: any) {
      console.error('OCR / parse error:', err);
      const reason = err?.message || 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            `⚠️ I had trouble reading that receipt (${reason}). Please try a clearer image or enter the transaction manually.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsOcrLoading(false);
      setOcrStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Voice input
  
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ Please upload an image file (JPG, PNG, or HEIC).',
          timestamp: Date.now(),
        },
      ]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Read the image into a data URL so we can preview it in the conversation.
    const imageUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('Failed to read image file.'));
      reader.readAsDataURL(file);
    }).catch((err) => {
      console.error('FileReader error:', err);
      return '';
    });

    if (!imageUrl) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: '⚠️ I could not read that image file. Please try a different one.',
          timestamp: Date.now(),
        },
      ]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setIsOcrLoading(true);
    setOcrStatus('Preparing OCR…');

    try {
      // Run Tesseract in the browser. eng+fra covers most receipts in MA.
      const result = await Tesseract.recognize(file, 'eng+fra', {
        logger: (m: any) => {
          if (m.status) setOcrStatus(`${m.status}${m.progress != null ? ` ${Math.round(m.progress * 100)}%` : ''}`);
        },
      });

      const ocrText = (result?.data?.text || '').trim();
      const signalChars = [...ocrText].filter((c) => /[\p{L}\p{N}]/u.test(c)).length;

      // If OCR produced basically nothing, surface that to the user clearly.
      if (!ocrText || ocrText.length < 12 || signalChars < 5) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: '📷 Receipt image', timestamp: Date.now(), imageUrl },
          {
            role: 'assistant',
            content:
              "I couldn't read any text from that image. The photo may be too dark, blurry, or at an awkward angle. Please try again with a sharper, well-lit photo, or type the transaction manually.",
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // Ask the backend to parse the OCR text into structured fields.
      const parseResponse = await fetch('/api/receipts/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ text: ocrText }),
      });

      if (!parseResponse.ok) {
        const errData = await parseResponse.json().catch(() => ({} as any));
        throw new Error(errData.error || `Receipt parsing failed (${parseResponse.status}).`);
      }

      const parsedData = await parseResponse.json().catch(() => ({} as any));
      const proposal = parsedData?.proposal;

      // Always show the user image so they have feedback something happened.
      const userCaption = `📷 Receipt image${proposal?.merchant ? ` — ${proposal.merchant}` : ''}`;

      if (!proposal || proposal.amount === null || proposal.confidence < 60) {
        // Low confidence — show the OCR text so the user can correct/edit instead.
        const previewSnippet = ocrText.length > 600 ? `${ocrText.slice(0, 600)}…` : ocrText;
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: userCaption, timestamp: Date.now(), imageUrl },
          {
            role: 'assistant',
            content:
              `I read the receipt but couldn't reliably extract the totals. Here is what I got — feel free to confirm the amounts or type them manually.\n\n` +
              `\`\`\`\n${previewSnippet}\n\`\`\``,
            timestamp: Date.now(),
          },
        ]);
        return;
      }

      // High-confidence parse: send a structured prompt to Spex.
      const proposalSummary = JSON.stringify({
        amount: proposal.amount,
        currency: proposal.currency,
        merchant: proposal.merchant,
        date: proposal.date,
        category: proposal.category,
        wallet: proposal.wallet,
        confidence: proposal.confidence,
        notes: proposal.notes,
      });
      const ocrPrompt =
        `I uploaded a receipt. Review the parsed proposal below against the OCR text and propose a transaction ` +
        `only if it matches. Use the OCR text as the source of truth when in doubt.\n\n` +
        `Parsed proposal: ${proposalSummary}\n\n` +
        `OCR text:\n${ocrText.slice(0, 1500)}`;

      // Show the user the image we received, then let Spex respond to the structured prompt.
      // We've already pushed the user-facing image message, so skip the duplicate user bubble.
      setMessages((prev) => [...prev, { role: 'user', content: userCaption, timestamp: Date.now(), imageUrl }]);
      await handleSend(ocrPrompt, { skipUserMessage: true });
    } catch (err: any) {
      console.error('OCR / parse error:', err);
      const reason = err?.message || 'Unknown error';
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content:
            `⚠️ I had trouble reading that receipt (${reason}). Please try a clearer image or enter the transaction manually.`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsOcrLoading(false);
      setOcrStatus('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };


  const handleVoice = useCallback(() => {
    if (!voiceSupported) return;
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

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
      setInput(prev => prev + (prev ? ' ' : '') + transcript);
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
  }, [isListening, voiceSupported]);

  // Get the last assistant message for suggestions
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === 'assistant');
  const activeSuggestions = messages.length <= 1
    ? QUICK_PROMPTS
    : (lastAssistantMsg?.suggestions ?? []);

  const charLimit = 500;
  const charsLeft = charLimit - input.length;

  return (
    <>
      {/* Inject keyframe animations */}
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

      {/*
        On mobile: fixed full-screen overlay covering everything (header + nav).
        On desktop (sm+): normal flow card.
      */}
      <div className={cn(
        // Mobile: fixed full-screen overlay
        'fixed inset-0 z-[60] flex flex-col bg-gray-50 dark:bg-gray-950',
        // Desktop: normal contained layout
        'sm:static sm:z-auto sm:rounded-xl sm:shadow-sm sm:border sm:border-gray-200 sm:dark:border-gray-700/60 sm:overflow-hidden sm:h-[calc(100vh-10rem)] sm:min-h-[500px]',
      )}>

        {/* ─── Mobile compact header ─────────────────────────────── */}
        <div className="sm:hidden flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-gray-900/90 backdrop-blur-sm border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('truespend:openSidebar'))}
              title="Open menu"
              className="p-1.5 -ml-1.5 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:text-white dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-sm p-1.5">
              <img src={appIconSrc} alt="Spex" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900 dark:text-white leading-tight">Spex</p>
              <p className="text-[10px] text-indigo-500 dark:text-indigo-400 leading-tight">TrueSpend AI</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            title="Clear chat"
            className="p-2 rounded-full text-gray-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Desktop header ────────────────────────────────────── */}
        <div className="hidden sm:flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-800 dark:to-purple-900 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-white/20 flex items-center justify-center p-1.5">
              <img src={appIconSrc} alt="Spex" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white leading-tight">Spex</p>
              <p className="text-[10px] text-indigo-200 leading-tight">TrueSpend AI Assistant</p>
            </div>
          </div>
          <button
            onClick={handleReset}
            title="Clear chat"
            className="p-1.5 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        {/* ─── Messages ──────────────────────────────────────────── */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto px-3 py-4 sm:px-5 space-y-3 scroll-smooth"
          style={{ overscrollBehavior: 'contain' }}
        >
          {messages.filter(m => m.role !== 'system').map((msg, idx) => (
            <MessageBubble key={idx} msg={msg} idx={idx} onAction={handleAction} />
          ))}

          {isLoading && (
            <div className="flex items-start gap-2 animate-slideIn">
              <div className="h-5 w-5 rounded-full bg-indigo-600 dark:bg-indigo-700 flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                <img src={appIconSrc} alt="Spex" className="w-3.5 h-3.5 object-contain" />
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700/60 rounded-2xl rounded-bl-none px-4 py-3 shadow-sm">
                <TypingDots />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* ─── Scroll to bottom button ───────────────────────────── */}
        {showScrollBtn && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-24 right-4 sm:bottom-24 z-10 rounded-full bg-indigo-600 dark:bg-indigo-700 text-white p-2 shadow-lg hover:bg-indigo-700 dark:hover:bg-indigo-600 transition-all animate-fadeIn"
            title="Scroll to latest"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}

        {/* ─── Suggestion chips ──────────────────────────────────── */}
        {activeSuggestions.length > 0 && !isLoading && (
          <div className="flex gap-2 px-3 sm:px-5 pb-2 overflow-x-auto no-scrollbar flex-shrink-0">
            {activeSuggestions.map((prompt) => (
              <button
                key={prompt}
                type="button"
                disabled={isLoading}
                onClick={() => void handleSend(prompt)}
                className="whitespace-nowrap rounded-full border border-indigo-200 dark:border-indigo-700/60 bg-white dark:bg-gray-800/80 px-3 py-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 transition-colors disabled:opacity-50 flex-shrink-0 shadow-sm"
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* ─── Input bar ─────────────────────────────────────────── */}
        <div className="flex-shrink-0 px-3 sm:px-5 pb-3 pt-2 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm border-t border-gray-100 dark:border-gray-800">
          <div className="relative flex items-end gap-2 bg-gray-50 dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 focus-within:border-indigo-400 dark:focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all shadow-sm">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={handleTextareaInput}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your finances…"
              maxLength={charLimit}
              className="flex-1 resize-none bg-transparent pl-4 pr-2 py-3 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none leading-relaxed"
              disabled={isLoading}
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
            {/* Character counter — shows when approaching limit */}
            {charsLeft < 100 && (
              <span className={cn(
                'absolute bottom-3 right-[88px] text-[10px] select-none',
                charsLeft < 20 ? 'text-red-400' : 'text-gray-300 dark:text-gray-600',
              )}>
                {charsLeft}
              </span>
            )}
            <div className="flex items-center gap-1 pr-2 pb-2">
<<<<<<< HEAD
              
              <input 
                type="file" 
                accept="image/*" 
                ref={fileInputRef} 
                className="hidden" 
                onChange={handleFileUpload} 
=======
              {/* Receipt scanner (OCR) */}
              <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
>>>>>>> 559b367 (fix(ocr): wire up missing /api/receipts/parse endpoint and add tesseract.js)
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isOcrLoading || isLoading}
<<<<<<< HEAD
                title="Scan receipt (OCR)"
                className={cn(
                  'p-2 rounded-full transition-all text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  isOcrLoading && 'opacity-50 animate-pulse'
=======
                title={isOcrLoading ? ocrStatus || 'Scanning receipt…' : 'Scan receipt (OCR)'}
                className={cn(
                  'p-2 rounded-full transition-all',
                  'text-gray-400 dark:text-gray-500 hover:text-indigo-500 dark:hover:text-indigo-400 hover:bg-gray-100 dark:hover:bg-gray-700',
                  isOcrLoading && 'text-indigo-500 dark:text-indigo-400 animate-pulse',
>>>>>>> 559b367 (fix(ocr): wire up missing /api/receipts/parse endpoint and add tesseract.js)
                )}
              >
                {isOcrLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
<<<<<<< HEAD
              
=======

>>>>>>> 559b367 (fix(ocr): wire up missing /api/receipts/parse endpoint and add tesseract.js)
              {/* Voice button */}

              {voiceSupported && (
                <button
                  onClick={handleVoice}
                  title={isListening ? 'Stop listening' : 'Voice input'}
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
              {/* Send button */}
              <button
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-2 rounded-full bg-indigo-600 dark:bg-indigo-700 text-white hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          <p className="text-center text-[10px] text-gray-300 dark:text-gray-600 mt-1.5 select-none">
            {isOcrLoading
              ? `📷 ${ocrStatus || 'Scanning receipt…'}`
              : 'Spex can make mistakes — always verify important figures.'}
          </p>
        </div>
      </div>
    </>
  );
}
