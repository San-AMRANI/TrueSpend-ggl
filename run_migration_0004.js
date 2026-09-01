import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const pool = connectionString
  ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  : new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      ssl: { rejectUnauthorized: false },
    });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const sqlPath = join(__dirname, 'drizzle', '0004_notifications_v2.sql');
const sql = readFileSync(sqlPath, 'utf-8');

async function run() {
  const client = await pool.connect();
  try {
    console.log('Running migration 0004_notifications_v2.sql ...');
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('COMMIT');
    console.log('✅  Migration completed successfully.');

    // Verify
    const { rows: tables } = await client.query(`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name IN ('push_subscriptions', 'notification_preferences', 'notification_deliveries')
    `);
    console.log('Tables now present:', tables.map(r => r.table_name).join(', '));
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('❌  Migration failed and rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
