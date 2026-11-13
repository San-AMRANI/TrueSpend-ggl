// Secure, Encrypted & Recoverable Offline Transaction Outbox with Idempotency Keys
export interface OfflineOutboxItem {
  idempotencyKey: string;
  userScope: string;
  payload: Record<string, unknown>;
  createdAt: string;
  status: 'pending_sync' | 'syncing' | 'failed' | 'conflict';
  lastError?: string | null;
  retryCount: number;
  nextRetryAt?: string | null;
  isEncrypted?: boolean;
}

interface EncryptedOutboxEnvelope {
  v: 2;
  userScope: string;
  items: Array<{
    idempotencyKey: string;
    createdAt: string;
    status: 'pending_sync' | 'syncing' | 'failed' | 'conflict';
    lastError?: string | null;
    retryCount: number;
    nextRetryAt?: string | null;
    ivB64: string;
    cipherB64: string;
  }>;
}

const OUTBOX_STORAGE_KEY_V2 = 'truespend_offline_outbox_enc_v2';
const OUTBOX_KEY_MATERIAL_PREFIX = 'truespend_outbox_km_v2_';
const LEGACY_STORAGE_KEY = 'truespend_offline_transaction_outbox_v1';
const MAX_RETRY_COUNT = 6;

// In-memory cache of decrypted items for synchronous UI getters while storage remains encrypted
const memoryOutboxCache = new Map<string, OfflineOutboxItem[]>();

export function calculateBackoffMs(retryCount: number): number {
  const clamped = Math.max(0, Math.min(retryCount, MAX_RETRY_COUNT));
  return Math.min(30 * 60 * 1000, 5000 * Math.pow(2, clamped));
}

function getActiveUserScope(explicitScope?: string | null): string {
  if (explicitScope && explicitScope.trim()) return explicitScope.trim();
  if (typeof window === 'undefined') return 'default';
  try {
    const token = localStorage.getItem('truespend_auth_token');
    if (token && token.includes('.')) {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (payload?.uid) return String(payload.uid);
      if (payload?.id) return String(payload.id);
    }
    return localStorage.getItem('truespend_last_user_scope') || 'default';
  } catch {
    return 'default';
  }
}

export function setActiveOutboxUserScope(userScope: string): void {
  if (typeof window === 'undefined' || !userScope) return;
  try {
    localStorage.setItem('truespend_last_user_scope', userScope);
  } catch {}
}

function bytesToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function getOrCreateAesKey(userScope: string): Promise<CryptoKey | null> {
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
  if (!subtle) return null;

  const storageKey = `${OUTBOX_KEY_MATERIAL_PREFIX}${userScope}`;
  let secretB64 = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
  if (!secretB64) {
    const randomBytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(randomBytes);
    secretB64 = bytesToBase64(randomBytes);
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(storageKey, secretB64);
      } catch {}
    }
  }

  const keyBytes = base64ToBytes(secretB64);
  const digest = await subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`TrueSpend-Outbox:${userScope}:${bytesToBase64(keyBytes)}`)
  );
  return await subtle.importKey('raw', digest, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

export async function encryptPayloadForUser(
  userScope: string,
  payload: Record<string, unknown>
): Promise<{ ivB64: string; cipherB64: string }> {
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
  const key = await getOrCreateAesKey(userScope);
  const plaintext = new TextEncoder().encode(JSON.stringify(payload));

  if (!subtle || !key) {
    throw new Error('Web Crypto AES-GCM is unavailable in this environment');
  }

  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await subtle.encrypt({ name: 'AES-GCM', iv }, key, plaintext);
  return {
    ivB64: bytesToBase64(iv),
    cipherB64: bytesToBase64(new Uint8Array(encrypted)),
  };
}

export async function decryptPayloadForUser(
  userScope: string,
  ivB64: string,
  cipherB64: string
): Promise<Record<string, unknown>> {
  const subtle = typeof globalThis !== 'undefined' ? globalThis.crypto?.subtle : undefined;
  const key = await getOrCreateAesKey(userScope);
  if (!subtle || !key) {
    throw new Error('Web Crypto AES-GCM is unavailable in this environment');
  }
  const iv = base64ToBytes(ivB64);
  const cipher = base64ToBytes(cipherB64);
  const decrypted = await subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(iv) },
    key,
    new Uint8Array(cipher)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

function readEnvelope(userScope: string): EncryptedOutboxEnvelope {
  if (typeof window === 'undefined') return { v: 2, userScope, items: [] };
  try {
    const raw = localStorage.getItem(`${OUTBOX_STORAGE_KEY_V2}_${userScope}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.v === 2 && Array.isArray(parsed.items)) return parsed;
    }
  } catch {}
  return { v: 2, userScope, items: [] };
}

async function persistEncryptedOutbox(userScope: string, items: OfflineOutboxItem[]): Promise<void> {
  memoryOutboxCache.set(userScope, items);
  if (typeof window === 'undefined') return;

  const encryptedItems: EncryptedOutboxEnvelope['items'] = [];
  for (const item of items) {
    const { ivB64, cipherB64 } = await encryptPayloadForUser(userScope, item.payload);
    encryptedItems.push({
      idempotencyKey: item.idempotencyKey,
      createdAt: item.createdAt,
      status: item.status,
      lastError: item.lastError || null,
      retryCount: item.retryCount,
      nextRetryAt: item.nextRetryAt || null,
      ivB64,
      cipherB64,
    });
  }

  const envelope: EncryptedOutboxEnvelope = {
    v: 2,
    userScope,
    items: encryptedItems,
  };
  try {
    localStorage.setItem(`${OUTBOX_STORAGE_KEY_V2}_${userScope}`, JSON.stringify(envelope));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('truespend:outbox-updated', { detail: { count: items.length } }));
  } catch {}
}

export async function loadDecryptedOfflineOutbox(explicitScope?: string): Promise<OfflineOutboxItem[]> {
  const userScope = getActiveUserScope(explicitScope);
  const envelope = readEnvelope(userScope);
  if (envelope.items.length === 0) {
    memoryOutboxCache.set(userScope, []);
    return [];
  }

  const decrypted: OfflineOutboxItem[] = [];
  for (const entry of envelope.items) {
    try {
      const payload = await decryptPayloadForUser(userScope, entry.ivB64, entry.cipherB64);
      decrypted.push({
        idempotencyKey: entry.idempotencyKey,
        userScope,
        payload,
        createdAt: entry.createdAt,
        status: entry.status,
        lastError: entry.lastError,
        retryCount: entry.retryCount,
        nextRetryAt: entry.nextRetryAt,
        isEncrypted: true,
      });
    } catch {
      decrypted.push({
        idempotencyKey: entry.idempotencyKey,
        userScope,
        payload: {},
        createdAt: entry.createdAt,
        status: 'failed',
        lastError: 'Encrypted payload locked or corrupted',
        retryCount: entry.retryCount,
        nextRetryAt: entry.nextRetryAt,
        isEncrypted: true,
      });
    }
  }

  memoryOutboxCache.set(userScope, decrypted);
  return decrypted;
}

export function getOfflineOutbox(explicitScope?: string): OfflineOutboxItem[] {
  const userScope = getActiveUserScope(explicitScope);
  if (memoryOutboxCache.has(userScope)) {
    return memoryOutboxCache.get(userScope)!;
  }
  // Synchronously expose non-sensitive encrypted metadata before async decryption resolves
  const envelope = readEnvelope(userScope);
  return envelope.items.map((entry) => ({
    idempotencyKey: entry.idempotencyKey,
    userScope,
    payload: {},
    createdAt: entry.createdAt,
    status: entry.status,
    lastError: entry.lastError,
    retryCount: entry.retryCount,
    nextRetryAt: entry.nextRetryAt,
    isEncrypted: true,
  }));
}

export async function enqueueOfflineTransaction(
  payload: Record<string, unknown>,
  explicitScope?: string
): Promise<OfflineOutboxItem> {
  const userScope = getActiveUserScope(explicitScope);
  const existing = await loadDecryptedOfflineOutbox(userScope);
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
    userScope,
    payload: enrichedPayload,
    createdAt: new Date().toISOString(),
    status: 'pending_sync',
    lastError: null,
    retryCount: existingIdx >= 0 ? existing[existingIdx].retryCount : 0,
    nextRetryAt: null,
    isEncrypted: true,
  };

  if (existingIdx >= 0) {
    existing[existingIdx] = item;
  } else {
    existing.push(item);
  }
  await persistEncryptedOutbox(userScope, existing);
  return item;
}

export async function removeOfflineOutboxItem(idempotencyKey: string, explicitScope?: string): Promise<void> {
  const userScope = getActiveUserScope(explicitScope);
  const existing = (await loadDecryptedOfflineOutbox(userScope)).filter(
    (i) => i.idempotencyKey !== idempotencyKey
  );
  await persistEncryptedOutbox(userScope, existing);
}

/**
 * Security & Recoverability Rule: NEVER silently discard pending offline financial items on logout.
 * Clears ONLY non-critical unlocked in-memory state; preserves encrypted outbox items for reconnect/re-auth.
 */
export function clearOfflineFinancialCachesOnLogout(): { preservedPendingCount: number } {
  const userScope = getActiveUserScope();
  const envelope = readEnvelope(userScope);
  memoryOutboxCache.clear();
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('truespend:outbox-updated', { detail: { count: envelope.items.length } })
    );
  }
  return { preservedPendingCount: envelope.items.length };
}

/** Explicit user-confirmed discard of pending outbox items */
export function forceDiscardOfflineOutbox(confirmDiscard: boolean, explicitScope?: string): void {
  if (!confirmDiscard) {
    throw new Error('Explicit user confirmation required before discarding pending offline transactions');
  }
  const userScope = getActiveUserScope(explicitScope);
  memoryOutboxCache.delete(userScope);
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(`${OUTBOX_STORAGE_KEY_V2}_${userScope}`);
      localStorage.removeItem(LEGACY_STORAGE_KEY);
      window.dispatchEvent(new CustomEvent('truespend:outbox-updated', { detail: { count: 0 } }));
    } catch {}
  }
}

export async function flushOfflineOutbox(
  token: string | null,
  options: { forceRetry?: boolean; userScope?: string; targetIdempotencyKey?: string } = {}
): Promise<{
  synced: number;
  failed: number;
  conflicts: number;
  deferred: number;
  remaining: number;
}> {
  const userScope = getActiveUserScope(options.userScope);
  const items = await loadDecryptedOfflineOutbox(userScope);
  if (items.length === 0) {
    return { synced: 0, failed: 0, conflicts: 0, deferred: 0, remaining: 0 };
  }

  let synced = 0;
  let failed = 0;
  let conflicts = 0;
  let deferred = 0;
  const nowMs = Date.now();
  const remainingItems: OfflineOutboxItem[] = [];

  for (const item of items) {
    if (options.targetIdempotencyKey && item.idempotencyKey !== options.targetIdempotencyKey) {
      remainingItems.push(item);
      continue;
    }

    if (!options.forceRetry && item.status === 'conflict') {
      conflicts++;
      remainingItems.push(item);
      continue;
    }

    if (!options.forceRetry && item.nextRetryAt && new Date(item.nextRetryAt).getTime() > nowMs) {
      deferred++;
      remainingItems.push(item);
      continue;
    }

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
        const nextRetries = item.retryCount + 1;
        const isConflict = response.status === 409 || response.status === 400 || response.status === 422;
        if (isConflict) conflicts++;
        else failed++;

        const nextRetryAt =
          !isConflict && nextRetries < MAX_RETRY_COUNT
            ? new Date(nowMs + calculateBackoffMs(nextRetries)).toISOString()
            : null;

        remainingItems.push({
          ...item,
          status: isConflict ? 'conflict' : 'failed',
          retryCount: nextRetries,
          lastError: errBody?.error || `HTTP ${response.status}`,
          nextRetryAt,
        });
      }
    } catch (networkErr: any) {
      const nextRetries = item.retryCount + 1;
      failed++;
      remainingItems.push({
        ...item,
        status: 'pending_sync',
        retryCount: nextRetries,
        lastError: networkErr?.message || 'Network unavailable',
        nextRetryAt: new Date(nowMs + calculateBackoffMs(nextRetries)).toISOString(),
      });
    }
  }

  await persistEncryptedOutbox(userScope, remainingItems);
  return {
    synced,
    failed,
    conflicts,
    deferred,
    remaining: remainingItems.length,
  };
}
