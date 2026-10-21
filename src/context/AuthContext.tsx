import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import type { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  signIn: (token: string, user: User) => void;
  signOut: () => void;
  refreshUserProfile: () => Promise<void>;
  switchUserSession: (targetUserId: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const syncMe = useCallback(async (activeToken: string) => {
    try {
      const res = await dashboardService.getAuthMe(activeToken);
      if (res?.user) {
        setUser(res.user);
        localStorage.setItem('auth_user', JSON.stringify(res.user));
      }
    } catch (err) {
      // Keep cached user if offline
      console.warn('[Auth] Profile sync notice:', err);
    }
  }, []);

  useEffect(() => {
    const storedToken = localStorage.getItem('auth_token');
    const storedUser = localStorage.getItem('auth_user');

    if (storedToken && storedUser) {
      try {
        const payload = JSON.parse(atob(storedToken.split('.')[1]));
        if (payload.exp && payload.exp * 1000 < Date.now()) {
          localStorage.removeItem('auth_token');
          localStorage.removeItem('auth_user');
          setLoading(false);
        } else {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          setLoading(false);
          syncMe(storedToken);
        }
      } catch {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
        setLoading(false);
      }
    } else {
      setLoading(false);
    }

    const handleUnauthorized = () => {
      signOut();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, [syncMe]);

  const signIn = (newToken: string, newUser: User) => {
    localStorage.setItem('auth_token', newToken);
    localStorage.setItem('auth_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const signOut = () => {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    setToken(null);
    setUser(null);
  };

  const refreshUserProfile = async () => {
    if (token) {
      await syncMe(token);
    }
  };

  const switchUserSession = async (targetUserId: string) => {
    if (!token) return;
    const result = await dashboardService.impersonateManagedUser(targetUserId, token);
    if (result?.token && result?.user) {
      signIn(result.token, result.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        signIn,
        signOut,
        refreshUserProfile,
        switchUserSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
