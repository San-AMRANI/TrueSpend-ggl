import { getApiUrl, isNativePlatform } from '../../lib/capacitorBridge';

const NATIVE_REFRESH_STORAGE_KEY = 'truespend_native_refresh';

let inMemoryAccessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function setApiAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getApiAccessToken(): string | null {
  return inMemoryAccessToken;
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

export async function refreshAccessSession(): Promise<{ token: string; user: any } | null> {
  if (refreshInFlight) {
    const token = await refreshInFlight;
    return token ? { token, user: null } : null;
  }

  let latestResult: { token: string; user: any } | null = null;

  refreshInFlight = (async () => {
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
        }
        return null;
      }

      const data = await response.json();
      const newToken = data.accessToken || data.token || null;
      setApiAccessToken(newToken);
      if (data.refreshToken) {
        setStoredNativeRefreshToken(data.refreshToken);
      }
      if (newToken) {
        window.dispatchEvent(
          new CustomEvent('auth:refreshed', { detail: { token: newToken, user: data.user } })
        );
      }
      latestResult = { token: newToken, user: data.user };
      return newToken;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  await refreshInFlight;
  return latestResult;
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
    if (refreshed?.token) {
      return request<T>(url, options, refreshed.token, true);
    }
    window.dispatchEvent(new Event('auth:unauthorized'));
  }

  if (!response.ok) {
    if (response.status === 401) {
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
