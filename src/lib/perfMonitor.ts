import { AsyncLocalStorage } from 'async_hooks';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';

export interface RequestPerfContext {
  requestId: string;
  routeKey: string;
  startedAtNs: bigint;
  authMs: number;
  dbMs: number;
  queryCount: number;
  slowQueries: Array<{ fingerprint: string; durationMs: number }>;
}

export interface RouteLatencySummary {
  routeKey: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  maxMs: number;
  avgAuthMs: number;
  avgServiceMs: number;
  avgDbMs: number;
  avgQueryCount: number;
  lastSeenAt: string;
}

export interface SlowQuerySummary {
  fingerprint: string;
  count: number;
  p50Ms: number;
  p95Ms: number;
  avgMs: number;
  maxMs: number;
  lastDurationMs: number;
  lastSeenAt: string;
}

export interface PoolGaugeSnapshot {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  totalQueries: number;
  slowQueryCount: number;
  avgQueryMs: number;
  p95QueryMs: number;
  maxQueryMs: number;
}

interface RouteBucket {
  samplesMs: number[];
  totalMs: number;
  totalAuthMs: number;
  totalServiceMs: number;
  totalDbMs: number;
  totalQueries: number;
  maxMs: number;
  count: number;
  lastSeenAt: string;
}

interface SqlBucket {
  samplesMs: number[];
  totalMs: number;
  maxMs: number;
  count: number;
  lastDurationMs: number;
  lastSeenAt: string;
}

const MAX_SAMPLES_PER_BUCKET = 200;
const SLOW_QUERY_THRESHOLD_MS = Number(process.env.SLOW_QUERY_THRESHOLD_MS || 50);

const requestPerfStorage = new AsyncLocalStorage<RequestPerfContext>();

/**
 * Sanitizes raw SQL into a structural fingerprint with zero personal financial amounts,
 * emails, notes, or UUID literals.
 */
export function normalizeSqlFingerprint(rawSql: string): string {
  if (!rawSql) return 'UNKNOWN_SQL';
  return rawSql
    .replace(/\s+/g, ' ')
    .replace(/'(?:''|[^'])*'/g, '?')
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, '?')
    .replace(/\$\d+/g, '$?')
    .replace(/\b\d+(?:\.\d+)?\b/g, '?')
    .replace(/\(\?(?:,\s*\?){2,}\)/g, '(?...?)')
    .trim()
    .slice(0, 220);
}

function computePercentile(sortedSamples: number[], percentile: number): number {
  if (sortedSamples.length === 0) return 0;
  const idx = Math.min(
    sortedSamples.length - 1,
    Math.max(0, Math.ceil((percentile / 100) * sortedSamples.length) - 1)
  );
  return Number(sortedSamples[idx].toFixed(2));
}

class PerformanceMonitor {
  private routeBuckets = new Map<string, RouteBucket>();
  private sqlBuckets = new Map<string, SqlBucket>();
  private queryDurationSamples: number[] = [];
  private totalQueries = 0;
  private slowQueryCount = 0;
  private totalQueryMs = 0;
  private maxQueryMs = 0;
  private poolGaugeProvider: (() => { totalCount: number; idleCount: number; waitingCount: number }) | null = null;

  registerPoolGaugeProvider(
    provider: () => { totalCount: number; idleCount: number; waitingCount: number }
  ) {
    this.poolGaugeProvider = provider;
  }

  getActiveContext(): RequestPerfContext | undefined {
    return requestPerfStorage.getStore();
  }

  recordAuthDuration(durationMs: number) {
    const ctx = requestPerfStorage.getStore();
    if (ctx) {
      ctx.authMs += durationMs;
    }
  }

  recordSqlExecution(rawSql: string, durationMs: number) {
    const cleanMs = Math.max(0, Number(durationMs.toFixed(3)));
    const fingerprint = normalizeSqlFingerprint(rawSql);

    this.totalQueries += 1;
    this.totalQueryMs += cleanMs;
    if (cleanMs > this.maxQueryMs) {
      this.maxQueryMs = cleanMs;
    }
    this.queryDurationSamples.push(cleanMs);
    if (this.queryDurationSamples.length > MAX_SAMPLES_PER_BUCKET * 2) {
      this.queryDurationSamples.shift();
    }

    const ctx = requestPerfStorage.getStore();
    if (ctx) {
      ctx.queryCount += 1;
      ctx.dbMs += cleanMs;
    }

    // Track all queries by fingerprint and flag slow queries
    const existing = this.sqlBuckets.get(fingerprint) || {
      samplesMs: [],
      totalMs: 0,
      maxMs: 0,
      count: 0,
      lastDurationMs: 0,
      lastSeenAt: new Date().toISOString(),
    };
    existing.count += 1;
    existing.totalMs += cleanMs;
    existing.lastDurationMs = cleanMs;
    existing.lastSeenAt = new Date().toISOString();
    if (cleanMs > existing.maxMs) {
      existing.maxMs = cleanMs;
    }
    existing.samplesMs.push(cleanMs);
    if (existing.samplesMs.length > MAX_SAMPLES_PER_BUCKET) {
      existing.samplesMs.shift();
    }
    this.sqlBuckets.set(fingerprint, existing);

    if (cleanMs >= SLOW_QUERY_THRESHOLD_MS) {
      this.slowQueryCount += 1;
      if (ctx) {
        ctx.slowQueries.push({ fingerprint, durationMs: cleanMs });
      }
    }
  }

  recordRouteCompletion(params: {
    routeKey: string;
    totalMs: number;
    authMs: number;
    dbMs: number;
    queryCount: number;
  }) {
    const { routeKey, totalMs, authMs, dbMs, queryCount } = params;
    const serviceMs = Math.max(0, totalMs - authMs);
    const bucket = this.routeBuckets.get(routeKey) || {
      samplesMs: [],
      totalMs: 0,
      totalAuthMs: 0,
      totalServiceMs: 0,
      totalDbMs: 0,
      totalQueries: 0,
      maxMs: 0,
      count: 0,
      lastSeenAt: new Date().toISOString(),
    };

    bucket.count += 1;
    bucket.totalMs += totalMs;
    bucket.totalAuthMs += authMs;
    bucket.totalServiceMs += serviceMs;
    bucket.totalDbMs += dbMs;
    bucket.totalQueries += queryCount;
    bucket.lastSeenAt = new Date().toISOString();
    if (totalMs > bucket.maxMs) {
      bucket.maxMs = totalMs;
    }
    bucket.samplesMs.push(totalMs);
    if (bucket.samplesMs.length > MAX_SAMPLES_PER_BUCKET) {
      bucket.samplesMs.shift();
    }

    this.routeBuckets.set(routeKey, bucket);
  }

  getPoolSnapshot(): PoolGaugeSnapshot {
    const rawPool = this.poolGaugeProvider
      ? this.poolGaugeProvider()
      : { totalCount: 0, idleCount: 0, waitingCount: 0 };
    const sorted = [...this.queryDurationSamples].sort((a, b) => a - b);
    return {
      totalCount: rawPool.totalCount,
      idleCount: rawPool.idleCount,
      waitingCount: rawPool.waitingCount,
      totalQueries: this.totalQueries,
      slowQueryCount: this.slowQueryCount,
      avgQueryMs:
        this.totalQueries > 0 ? Number((this.totalQueryMs / this.totalQueries).toFixed(2)) : 0,
      p95QueryMs: computePercentile(sorted, 95),
      maxQueryMs: Number(this.maxQueryMs.toFixed(2)),
    };
  }

  getRouteSummaries(limit = 30): RouteLatencySummary[] {
    const summaries: RouteLatencySummary[] = [];
    for (const [routeKey, bucket] of this.routeBuckets.entries()) {
      const sorted = [...bucket.samplesMs].sort((a, b) => a - b);
      summaries.push({
        routeKey,
        count: bucket.count,
        p50Ms: computePercentile(sorted, 50),
        p95Ms: computePercentile(sorted, 95),
        avgMs: Number((bucket.totalMs / bucket.count).toFixed(2)),
        maxMs: Number(bucket.maxMs.toFixed(2)),
        avgAuthMs: Number((bucket.totalAuthMs / bucket.count).toFixed(2)),
        avgServiceMs: Number((bucket.totalServiceMs / bucket.count).toFixed(2)),
        avgDbMs: Number((bucket.totalDbMs / bucket.count).toFixed(2)),
        avgQueryCount: Number((bucket.totalQueries / bucket.count).toFixed(1)),
        lastSeenAt: bucket.lastSeenAt,
      });
    }
    return summaries.sort((a, b) => b.p95Ms - a.p95Ms).slice(0, limit);
  }

  getSlowQuerySummaries(limit = 25): SlowQuerySummary[] {
    const summaries: SlowQuerySummary[] = [];
    for (const [fingerprint, bucket] of this.sqlBuckets.entries()) {
      const sorted = [...bucket.samplesMs].sort((a, b) => a - b);
      summaries.push({
        fingerprint,
        count: bucket.count,
        p50Ms: computePercentile(sorted, 50),
        p95Ms: computePercentile(sorted, 95),
        avgMs: Number((bucket.totalMs / bucket.count).toFixed(2)),
        maxMs: Number(bucket.maxMs.toFixed(2)),
        lastDurationMs: Number(bucket.lastDurationMs.toFixed(2)),
        lastSeenAt: bucket.lastSeenAt,
      });
    }
    return summaries.sort((a, b) => b.p95Ms - a.p95Ms || b.maxMs - a.maxMs).slice(0, limit);
  }

  getDiagnosticsReport() {
    return {
      capturedAt: new Date().toISOString(),
      slowQueryThresholdMs: SLOW_QUERY_THRESHOLD_MS,
      pool: this.getPoolSnapshot(),
      routes: this.getRouteSummaries(30),
      topQueries: this.getSlowQuerySummaries(25),
    };
  }

  reset() {
    this.routeBuckets.clear();
    this.sqlBuckets.clear();
    this.queryDurationSamples = [];
    this.totalQueries = 0;
    this.slowQueryCount = 0;
    this.totalQueryMs = 0;
    this.maxQueryMs = 0;
  }
}

export const perfMonitor = new PerformanceMonitor();

function normalizeRoutePath(rawPath: string): string {
  return (rawPath || '/')
    .split('?')[0]
    .replace(
      /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi,
      ':id'
    )
    .replace(/\/\d+\b/g, '/:num');
}

export function perfRequestMiddleware(req: Request, res: Response, next: NextFunction) {
  const requestId =
    (typeof req.headers['x-request-id'] === 'string' && req.headers['x-request-id']) ||
    crypto.randomUUID();
  const startedAtNs = process.hrtime.bigint();
  const routeKey = `${req.method} /api${normalizeRoutePath(req.path)}`;

  const context: RequestPerfContext = {
    requestId,
    routeKey,
    startedAtNs,
    authMs: 0,
    dbMs: 0,
    queryCount: 0,
    slowQueries: [],
  };

  res.setHeader('X-Request-Id', requestId);

  const originalEnd = res.end;
  let ended = false;
  (res as any).end = function (...args: any[]) {
    if (!ended) {
      ended = true;
      const elapsedMs = Number(process.hrtime.bigint() - startedAtNs) / 1_000_000;
      if (!res.headersSent) {
        res.setHeader('X-Response-Time-Ms', elapsedMs.toFixed(2));
        res.setHeader('X-DB-Query-Count', String(context.queryCount));
        res.setHeader('X-DB-Time-Ms', context.dbMs.toFixed(2));
      }
      perfMonitor.recordRouteCompletion({
        routeKey: `${req.method} /api${normalizeRoutePath(req.path)}`,
        totalMs: Number(elapsedMs.toFixed(2)),
        authMs: Number(context.authMs.toFixed(2)),
        dbMs: Number(context.dbMs.toFixed(2)),
        queryCount: context.queryCount,
      });
    }
    return originalEnd.apply(this, args as any);
  };

  requestPerfStorage.run(context, () => next());
}
