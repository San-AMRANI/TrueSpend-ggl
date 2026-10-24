import { initGoogleAuth } from './lib/googleAuth';
import React from 'react';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Button } from './components/ui/Button';
import Dashboard from './components/Dashboard';
import { DesktopHeaderNav } from './components/dashboard/DesktopHeaderNav';
import type { DashboardTab } from './types';
import { Menu, X, LayoutDashboard, ArrowRightLeft, Users, BarChart2, FileText, Settings, Calculator, WalletCards, CalendarDays, Bot, ClipboardCheck, FileBarChart, ShieldCheck, Repeat, Target, TrendingUp, Coins, Sparkles, Search, Map } from 'lucide-react';

import { SpexAvatar } from './components/common/SpexAvatar';

const logoSrc = `${(import.meta as any).env?.BASE_URL || '/'}logo-1.png`;
const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;

const SpexNavIcon: React.FC<{ className?: string }> = ({ className = 'h-5 w-5' }) => (
  <span className={`inline-flex items-center justify-center shrink-0 ${className}`}>
    <SpexAvatar className="w-full h-full" />
  </span>
);


function AppContent() {
  const { user, loading, signIn, switchUserSession } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  const handleSelectTab = (tab: DashboardTab) => {
    setActiveTab(tab);
    window.dispatchEvent(new CustomEvent('truespend:setTab', { detail: tab }));
  };

  useEffect(() => {
    const cleanup = initGoogleAuth();
    const handleOpen = () => setIsSidebarOpen(true);
    window.addEventListener('truespend:openSidebar', handleOpen);
    return () => {
      cleanup && cleanup();
      window.removeEventListener('truespend:openSidebar', handleOpen);
    };
  }, []);

  const tabs: { id: DashboardTab; label: string; icon: any }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'investments', label: 'Stocks & Equities', icon: TrendingUp },
    { id: 'forecast', label: 'Predictive Forecast', icon: Sparkles },
    { id: 'calculators', label: 'Calculators & Simulators', icon: Calculator },
    { id: 'calendar', label: 'Calendar & Cash Flow', icon: CalendarDays },
    { id: 'analytics', label: 'Analytics', icon: BarChart2 },
    { id: 'transactions', label: 'Transactions', icon: ArrowRightLeft },
    { id: 'budgets', label: 'Budgets', icon: WalletCards },
    { id: 'contexts', label: 'Contexts', icon: Map },
    { id: 'subscriptions', label: 'Subscriptions', icon: Repeat },
    { id: 'goals', label: 'Goals', icon: Target },
    { id: 'debts', label: 'Debts & Splits', icon: Users },
    { id: 'reports', label: 'Reports & Retrospective', icon: FileBarChart },
    { id: 'users', label: 'Users & Roles', icon: ShieldCheck },
    { id: 'settings', label: 'Settings', icon: Settings },
    { id: 'chat', label: 'Spex AI Chat', icon: SpexNavIcon },
  ];

  // On mobile, hide the top header when the chat tab is active so the chat
  // can use the full viewport height as a fixed overlay.
  const isChatOnMobile = activeTab === 'chat';

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setIsSubmitting(true);
    
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      
      signIn(data.token, data.user);
    } catch (err: any) {
      setLoginError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
        <header className="sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <div className="flex items-center gap-2 shrink-0">
              <button disabled className="md:hidden p-1.5 -ml-1.5 rounded-md text-gray-400">
                <Menu className="h-5 w-5" />
              </button>
              <img src={appIconSrc} alt="TrueSpend Logo" className="h-8 w-8 opacity-50" />
              <span className="text-lg font-bold tracking-tight text-gray-400">TrueSpend</span>
            </div>
            <div className="hidden sm:flex items-center gap-4">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="h-8 w-20 rounded bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
              ))}
            </div>
          </div>
        </header>
        <main className="mx-auto min-w-0 max-w-7xl p-3 sm:p-6 lg:p-8">
          <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[1, 2, 3, 4].map(i => (
                <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
              ))}
            </div>
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 h-96 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
              <div className="h-96 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mb-8">
            <img src={appIconSrc} alt="TrueSpend Logo" className="mx-auto h-16 w-16" />
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">Welcome to TrueSpend</h1>
          <p className="mb-8 text-gray-500 dark:text-gray-400">Log in to track your true economic consumption.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username or Email</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username or email address"
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 dark:border-gray-700 dark:bg-gray-800 dark:text-white shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-600 dark:text-red-400">{loginError}</p>}
            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {user?.impersonatedBy && activeTab !== 'users' && activeTab !== 'settings' && (
        <div className="bg-amber-500 text-amber-950 px-4 py-1.5 text-xs font-medium flex items-center justify-between gap-3">
          <div className="truncate">
            Previewing session as <strong>{user.displayName || user.username}</strong> ({(user.role || 'member').toUpperCase()})
          </div>
          <button
            type="button"
            onClick={() => user.impersonatedBy && switchUserSession(user.impersonatedBy.id)}
            className="px-2.5 py-0.5 rounded bg-amber-950 text-amber-100 hover:bg-amber-900 font-semibold shrink-0 transition-colors"
          >
            Return to Owner
          </button>
        </div>
      )}
      {/* Header — hidden on mobile when the chat tab is active (chat becomes a full-screen overlay) */}
      <header className={`sticky top-0 z-30 border-b border-gray-200 dark:border-gray-800 bg-white/95 dark:bg-gray-900/95 backdrop-blur-md px-4 py-2.5 sm:px-6 lg:px-8 ${isChatOnMobile ? 'hidden sm:block' : ''}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
          <div className="flex items-center gap-2 shrink-0">
            <button className="md:hidden p-1.5 -ml-1.5 rounded-md text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800" onClick={() => setIsSidebarOpen(true)}>
              <Menu className="h-5 w-5" />
            </button>
            <img src={appIconSrc} alt="TrueSpend Logo" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">TrueSpend</span>
          </div>
          <div className="flex items-center gap-2">
            <DesktopHeaderNav activeTab={activeTab} onSelectTab={handleSelectTab} />
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent('truespend:openCommandPalette'))}
              title="Universal Search & Command Palette (⌘K)"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-800/80 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium transition-colors shrink-0"
            >
              <Search className="h-3.5 w-3.5 text-gray-400" />
              <span className="hidden xl:inline text-gray-500 dark:text-gray-400">Search</span>
              <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded text-gray-500 dark:text-gray-400">
                ⌘K
              </kbd>
            </button>
          </div>
        </div>
      </header>
      <main className={`mx-auto min-w-0 overflow-x-hidden ${isChatOnMobile ? 'w-full max-w-none p-0 sm:px-3 sm:py-3 sm:pb-24 md:pb-4 lg:px-5' : 'max-w-7xl p-3 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8'}`}>
        <Dashboard activeTab={activeTab} onTabChange={setActiveTab} />
      </main>

      {/* Sidebar Drawer */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-[100] flex md:hidden animate-in fade-in duration-200">
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
          <div className="relative w-64 flex flex-col bg-white dark:bg-gray-900 h-full shadow-xl animate-in slide-in-from-left duration-200">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-800">
              <span className="font-bold text-lg text-gray-900 dark:text-white">Menu</span>
              <button className="p-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800 dark:hover:text-white transition-colors" onClick={() => setIsSidebarOpen(false)}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-2">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-sm font-medium transition-colors ${activeTab === tab.id ? 'text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/20 border-r-2 border-indigo-600 dark:border-indigo-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  onClick={() => {
                    window.dispatchEvent(new CustomEvent('truespend:setTab', { detail: tab.id }));
                    setIsSidebarOpen(false);
                  }}
                >
                  <tab.icon className={`h-5 w-5 ${activeTab === tab.id ? 'stroke-[2.5]' : ''}`} />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
