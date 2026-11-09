import { Capacitor } from '@capacitor/core';
import { App as CapApp } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';

const STORAGE_KEY_API_BASE = 'truespend_capacitor_api_base_url';
const DEFAULT_CLOUD_API_URL =
  import.meta.env.VITE_API_BASE_URL ||
  'https://true-spend-ggl.vercel.app';

export function isNativePlatform(): boolean {
  try {
    if (Capacitor.isNativePlatform()) return true;
    if (typeof window !== 'undefined') {
      if ((window as any).AndroidBridge) return true;
      if (window.location.hostname === 'localhost' && !window.location.port) return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function getPlatformName(): string {
  try {
    const capPlatform = Capacitor.getPlatform();
    if (capPlatform && capPlatform !== 'web') return capPlatform;
    if (typeof window !== 'undefined') {
      if ((window as any).AndroidBridge) return 'android';
      if (window.location.hostname === 'localhost' && !window.location.port && /android/i.test(navigator.userAgent)) {
        return 'android';
      }
    }
    return capPlatform || 'web';
  } catch {
    return 'web';
  }
}

export function getCapacitorApiBaseUrl(): string {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_API_BASE);
    if (saved && saved.trim()) {
      return saved.trim().replace(/\/+$/, '');
    }
  } catch {}
  return DEFAULT_CLOUD_API_URL.replace(/\/+$/, '');
}

export function getApiUrl(path: string): string {
  if (!path.startsWith('/api')) return path;
  return isNativePlatform() ? `${getCapacitorApiBaseUrl()}${path}` : path;
}

export function setCapacitorApiBaseUrl(url: string): void {
  try {
    const cleaned = url.trim().replace(/\/+$/, '');
    if (!cleaned) {
      localStorage.removeItem(STORAGE_KEY_API_BASE);
    } else {
      localStorage.setItem(STORAGE_KEY_API_BASE, cleaned);
    }
  } catch {}
}

export async function triggerNativeHaptic(style: 'light' | 'medium' | 'heavy' = 'light') {
  if (!isNativePlatform()) return;
  try {
    const impact =
      style === 'heavy'
        ? ImpactStyle.Heavy
        : style === 'medium'
        ? ImpactStyle.Medium
        : ImpactStyle.Light;
    await Haptics.impact({ style: impact });
  } catch {}
}

export async function syncNativeStatusBar(isDark: boolean, bgColor?: string) {
  if (!isNativePlatform()) return;
  try {
    await StatusBar.setOverlaysWebView({ overlay: false });
    await StatusBar.setStyle({ style: isDark ? Style.Dark : Style.Light });
    if (bgColor) {
      await StatusBar.setBackgroundColor({ color: bgColor });
    }
  } catch {}
}

let fetchInterceptorInstalled = false;

/**
 * Installs a transparent fetch interceptor so relative `/api/*` requests inside
 * the Capacitor Android WebView (`https://localhost`) automatically route to the
 * configured TrueSpend backend server URL.
 */
function installNativeApiFetchInterceptor() {
  if (fetchInterceptorInstalled || typeof window === 'undefined') return;
  fetchInterceptorInstalled = true;

  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const native = isNativePlatform();
    const customBase = localStorage.getItem(STORAGE_KEY_API_BASE);

    // Rewrite relative `/api/...` calls when running natively on Android/iOS or when a custom API server is set
    if (native || (customBase && customBase.trim())) {
      const baseUrl = getCapacitorApiBaseUrl();
      if (typeof input === 'string' && input.startsWith('/api')) {
        const targetUrl = getApiUrl(input);
        return originalFetch(targetUrl, {
          ...init,
          credentials: init?.credentials ?? 'include',
        });
      }
      if (input instanceof URL && input.pathname.startsWith('/api') && input.hostname === 'localhost') {
        const targetUrl = `${baseUrl}${input.pathname}${input.search}`;
        return originalFetch(targetUrl, {
          ...init,
          credentials: init?.credentials ?? 'include',
        });
      }
    }

    return originalFetch(input, init);
  };
}

export async function initCapacitorBridge(): Promise<void> {
  installNativeApiFetchInterceptor();

  if (!isNativePlatform()) return;

  const platform = getPlatformName();
  document.documentElement.classList.add('capacitor-native', `capacitor-${platform}`);

  try {
    const isDark = document.documentElement.classList.contains('dark');
    await syncNativeStatusBar(isDark, isDark ? '#0A0D14' : '#FFFFFF');
  } catch {}

  try {
    await SplashScreen.hide();
  } catch {}

  try {
    CapApp.addListener('backButton', ({ canGoBack }) => {
      if (canGoBack && window.history.length > 1) {
        window.history.back();
      } else {
        CapApp.minimizeApp();
      }
    });
  } catch {}
}
