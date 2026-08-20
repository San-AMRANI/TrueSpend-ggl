import pg from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config();

const { Pool } = pg;
const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;
const pool = connectionString ? new Pool({ connectionString, ssl: { rejectUnauthorized: false } }) : new Pool({
  host: process.env.SQL_HOST,
  user: process.env.SQL_USER,
  password: process.env.SQL_PASSWORD,
  database: process.env.SQL_DB_NAME,
  ssl: { rejectUnauthorized: false }
});

async function runAudit() {
  const client = await pool.connect();
  try {
    const categoriesRes = await client.query(`
      SELECT 
        category, 
        COUNT(id) as tx_count, 
        SUM(amount) as total_amount
      FROM transactions
      GROUP BY category
      ORDER BY tx_count DESC
    `);

    const integrityRes = await client.query(`
      SELECT 
        COUNT(id) as total_tx,
        COUNT(category) as categorized_tx,
        SUM(CASE WHEN category IS NULL THEN 1 ELSE 0 END) as uncategorized_tx
      FROM transactions
    `);
    
    const samplesRes = await client.query(`
      SELECT id, type, amount, category, notes, created_at
      FROM transactions
      WHERE category IS NOT NULL
      ORDER BY category, created_at DESC
    `);

    const budgetsRes = await client.query(`
      SELECT category, COUNT(*) as budget_count
      FROM category_budgets
      GROUP BY category
    `);

    fs.writeFileSync('audit_categories.json', JSON.stringify(categoriesRes.rows, null, 2));
    fs.writeFileSync('audit_integrity.json', JSON.stringify(integrityRes.rows[0], null, 2));
    fs.writeFileSync('audit_budgets.json', JSON.stringify(budgetsRes.rows, null, 2));
    
    const samples = {};
    samplesRes.rows.forEach(r => {
      if (!samples[r.category]) samples[r.category] = [];
      samples[r.category].push(r);
    });
    fs.writeFileSync('audit_samples.json', JSON.stringify(samples, null, 2));

    console.log("Files written successfully.");

  } catch (err) {
    console.error("Error running audit", err);
  } finally {
    client.release();
    pool.end();
  }
}

runAudit();
