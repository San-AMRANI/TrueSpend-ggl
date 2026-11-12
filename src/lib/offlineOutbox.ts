// Item M: Offline-Tolerant Draft Transaction Outbox with Idempotency Keys
export interface OfflineOutboxItem {
  idempotencyKey: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending_sync' | 'syncing' | 'failed';
  lastError?: string | null;
  retryCount: number;
}

const OUTBOX_STORAGE_KEY = 'truespend_offline_transaction_outbox_v1';

export function getOfflineOutbox(): OfflineOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveOfflineOutbox(items: OfflineOutboxItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(OUTBOX_STORAGE_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('truespend:outbox-updated', { detail: { count: items.length } }));
  } catch {}
}

export function enqueueOfflineTransaction(payload: Record<string, unknown>): OfflineOutboxItem {
  const existing = getOfflineOutbox();
  const idempotencyKey =
    (typeof payload.idempotencyKey === 'string' && payload.idempotencyKey.trim()) ||
    `idem-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const enrichedPayload = {
    ...payload,
    idempotencyKey,
  };

  const existingIdx = existing.findIndex((i) => i.idempotencyKey === idempotencyKey);
  const item: OfflineOutboxItem = {
    idempotencyKey,
    payload: enrichedPayload,
    createdAt: new Date().toISOString(),
    status: 'pending_sync',
    lastError: null,
    retryCount: existingIdx >= 0 ? existing[existingIdx].retryCount : 0,
  };

  if (existingIdx >= 0) {
    existing[existingIdx] = item;
  } else {
    existing.push(item);
  }
  saveOfflineOutbox(existing);
  return item;
}

export function removeOfflineOutboxItem(idempotencyKey: string): void {
  const existing = getOfflineOutbox().filter((i) => i.idempotencyKey !== idempotencyKey);
  saveOfflineOutbox(existing);
}

export function clearOfflineFinancialCachesOnLogout(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(OUTBOX_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('truespend:outbox-updated', { detail: { count: 0 } }));
  } catch {}
}

export async function flushOfflineOutbox(token: string | null): Promise<{
  synced: number;
  failed: number;
  remaining: number;
}> {
  const items = getOfflineOutbox();
  if (items.length === 0) {
    return { synced: 0, failed: 0, remaining: 0 };
  }

  let synced = 0;
  let failed = 0;
  const remainingItems: OfflineOutboxItem[] = [];

  for (const item of items) {
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          ...item.payload,
          idempotencyKey: item.idempotencyKey,
        }),
      });

      if (response.ok) {
        synced++;
      } else {
        const errBody = await response.json().catch(() => ({}));
        failed++;
        remainingItems.push({
          ...item,
          status: 'failed',
          retryCount: item.retryCount + 1,
          lastError: errBody?.error || `HTTP ${response.status}`,
        });
      }
    } catch (networkErr: any) {
      failed++;
      remainingItems.push({
        ...item,
        status: 'pending_sync',
        retryCount: item.retryCount + 1,
        lastError: networkErr?.message || 'Network unavailable',
      });
    }
  }

  saveOfflineOutbox(remainingItems);
  return {
    synced,
    failed,
    remaining: remainingItems.length,
  };
}
