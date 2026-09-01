/**
 * Fixes the payrolls table that had an old, incompatible schema.
 * Drops the old table (no data in it) and recreates with the correct columns.
 * 
 * Run: node fix_payrolls_schema.js
 */
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const client = await pool.connect();
try {
  console.log('Inspecting existing payrolls table...');
  const { rows: cols } = await client.query(`
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payrolls'
    ORDER BY ordinal_position
  `);
  console.log('Current columns:', cols.map(r => r.column_name).join(', '));

  // Check if any rows exist
  const { rows: countRows } = await client.query('SELECT COUNT(*) AS n FROM payrolls');
  console.log(`Existing row count: ${countRows[0].n}`);

  await client.query('BEGIN');

  // Remove the FK constraint on transactions.payroll_id first (if it references the old table)
  const { rows: constraints } = await client.query(`
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'transactions'::regclass AND contype = 'f'
      AND conname ILIKE '%payroll%'
  `);
  for (const c of constraints) {
    console.log(`Dropping FK constraint: ${c.conname}`);
    await client.query(`ALTER TABLE transactions DROP CONSTRAINT IF EXISTS "${c.conname}"`);
  }

  // Drop any unique index on transactions.payroll_id
  await client.query(`DROP INDEX IF EXISTS transactions_payroll_id_unique`);

  // Drop the old payrolls table
  console.log('Dropping old payrolls table...');
  await client.query('DROP TABLE IF EXISTS payrolls CASCADE');

  // Recreate with correct schema
  console.log('Creating payrolls table with correct schema...');
  await client.query(`
    CREATE TABLE "payrolls" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "user_id" uuid NOT NULL REFERENCES "users"("id"),
      "scheduled_for" timestamp NOT NULL,
      "amount" decimal NOT NULL CHECK ("amount" > 0),
      "created_at" timestamp DEFAULT now() NOT NULL
    )
  `);

  // Re-add payroll_id FK on transactions
  console.log('Re-adding payroll_id FK on transactions...');
  // The column itself already exists from the previous migration run
  await client.query(`
    ALTER TABLE transactions 
    ADD CONSTRAINT transactions_payroll_id_fkey 
    FOREIGN KEY (payroll_id) REFERENCES payrolls(id)
  `);

  // Re-add unique index
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "transactions_payroll_id_unique"
    ON "transactions" ("payroll_id") WHERE "payroll_id" IS NOT NULL
  `);

  await client.query('COMMIT');
  console.log('✅  payrolls table fixed successfully.');

  // Verify
  const { rows: newCols } = await client.query(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema='public' AND table_name='payrolls'
    ORDER BY ordinal_position
  `);
  console.log('New columns:', newCols.map(r => `${r.column_name} (${r.data_type})`).join(', '));
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('❌  Fix failed and rolled back:', err);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
