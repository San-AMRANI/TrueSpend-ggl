import React from 'react';
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Button } from './components/ui/Button';
import Dashboard from './components/Dashboard';
import type { DashboardTab } from './types';

const logoSrc = `${(import.meta as any).env?.BASE_URL || '/'}logo-1.png`;
const appIconSrc = `${(import.meta as any).env?.BASE_URL || '/'}app-icon.png`;


function AppContent() {
  const { user, loading, signIn, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

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

  if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900"><p className="text-gray-500 dark:text-gray-400">Loading...</p></div>;

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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
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
      {/* Header — hidden on mobile when the chat tab is active (chat becomes a full-screen overlay) */}
      <header className={`sticky top-0 z-10 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-4 py-3 sm:px-6 lg:px-8 ${isChatOnMobile ? 'hidden sm:block' : ''}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={appIconSrc} alt="TrueSpend Logo" className="h-8 w-8" />
            <span className="text-lg font-bold tracking-tight text-gray-900 dark:text-white">TrueSpend</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden sm:block text-sm font-medium text-gray-600 dark:text-gray-300">{user.email}</span>
            <Button variant="outline" size="sm" onClick={signOut}>Sign Out</Button>
          </div>
        </div>
      </header>
      <main className={`mx-auto min-w-0 max-w-7xl overflow-x-hidden ${isChatOnMobile ? 'p-0 sm:p-6 sm:pb-24 md:pb-6 lg:p-8' : 'p-3 pb-24 sm:p-6 sm:pb-24 md:pb-6 lg:p-8'}`}>
        <Dashboard onTabChange={setActiveTab} />
      </main>
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
