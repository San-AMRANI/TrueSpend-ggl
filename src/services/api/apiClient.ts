import { getApiUrl, isNativePlatform } from '../../lib/capacitorBridge';

const NATIVE_REFRESH_STORAGE_KEY = 'truespend_native_refresh';
const TAB_SESSION_STORAGE_KEY = 'truespend_tab_session';

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<RefreshSessionOutcome> | null = null;

export interface RefreshSessionOutcome {
  status: 'ok' | 'rejected' | 'transient_error';
  token?: string;
  user?: any;
}

export function setApiAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getApiAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function getJwtExpirationMs(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(atob(padded));
    return typeof payload?.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function saveTabSessionCache(token: string | null, user: any | null) {
  try {
    if (token && user) {
      sessionStorage.setItem(TAB_SESSION_STORAGE_KEY, JSON.stringify({ token, user }));
    } else {
      sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
    }
  } catch {
    // Ignore storage access errors in restricted contexts
  }
}

export function loadTabSessionCache(): { token: string; user: any } | null {
  try {
    const raw = sessionStorage.getItem(TAB_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.token || !parsed?.user) return null;
    const expMs = getJwtExpirationMs(parsed.token);
    if (expMs && expMs <= Date.now() + 30_000) {
      sessionStorage.removeItem(TAB_SESSION_STORAGE_KEY);
      return null;
    }
    return { token: parsed.token, user: parsed.user };
  } catch {
    return null;
  }
}

export function getStoredNativeRefreshToken(): string | null {
  if (!isNativePlatform()) return null;
  try {
    return localStorage.getItem(NATIVE_REFRESH_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredNativeRefreshToken(token: string | null) {
  if (!isNativePlatform()) return;
  try {
    if (token) localStorage.setItem(NATIVE_REFRESH_STORAGE_KEY, token);
    else localStorage.removeItem(NATIVE_REFRESH_STORAGE_KEY);
  } catch {
    // Ignore storage quota errors
  }
}

export class ApiError extends Error {
  status: number;
  code?: string;
  extra?: Record<string, any>;

  constructor(message: string, status: number, code?: string, extra?: Record<string, any>) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export async function refreshAccessSession(): Promise<RefreshSessionOutcome> {
  if (refreshInFlight) {
    return await refreshInFlight;
  }

  refreshInFlight = (async (): Promise<RefreshSessionOutcome> => {
    try {
      const nativeRefresh = getStoredNativeRefreshToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (isNativePlatform()) {
        headers['X-Client-Platform'] = 'capacitor';
      }

      const response = await fetch(getApiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers,
        body: nativeRefresh ? JSON.stringify({ refreshToken: nativeRefresh }) : JSON.stringify({}),
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          setApiAccessToken(null);
          setStoredNativeRefreshToken(null);
          saveTabSessionCache(null, null);
          return { status: 'rejected' };
        }
        return { status: 'transient_error' };
      }

      const data = await response.json();
      const newToken = data.accessToken || data.token || null;
      if (!newToken) {
        return { status: 'transient_error' };
      }

      setApiAccessToken(newToken);
      if (data.refreshToken) {
        setStoredNativeRefreshToken(data.refreshToken);
      }
      if (data.user) {
        saveTabSessionCache(newToken, data.user);
      }
      window.dispatchEvent(
        new CustomEvent('auth:refreshed', { detail: { token: newToken, user: data.user } })
      );
      return { status: 'ok', token: newToken, user: data.user };
    } catch {
      return { status: 'transient_error' };
    } finally {
      refreshInFlight = null;
    }
  })();

  return await refreshInFlight;
}

const NON_REFRESHABLE_AUTH_PATHS = [
  '/api/auth/login',
  '/api/login',
  '/api/auth/register',
  '/api/auth/refresh',
  '/api/auth/verify-email',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
];

async function request<T>(
  url: string,
  options: RequestInit = {},
  token?: string | null,
  isRetry = false
): Promise<T> {
  const effectiveToken = token || inMemoryAccessToken;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (effectiveToken) {
    headers['Authorization'] = `Bearer ${effectiveToken}`;
  }
  if (isNativePlatform()) {
    headers['X-Client-Platform'] = 'capacitor';
  }

  const response = await fetch(getApiUrl(url), {
    ...options,
    credentials: 'include',
    headers,
  });

  if (
    response.status === 401 &&
    !isRetry &&
    !NON_REFRESHABLE_AUTH_PATHS.some((p) => url.startsWith(p))
  ) {
    const refreshed = await refreshAccessSession();
    if (refreshed.status === 'ok' && refreshed.token) {
      return request<T>(url, options, refreshed.token, true);
    }
    if (refreshed.status === 'rejected') {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  if (!response.ok) {
    if (response.status === 401 && isRetry) {
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.error || `Request failed with status ${response.status}`,
      response.status,
      errorData.code,
      errorData
    );
  }

  return response.json();
}

export const apiClient = {
  get: <T>(url: string, token?: string | null) => request<T>(url, { method: 'GET' }, token),
  post: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'POST', body: JSON.stringify(body ?? {}) }, token),
  put: <T>(url: string, body?: any, token?: string | null) =>
    request<T>(url, { method: 'PUT', body: JSON.stringify(body ?? {}) }, token),
  delete: <T>(url: string, token?: string | null) =>
    request<T>(url, { method: 'DELETE' }, token),
};
