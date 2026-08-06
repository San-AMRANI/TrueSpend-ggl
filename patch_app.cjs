const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const loginReplacement = `import { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Button } from './components/ui/Button';
import Dashboard from './components/Dashboard';

function AppContent() {
  const { user, loading, signIn, signOut } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  if (loading) return <div className="flex min-h-screen items-center justify-center"><p className="text-gray-500">Loading...</p></div>;

  if (!user) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="mx-auto w-full max-w-sm text-center">
          <div className="mb-8 rounded-full bg-blue-100 p-4 inline-block">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">Welcome to TrueSpend</h1>
          <p className="mb-8 text-gray-500">Log in to track your true economic consumption.</p>
          
          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div>
              <label className="block text-sm font-medium text-gray-700">Username</label>
              <input 
                type="text" 
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Password</label>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                required
              />
            </div>
            {loginError && <p className="text-sm text-red-600">{loginError}</p>}
            <Button type="submit" disabled={isSubmitting} size="lg" className="w-full">
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </div>
      </div>
    );
  }`;

// Use regex to replace everything from imports to `if (!user) { ... return (...) }`
code = code.replace(/import { AuthProvider[\s\S]*?(?=return \(\n\s*<div className="min-h-screen bg-gray-50">)/m, loginReplacement + '\n\n  ');
fs.writeFileSync('src/App.tsx', code);
console.log('Patched App.tsx');
