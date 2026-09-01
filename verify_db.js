import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

const res = await pool.query(`
  SELECT 
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='payrolls')::int AS payrolls_table,
    (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='notification_devices')::int AS notif_table,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='transactions' AND column_name='payroll_id')::int AS payroll_id_col
`);

console.log('DB verification:');
const row = res.rows[0];
console.log('  payrolls table:', row.payrolls_table === 1 ? '✅ EXISTS' : '❌ MISSING');
console.log('  notification_devices table:', row.notif_table === 1 ? '✅ EXISTS' : '❌ MISSING');
console.log('  transactions.payroll_id column:', row.payroll_id_col === 1 ? '✅ EXISTS' : '❌ MISSING');

await pool.end();
