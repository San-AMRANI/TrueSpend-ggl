import { getApiUrl } from './capacitorBridge';

const GITHUB_REPOSITORY = 'San-AMRANI/TrueSpend-ggl';
const LATEST_RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_REPOSITORY}/releases/latest`;
const STABLE_APK_URL = `https://github.com/${GITHUB_REPOSITORY}/releases/latest/download/TrueSpend.apk`;

export interface AndroidRelease {
  tagName: string;
  name: string;
  publishedAt: string;
  releaseUrl: string;
  apkUrl: string;
}

export function getLatestAndroidApkUrl(): string {
  return import.meta.env.VITE_ANDROID_APK_URL || getApiUrl('/api/download-apk');
}

export async function fetchLatestAndroidRelease(): Promise<AndroidRelease | null> {
  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      headers: { Accept: 'application/vnd.github+json' },
      cache: 'no-store',
    });
    if (!response.ok) return null;

    const release = await response.json();
    const apkAsset = Array.isArray(release.assets)
      ? release.assets.find((asset: { name?: string }) => asset.name?.toLowerCase().endsWith('.apk'))
      : null;

    return {
      tagName: release.tag_name || 'latest',
      name: release.name || release.tag_name || 'Latest Android release',
      publishedAt: release.published_at || release.created_at || '',
      releaseUrl: release.html_url || `https://github.com/${GITHUB_REPOSITORY}/releases`,
      apkUrl: getLatestAndroidApkUrl() || apkAsset?.browser_download_url || STABLE_APK_URL,
    };
  } catch {
    return null;
  }
}
