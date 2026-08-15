import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';

const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useDashboardData } from '../hooks/useDashboardData';

interface AiAction { type: string; summary: string; parameters: Record<string, unknown>; }
interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
  actions?: AiAction[];
  actionStatus?: 'approved' | 'rejected';
}

interface AIChatProps {
  onDataChange?: () => void;
}

export function AIChat({ onDataChange }: AIChatProps = {}) {
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem('truespend_chat_history');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse chat history', e);
      }
    }
    return [
      { role: 'assistant', content: 'Hi! I am the TrueSpend AI Assistant. How can I help you with your finances today?' }
    ];
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { token } = useAuth();
  
  // Get dashboard data to use as context
  const { 
    kpis, 
    transactions, 
    debts, 
    budgets,
    emergencyBuffer,
    payday,
    fetchData
  } = useDashboardData(token);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    localStorage.setItem('truespend_chat_history', JSON.stringify(messages));
  }, [messages]);

  const handleReset = () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      setMessages([{ role: 'assistant', content: 'Hi! I am the TrueSpend AI Assistant. How can I help you with your finances today?' }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;
    
    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      // Create api messages array
      const apiMessages = [...messages, userMsg].filter(m => m.role !== 'system');
      
      const contextData = {
        kpis,
        transactions,
        debts,
        budgets,
        emergencyBuffer,
        payday
      };

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          messages: apiMessages,
          contextData
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      if (data.reply) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.reply, actions: data.actions || [] }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: 'I am sorry, I did not receive a proper response.' }]);
      }
    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error. Please try again later.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAction = async (index: number, approve: boolean) => {
    const message = messages[index];
    if (!message.actions?.length) return;
    if (!approve) { setMessages(prev => prev.map((item, i) => i === index ? { ...item, actionStatus: 'rejected' } : item)); return; }
    try {
      const response = await fetch('/api/chat/actions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ actions: message.actions }) });
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Action could not be completed');
      }
      await fetchData();
      onDataChange?.();
      setMessages(prev => prev.map((item, i) => i === index ? { ...item, actionStatus: 'approved' } : item));
    } catch (error: any) { console.error(error); alert(error.message || 'The approved action could not be completed. No further actions were run.'); }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-transparent sm:rounded-lg overflow-visible flex flex-col h-[calc(100vh-10rem)] min-h-[400px] m-0 p-0 relative">
      
      {/* Mobile Absolute Delete Button */}
      <button onClick={handleReset} className="sm:hidden absolute top-2 right-2 text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 z-10 bg-white/80 dark:bg-gray-800/80 rounded-full shadow-sm" title="Clear Chat">
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Header (Desktop Only) */}
      <div className="hidden sm:flex bg-indigo-600 dark:bg-indigo-900 text-white p-4 items-center justify-between shrink-0 sm:rounded-t-lg">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">TrueSpend AI Assistant</h2>
        </div>
        <button onClick={handleReset} className="text-white hover:text-indigo-200 transition-colors p-1" title="Clear Chat">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-0 py-2 bg-transparent space-y-2">
        {messages.filter(m => m.role !== 'system').map((msg, idx) => (
          <div 
            key={idx} 
            className={cn(
              msg.role === 'user' ? "ml-auto justify-end flex max-w-[85%]" : "mr-auto justify-start "
            )}
          >
            <div 
              className={cn(
                "rounded-2xl px-5 py-3 shadow-sm",
                msg.role === 'user' 
                  ? "bg-indigo-600 dark:bg-indigo-800 text-white rounded-br-none whitespace-pre-wrap" 
                  : "bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 border border-gray-100 dark:border-gray-700 rounded-bl-none"
              )}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="prose prose-sm max-w-none text-gray-800 dark:text-gray-200 prose-p:leading-relaxed prose-pre:text-gray-800 dark:prose-pre:text-gray-200 prose-pre:bg-gray-50 dark:prose-pre:bg-gray-900 prose-strong:text-indigo-900 dark:prose-strong:text-indigo-300 prose-headings:text-indigo-900 dark:prose-headings:text-indigo-300 prose-headings:font-semibold prose-a:text-indigo-600 dark:prose-a:text-indigo-400">
                  <Markdown>{msg.content}</Markdown>
                </div>
              )}
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && <div className="mt-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 p-3"><p className="text-xs font-semibold text-indigo-900 dark:text-indigo-300">Proposed action{msg.actions.length > 1 ? 's' : ''}</p>{msg.actions.map((action, actionIndex) => <p key={actionIndex} className="mt-1 text-xs text-indigo-800 dark:text-indigo-200">• {action.summary}</p>)}{!msg.actionStatus ? <div className="mt-3 flex gap-2"><button onClick={() => handleAction(idx, true)} className="rounded bg-indigo-600 dark:bg-indigo-700 px-3 py-1.5 text-xs font-medium text-white hover:dark:bg-indigo-600">Approve</button><button onClick={() => handleAction(idx, false)} className="rounded border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-indigo-950 px-3 py-1.5 text-xs font-medium text-indigo-800 dark:text-indigo-300 hover:dark:bg-indigo-900/50">Reject</button></div> : <p className="mt-3 text-xs font-semibold text-indigo-800 dark:text-indigo-300">{msg.actionStatus === 'approved' ? 'Approved and completed.' : 'Rejected — no changes made.'}</p>}</div>}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex max-w-[80%] mr-auto">
            <div className="bg-white dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600 dark:text-indigo-400" />
              <span className="text-gray-500 dark:text-gray-400">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="relative flex items-center max-w-4xl mx-auto w-full shrink-0">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask about your budget, spending..."
          className="w-full pl-6 pr-14 py-4 rounded-full border border-gray-200 dark:border-gray-700 focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-400 bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors shadow-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="absolute right-3 p-3 bg-indigo-600 dark:bg-indigo-700 text-white rounded-full hover:bg-indigo-700 dark:hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
