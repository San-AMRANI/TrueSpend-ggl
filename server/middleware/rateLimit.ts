import { Request, Response, NextFunction } from 'express';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyFn?: (req: Request) => string;
  message?: string;
}

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function createRateLimiter(options: RateLimitOptions) {
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const rawKey = options.keyFn ? options.keyFn(req) : getClientIp(req);
    const key = `${options.keyPrefix}:${rawKey}`;

    const existing = buckets.get(key) || { timestamps: [] };
    const cutoff = now - options.windowMs;
    const recent = existing.timestamps.filter((t) => t > cutoff);

    if (recent.length >= options.maxRequests) {
      const oldestRecent = recent[0] || now;
      const retryAfterSec = Math.max(1, Math.ceil((oldestRecent + options.windowMs - now) / 1000));
      res.setHeader('Retry-After', String(retryAfterSec));
      return res.status(429).json({
        error: options.message || 'Too many requests. Please wait a moment and try again.',
        code: 'RATE_LIMITED',
        retryAfterSeconds: retryAfterSec,
      });
    }

    recent.push(now);
    buckets.set(key, { timestamps: recent });

    // Periodic lazy prune when map grows
    if (buckets.size > 5000) {
      for (const [k, entry] of buckets.entries()) {
        if (entry.timestamps.every((t) => t <= cutoff)) {
          buckets.delete(k);
        }
      }
    }

    next();
  };
}

// Progressive login failure tracking by (identifier, ip)
interface FailureRecord {
  count: number;
  firstFailureAt: number;
  blockedUntil: number;
}

const loginFailures = new Map<string, FailureRecord>();
const FAILURE_WINDOW_MS = 15 * 60 * 1000;

function makeFailureKey(identifier: string, ip: string): string {
  return `${identifier.trim().toLowerCase()}::${ip}`;
}

export function checkLoginThrottle(identifier: string, ip: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  const key = makeFailureKey(identifier, ip);
  const rec = loginFailures.get(key);
  if (!rec) return { allowed: true };

  const now = Date.now();
  if (now - rec.firstFailureAt > FAILURE_WINDOW_MS && now > rec.blockedUntil) {
    loginFailures.delete(key);
    return { allowed: true };
  }

  if (rec.blockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((rec.blockedUntil - now) / 1000)),
    };
  }

  return { allowed: true };
}

export function recordLoginFailure(identifier: string, ip: string): void {
  const key = makeFailureKey(identifier, ip);
  const now = Date.now();
  const current = loginFailures.get(key);

  if (!current || now - current.firstFailureAt > FAILURE_WINDOW_MS) {
    loginFailures.set(key, { count: 1, firstFailureAt: now, blockedUntil: 0 });
    return;
  }

  const nextCount = current.count + 1;
  let penaltyMs = 0;
  if (nextCount >= 10) {
    penaltyMs = 15 * 60 * 1000; // 15 minutes
  } else if (nextCount >= 7) {
    penaltyMs = 2 * 60 * 1000; // 2 minutes
  } else if (nextCount >= 5) {
    penaltyMs = 15 * 1000; // 15 seconds progressive backoff
  }

  loginFailures.set(key, {
    count: nextCount,
    firstFailureAt: current.firstFailureAt,
    blockedUntil: penaltyMs > 0 ? now + penaltyMs : 0,
  });
}

export function clearLoginFailures(identifier: string, ip: string): void {
  loginFailures.delete(makeFailureKey(identifier, ip));
}

export function resetRateLimitsForTests(): void {
  buckets.clear();
  loginFailures.clear();
}
