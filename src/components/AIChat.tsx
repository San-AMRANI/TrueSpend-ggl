import React, { useState, useRef, useEffect } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import Markdown from 'react-markdown';

const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;
import { useAuth } from '../context/AuthContext';
import { cn } from '../lib/utils';
import { useDashboardData } from '../hooks/useDashboardData';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export function AIChat() {
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
    payday
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
      
      if (data.choices && data.choices.length > 0) {
        const aiContent = data.choices[0].message.content;
        setMessages(prev => [...prev, { role: 'assistant', content: aiContent }]);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-transparent sm:rounded-lg overflow-visible flex flex-col h-[calc(100vh-10rem)] min-h-[400px] m-0 p-0 relative">
      
      {/* Mobile Absolute Delete Button */}
      <button onClick={handleReset} className="sm:hidden absolute top-2 right-2 text-gray-400 hover:text-red-500 transition-colors p-2 z-10 bg-white/80 rounded-full shadow-sm" title="Clear Chat">
        <Trash2 className="w-5 h-5" />
      </button>

      {/* Header (Desktop Only) */}
      <div className="hidden sm:flex bg-indigo-600 text-white p-4 items-center justify-between shrink-0 sm:rounded-t-lg">
        <div className="flex items-center space-x-2">
          <h2 className="text-lg font-semibold">TrueSpend AI Assistant</h2>
        </div>
        <button onClick={handleReset} className="text-white hover:text-indigo-200 transition-colors p-1" title="Clear Chat">
          <Trash2 className="w-5 h-5" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-0 py-2 bg-transparent">
        {messages.filter(m => m.role !== 'system').map((msg, idx) => (
          <div 
            key={idx} 
            className={cn(
              "flex max-w-[85%]",
              msg.role === 'user' ? "ml-auto justify-end" : "mr-auto justify-start"
            )}
          >
            <div 
              className={cn(
                "rounded-2xl px-5 py-3 shadow-sm",
                msg.role === 'user' 
                  ? "bg-indigo-600 text-white rounded-br-none whitespace-pre-wrap" 
                  : "bg-white text-gray-800 border border-gray-100 rounded-bl-none"
              )}
            >
              {msg.role === 'user' ? (
                msg.content
              ) : (
                <div className="prose prose-sm max-w-none text-gray-800 prose-p:leading-relaxed prose-pre:bg-gray-50 prose-pre:text-gray-800 prose-strong:text-indigo-900 prose-headings:text-indigo-900 prose-headings:font-semibold prose-a:text-indigo-600">
                  <Markdown>{msg.content}</Markdown>
                </div>
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex max-w-[80%] mr-auto">
            <div className="bg-white border border-gray-100 rounded-2xl rounded-bl-none px-5 py-3 shadow-sm flex items-center space-x-3">
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              <span className="text-gray-500">Thinking...</span>
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
          className="w-full pl-6 pr-14 py-4 rounded-full border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-gray-50 transition-colors shadow-sm"
          disabled={isLoading}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || isLoading}
          className="absolute right-3 p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
