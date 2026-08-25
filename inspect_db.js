import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });

// Check payrolls table columns
const cols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema='public' AND table_name='payrolls' 
  ORDER BY ordinal_position
`);
console.log('payrolls columns:', cols.rows);

// Check transactions table for payroll_id
const txCols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema='public' AND table_name='transactions' AND column_name='payroll_id'
`);
console.log('transactions.payroll_id:', txCols.rows);

// Check notification_devices table
const ndCols = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_schema='public' AND table_name='notification_devices'
  ORDER BY ordinal_position
`);
console.log('notification_devices columns:', ndCols.rows);

await pool.end();
