import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { dashboardService } from '../services/api/dashboardService';
import {
  refreshAccessSession,
  setApiAccessToken,
  setStoredNativeRefreshToken,
  getStoredNativeRefreshToken,
  saveTabSessionCache,
  loadTabSessionCache,
} from '../services/api/apiClient';
import { getApiUrl, isNativePlatform } from '../lib/capacitorBridge';
import type { ExperienceTier, OnboardingState, User } from '../types';

const SESSION_HINT_KEY = 'truespend_has_session';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  onboarding: OnboardingState | null;
  signIn: (token: string, user: User, refreshToken?: string | null) => void;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
  refreshOnboarding: () => Promise<void>;
  switchExperienceTier: (tier: ExperienceTier) => Promise<any>;
  setUserDirect: (nextUser: User) => void;
  setOnboardingDirect: (nextState: OnboardingState) => void;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);

  const loadOnboardingForToken = useCallback(async (activeToken: string) => {
    try {
      const state = await dashboardService.getOnboardingState(activeToken);
      setOnboarding(state);
    } catch {
      // Unverified accounts do not have onboarding loaded yet
    }
  }, []);

  const syncMe = useCallback(
    async (activeToken: string) => {
      try {
        const res = await dashboardService.getAuthMe(activeToken);
        if (res?.user) {
          setUser(res.user);
          saveTabSessionCache(activeToken, res.user);
          if (res.user.emailVerified && res.user.status === 'active') {
            await loadOnboardingForToken(activeToken);
          }
        }
      } catch (err) {
        console.warn('[Auth] Profile sync notice:', err);
      }
    },
    [loadOnboardingForToken]
  );

  const clearSessionState = useCallback(() => {
    setApiAccessToken(null);
    setStoredNativeRefreshToken(null);
    saveTabSessionCache(null, null);
    try {
      localStorage.removeItem(SESSION_HINT_KEY);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch {}
    setToken(null);
    setUser(null);
    setOnboarding(null);
  }, []);

  useEffect(() => {
    // Migrate away from legacy localStorage JWT storage cleanly
    try {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
    } catch {}

    let cancelled = false;
    (async () => {
      try {
        // Fast-boot restore from same-tab session cache when 7-day JWT is still valid
        const cachedTab = loadTabSessionCache();
        if (cachedTab?.token && cachedTab?.user) {
          setApiAccessToken(cachedTab.token);
          if (!cancelled) {
            setToken(cachedTab.token);
            setUser(cachedTab.user);
            setLoading(false);
          }
          try {
            const meRes = await dashboardService.getAuthMe(cachedTab.token);
            if (!cancelled && meRes?.user) {
              setUser(meRes.user);
              saveTabSessionCache(cachedTab.token, meRes.user);
              if (meRes.user.emailVerified && meRes.user.status === 'active') {
                await loadOnboardingForToken(cachedTab.token);
              }
            }
          } catch {
            // Transient offline or expired token will be handled lazily on next request
          }
          return;
        }

        const hasHint =
          (typeof localStorage !== 'undefined' && localStorage.getItem(SESSION_HINT_KEY) === '1') ||
          Boolean(getStoredNativeRefreshToken());
        if (hasHint) {
          const refreshed = await refreshAccessSession();
          if (cancelled) return;
          if (refreshed.status === 'ok' && refreshed.token) {
            setToken(refreshed.token);
            if (refreshed.user) {
              setUser(refreshed.user);
              if (refreshed.user.emailVerified && refreshed.user.status === 'active') {
                await loadOnboardingForToken(refreshed.token);
              }
            } else {
              await syncMe(refreshed.token);
            }
          } else if (refreshed.status === 'rejected') {
            clearSessionState();
          }
          // On 'transient_error' (offline / cold-start 503), preserve hint & native token so next retry recovers
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    const handleRefreshed = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.token) {
        setToken(detail.token);
        if (detail.user) {
          setUser(detail.user);
          saveTabSessionCache(detail.token, detail.user);
        }
      }
    };

    const handleUnauthorized = () => {
      clearSessionState();
    };

    window.addEventListener('auth:refreshed', handleRefreshed);
    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => {
      cancelled = true;
      window.removeEventListener('auth:refreshed', handleRefreshed);
      window.removeEventListener('auth:unauthorized', handleUnauthorized);
    };
  }, [clearSessionState, loadOnboardingForToken, syncMe]);

  const signIn = (newToken: string, newUser: User, nativeRefreshToken?: string | null) => {
    setApiAccessToken(newToken);
    saveTabSessionCache(newToken, newUser);
    if (nativeRefreshToken) {
      setStoredNativeRefreshToken(nativeRefreshToken);
    }
    try {
      localStorage.setItem(SESSION_HINT_KEY, '1');
    } catch {}
    setToken(newToken);
    setUser(newUser);
    if (newUser.emailVerified && newUser.status === 'active') {
      loadOnboardingForToken(newToken);
    }
  };

  const signOut = async () => {
    const activeToken = token;
    const nativeRefresh = getStoredNativeRefreshToken();
    clearSessionState();
    try {
      await fetch(getApiUrl('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          ...(isNativePlatform() ? { 'X-Client-Platform': 'capacitor' } : {}),
        },
        body: JSON.stringify(nativeRefresh ? { refreshToken: nativeRefresh } : {}),
      });
    } catch {
      // Ignore network errors during sign-out cleanup
    }
  };

  const refreshUserProfile = async () => {
    if (token) {
      await syncMe(token);
    }
  };

  const refreshOnboarding = async () => {
    if (token) {
      await loadOnboardingForToken(token);
    }
  };

  const switchExperienceTier = async (tier: ExperienceTier) => {
    if (!token) throw new Error('Sign in required');
    const result = await dashboardService.switchExperienceTier(tier, token);
    if (result?.user) {
      setUser(result.user);
      saveTabSessionCache(token, result.user);
    }
    await loadOnboardingForToken(token);
    window.dispatchEvent(new CustomEvent('truespend:tier-changed', { detail: tier }));
    return result;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        onboarding,
        signIn,
        signOut,
        refreshUserProfile,
        refreshOnboarding,
        switchExperienceTier,
        setUserDirect: (nextUser: User) => {
          setUser(nextUser);
          saveTabSessionCache(token, nextUser);
        },
        setOnboardingDirect: setOnboarding,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
