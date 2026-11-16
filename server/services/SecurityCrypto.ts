import crypto from 'crypto';

const HARDCODED_INSECURE_SECRETS = new Set([
  'super_secret_fallback_key',
  'secret',
  'changeme',
  'default_secret',
  'jwt_secret',
  'truespend_secret',
]);

const COMMON_PASSWORDS = new Set([
  'password1234',
  'password12345',
  'password123456',
  '123456789012',
  '1234567890123',
  'qwertyuiopas',
  'qwerty123456',
  'letmein12345',
  'welcome12345',
  'admin1234567',
  'adminadmin12',
  'truespend123',
  'truespend2026',
  'iloveyou1234',
  '111111111111',
  '000000000000',
  'aaaaaaaaaaaa',
  'passphrase12',
]);

const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 64;

let ephemeralDevSecret: string | null = null;

export function isProductionEnv(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function validateAuthConfig(): { ok: boolean; mode: 'env' | 'ephemeral_dev' } {
  const configured = (process.env.JWT_SECRET || '').trim();
  const isWeakOrDefault =
    !configured ||
    configured.length < 32 ||
    HARDCODED_INSECURE_SECRETS.has(configured.toLowerCase());

  if (isProductionEnv() && isWeakOrDefault) {
    throw new Error(
      'FATAL: JWT_SECRET must be set to a cryptographically strong secret (at least 32 characters) in production.'
    );
  }

  if (isWeakOrDefault) {
    if (!ephemeralDevSecret) {
      ephemeralDevSecret = crypto.randomBytes(48).toString('hex');
    }
    return { ok: true, mode: 'ephemeral_dev' };
  }

  return { ok: true, mode: 'env' };
}

export function getJwtSecret(): string {
  validateAuthConfig();
  const configured = (process.env.JWT_SECRET || '').trim();
  if (configured && configured.length >= 32 && !HARDCODED_INSECURE_SECRETS.has(configured.toLowerCase())) {
    return configured;
  }
  if (!ephemeralDevSecret) {
    ephemeralDevSecret = crypto.randomBytes(48).toString('hex');
  }
  return ephemeralDevSecret;
}

export function getJwtKeyId(): string {
  return (process.env.JWT_KEY_ID || 'v1').trim();
}

function scryptAsync(
  password: string,
  salt: string,
  keylen: number,
  options: crypto.ScryptOptions
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, keylen, options, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

export async function hashPasswordAsync(password: string): Promise<string> {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scryptAsync(password, salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: 64 * 1024 * 1024,
  });
  return `scrypt2$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt}$${derived.toString('hex')}`;
}

export async function verifyPasswordAsync(
  password: string,
  storedHash?: string | null
): Promise<boolean> {
  if (!storedHash || !password) return false;
  try {
    const parts = storedHash.split('$');
    if (parts[0] === 'scrypt2' && parts.length === 6) {
      const N = Number(parts[1]);
      const r = Number(parts[2]);
      const p = Number(parts[3]);
      const salt = parts[4];
      const keyHex = parts[5];
      if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p) || !salt || !keyHex) {
        return false;
      }
      const keyBuffer = Buffer.from(keyHex, 'hex');
      const derivedBuffer = await scryptAsync(password, salt, keyBuffer.length, {
        N,
        r,
        p,
        maxmem: 128 * 1024 * 1024,
      });
      if (keyBuffer.length !== derivedBuffer.length) return false;
      return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
    }

    // Legacy scrypt$<salt>$<hex> format compatibility for seamless login upgrade
    if (parts[0] === 'scrypt' && parts.length === 3) {
      const [, salt, keyHex] = parts;
      const keyBuffer = Buffer.from(keyHex, 'hex');
      const derivedBuffer = await scryptAsync(password, salt, keyBuffer.length, {
        N: 16384,
        r: 8,
        p: 1,
      });
      if (keyBuffer.length !== derivedBuffer.length) return false;
      return crypto.timingSafeEqual(keyBuffer, derivedBuffer);
    }

    return false;
  } catch {
    return false;
  }
}

export function needsPasswordRehash(storedHash?: string | null): boolean {
  if (!storedHash) return true;
  const parts = storedHash.split('$');
  if (parts[0] !== 'scrypt2' || parts.length !== 6) {
    return true;
  }
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  return N < SCRYPT_N || r < SCRYPT_R || p < SCRYPT_P;
}

export function validatePasswordStrength(
  password: string,
  context?: { email?: string; username?: string }
): { valid: boolean; error?: string } {
  const value = password || '';
  if (value.length < 12) {
    return {
      valid: false,
      error: 'Password must be at least 12 characters long. Long passphrases are encouraged.',
    };
  }
  if (value.length > 128) {
    return {
      valid: false,
      error: 'Password must be 128 characters or fewer.',
    };
  }

  const normalized = value.trim().toLowerCase();
  const compact = normalized.replace(/[\s\-_]+/g, '');
  if (COMMON_PASSWORDS.has(normalized) || COMMON_PASSWORDS.has(compact)) {
    return {
      valid: false,
      error: 'This password is too common. Please choose a more unique passphrase.',
    };
  }

  if (/^(.)\1+$/.test(value.trim())) {
    return {
      valid: false,
      error: 'Password cannot consist of a single repeated character.',
    };
  }

  if (context?.email) {
    const cleanEmail = context.email.trim().toLowerCase();
    const localPart = cleanEmail.split('@')[0] || '';
    if (normalized === cleanEmail || (localPart.length >= 4 && normalized.includes(localPart))) {
      return {
        valid: false,
        error: 'Password should not include your email address.',
      };
    }
  }

  if (context?.username && context.username.trim().length >= 4) {
    const cleanUser = context.username.trim().toLowerCase();
    if (normalized === cleanUser || normalized.includes(cleanUser)) {
      return {
        valid: false,
        error: 'Password should not include your username.',
      };
    }
  }

  return { valid: true };
}

export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function hashOpaqueToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function getEncryptionKey(): Buffer {
  const rawKey = (process.env.TOKEN_ENCRYPTION_KEY || '').trim();
  if (rawKey.length >= 32) {
    return crypto.createHash('sha256').update(rawKey, 'utf8').digest();
  }
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      Buffer.from(getJwtSecret(), 'utf8'),
      Buffer.from('truespend-encryption-salt-v1', 'utf8'),
      Buffer.from('integration-credentials', 'utf8'),
      32
    )
  );
}

export function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64url')}:${authTag.toString('base64url')}:${encrypted.toString('base64url')}`;
}

export function decryptSecret(stored: string | null | undefined): string | null {
  if (!stored) return null;
  if (!stored.startsWith('enc:v1:')) {
    // Graceful migration for legacy plaintext token rows
    return stored;
  }
  try {
    const [, , ivB64, tagB64, dataB64] = stored.split(':');
    if (!ivB64 || !tagB64 || !dataB64) return null;
    const key = getEncryptionKey();
    const iv = Buffer.from(ivB64, 'base64url');
    const authTag = Buffer.from(tagB64, 'base64url');
    const encrypted = Buffer.from(dataB64, 'base64url');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch {
    return null;
  }
}

export function getAllowedOrigins(): string[] {
  const origins = new Set<string>([
    'https://localhost',
    'capacitor://localhost',
    'ionic://localhost',
    'http://localhost',
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173',
  ]);

  const envOrigins = [
    process.env.APP_URL,
    process.env.FRONTEND_URL,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : undefined,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ];

  for (const raw of envOrigins) {
    const cleaned = (raw || '').trim().replace(/\/$/, '');
    if (!cleaned) continue;
    try {
      const parsed = new URL(cleaned);
      origins.add(parsed.origin);
    } catch {
      // Ignore malformed origin values
    }
  }

  return Array.from(origins);
}

export function isOriginAllowed(origin: string | undefined | null): boolean {
  if (!origin) return false;
  const normalized = origin.trim().replace(/\/$/, '');
  const allowlist = getAllowedOrigins();
  if (allowlist.includes(normalized)) {
    return true;
  }
  // Allow Google Cloud Run / AI Studio preview URL when running in managed preview mode
  if (process.env.APP_URL) {
    try {
      if (new URL(process.env.APP_URL).origin === normalized) {
        return true;
      }
    } catch {
      // Ignore invalid URL
    }
  }
  if (/^https:\/\/[a-z0-9.-]+\.(run\.app|vercel\.app)$/i.test(normalized)) {
    return true;
  }
  return false;
}
