import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.js';
import { runDatabaseMigrations } from './migrations.js';
import { perfMonitor } from '../lib/perfMonitor.js';

declare global {
  var _postgresPool: Pool | undefined;
  var _postgresMigrationPromise: Promise<{ applied: string[]; skipped: string[] }> | undefined;
}

function extractSqlText(queryTextOrConfig: any): string {
  if (typeof queryTextOrConfig === 'string') return queryTextOrConfig;
  if (queryTextOrConfig && typeof queryTextOrConfig.text === 'string') {
    return queryTextOrConfig.text;
  }
  return 'UNKNOWN_SQL';
}

function instrumentPoolQueries(pool: Pool) {
  if ((pool as any).__perfInstrumented) return;
  (pool as any).__perfInstrumented = true;

  const origPoolQuery = pool.query.bind(pool);
  (pool as any).query = function (queryTextOrConfig: any, values?: any, callback?: any) {
    // Support callback style if ever used by pg internals
    if (typeof values === 'function' || typeof callback === 'function') {
      return origPoolQuery(queryTextOrConfig, values, callback);
    }
    const sqlText = extractSqlText(queryTextOrConfig);
    const startNs = process.hrtime.bigint();
    const resultPromise = origPoolQuery(queryTextOrConfig, values);
    if (resultPromise && typeof (resultPromise as any).then === 'function') {
      return (resultPromise as Promise<any>).then(
        (res) => {
          const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
          perfMonitor.recordSqlExecution(sqlText, durationMs);
          return res;
        },
        (err) => {
          const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
          perfMonitor.recordSqlExecution(sqlText, durationMs);
          throw err;
        }
      );
    }
    return resultPromise;
  };

  const origConnect = pool.connect.bind(pool);
  (pool as any).connect = async function (...args: any[]) {
    if (args.length > 0 && typeof args[0] === 'function') {
      return origConnect(...args);
    }
    const client = await origConnect();
    if (client && !(client as any).__perfInstrumented) {
      (client as any).__perfInstrumented = true;
      const origClientQuery = client.query.bind(client);
      (client as any).query = function (queryTextOrConfig: any, values?: any, callback?: any) {
        if (typeof values === 'function' || typeof callback === 'function') {
          return origClientQuery(queryTextOrConfig, values, callback);
        }
        const sqlText = extractSqlText(queryTextOrConfig);
        const startNs = process.hrtime.bigint();
        const resultPromise = origClientQuery(queryTextOrConfig, values);
        if (resultPromise && typeof (resultPromise as any).then === 'function') {
          return (resultPromise as Promise<any>).then(
            (res) => {
              const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
              perfMonitor.recordSqlExecution(sqlText, durationMs);
              return res;
            },
            (err) => {
              const durationMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
              perfMonitor.recordSqlExecution(sqlText, durationMs);
              throw err;
            }
          );
        }
        return resultPromise;
      };
    }
    return client;
  };
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle client', err);
    });

    instrumentPoolQueries(global._postgresPool);

    perfMonitor.registerPoolGaugeProvider(() => ({
      totalCount: global._postgresPool?.totalCount ?? 0,
      idleCount: global._postgresPool?.idleCount ?? 0,
      waitingCount: global._postgresPool?.waitingCount ?? 0,
    }));

    // Trigger structured versioned migrations once per process
    ensureDatabaseMigrated(global._postgresPool).catch((err) => {
      console.warn('[DB Init] Schema migration notice:', err?.message || err);
    });
  }
  return global._postgresPool;
};

export async function ensureUsersColumnsExist(pool: Pool = createPool()): Promise<void> {
  try {
    await pool.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_enabled integer DEFAULT 1;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_time text DEFAULT '09:00';
    `);
  } catch (_e) {
    // Ignore if database is unreachable or users table not created yet
  }
}

export function ensureDatabaseMigrated(pool: Pool = createPool()) {
  if (!global._postgresMigrationPromise) {
    global._postgresMigrationPromise = (async () => {
      await ensureUsersColumnsExist(pool);
      return runDatabaseMigrations(pool);
    })().catch((err) => {
      global._postgresMigrationPromise = undefined;
      throw err;
    });
  }
  return global._postgresMigrationPromise;
}

export function getPoolMetrics() {
  return perfMonitor.getPoolSnapshot();
}

export const db = drizzle(createPool(), { schema });
export * from './schema.js';
export { REQUIRED_INDEX_CATALOG, SCHEMA_MIGRATIONS, runDatabaseMigrations } from './migrations.js';
