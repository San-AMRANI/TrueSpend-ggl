import pg from 'pg';
import dotenv from 'dotenv';
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

const mappings = {
  'Coffee': '☕ Coffee & Quick Food',
  'Transport': '🚗 Transportation',
  'Transportation': '🚗 Transportation',
  'Groceries': '🛒 Groceries',
  'Family': '👨‍👩‍👦 Family & Gifts',
  'Wardrobe': '👕 Personal & Clothing',
  'Grooming': '👕 Personal & Clothing',
  'Telecom': '📱 Telecom & Subscriptions',
  'Entertainment': '🎬 Entertainment',
  'Repayment': '💳 Debt & Obligations',
  'Debt Repayment': '💳 Debt & Obligations',
  'Reimbursement': '💳 Debt & Obligations',
  'Medical': '🩺 Health & Medical',
  'Utilities': '🏠 Housing & Utilities',
  'Gift': '👨‍👩‍👦 Family & Gifts',
  'Salary': '📥 Income',
  // Budgets additional
  'Long-term Wealth': '💰 Savings & Goals',
  'Short-term Goals': '💰 Savings & Goals',
  'Essentials': '🛒 Groceries',
};

async function runMigration() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Transaction-level mapping for mixed categories
    console.log("Migrating 'Food & Dining'...");
    await client.query("UPDATE transactions SET category = '☕ Coffee & Quick Food' WHERE category = 'Food & Dining' AND (notes ILIKE '%Juice%' OR notes ILIKE '%Snack%' OR notes ILIKE '%Pringles%' OR notes ILIKE '%sundae%' OR notes ILIKE '%Biscuit%')");
    await client.query("UPDATE transactions SET category = '🍔 Dining & Takeaway' WHERE category = 'Food & Dining'"); // Default rest

    console.log("Migrating 'Food'...");
    await client.query("UPDATE transactions SET category = '☕ Coffee & Quick Food' WHERE category = 'Food' AND (notes ILIKE '%Boca%' OR notes ILIKE '%Ben Pause%')");
    await client.query("UPDATE transactions SET category = '🍔 Dining & Takeaway' WHERE category = 'Food'");

    console.log("Migrating 'Social'...");
    await client.query("UPDATE transactions SET category = '💳 Debt & Obligations' WHERE category = 'Social' AND notes ILIKE '%Loan%'");
    await client.query("UPDATE transactions SET category = '🚗 Transportation' WHERE category = 'Social' AND notes ILIKE '%Uber%'");
    await client.query("UPDATE transactions SET category = '🛒 Groceries' WHERE category = 'Social' AND notes ILIKE '%Marjane%'");
    await client.query("UPDATE transactions SET category = '☕ Coffee & Quick Food' WHERE category = 'Social' AND notes ILIKE '%Beach Seller%'");
    await client.query("UPDATE transactions SET category = '🍔 Dining & Takeaway' WHERE category = 'Social'"); // Rest (McDo etc)

    console.log("Migrating 'Transfer'...");
    await client.query("UPDATE transactions SET category = '👕 Personal & Clothing' WHERE category = 'Transfer' AND (notes ILIKE '%Barber%' OR notes ILIKE '%Suit%')");
    await client.query("UPDATE transactions SET category = '👨‍👩‍👦 Family & Gifts' WHERE category = 'Transfer' AND notes ILIKE '%Mom%'");
    await client.query("UPDATE transactions SET category = '🔄 Transfer' WHERE category = 'Transfer'"); // Rest

    // 2. Direct Mappings
    console.log("Applying direct mappings for transactions...");
    for (const [oldCat, newCat] of Object.entries(mappings)) {
      await client.query(`UPDATE transactions SET category = $1 WHERE category = $2`, [newCat, oldCat]);
    }

    // 3. Budgets Migration
    console.log("Migrating budgets...");
    // Since unique constraint exists on (userId, category, year, month), we fetch all budgets and aggregate them.
    const budgetsRes = await client.query(`SELECT * FROM category_budgets`);
    const budgets = budgetsRes.rows;
    
    const aggregatedBudgets = {};
    for (const budget of budgets) {
      // Determine new category
      let newCat = mappings[budget.category] || budget.category;
      if (budget.category === 'Food & Dining' || budget.category === 'Food') newCat = '🍔 Dining & Takeaway';
      if (budget.category === 'Social') newCat = '🍔 Dining & Takeaway'; // We'll just map Social budgets to Dining by default or "Social" doesn't map directly. Actually, the user asked for mapping mixed categories, for budgets we have to pick one. We map to Dining.
      if (budget.category === 'Transfer') newCat = '🔄 Transfer';

      const key = `${budget.user_id}_${newCat}_${budget.year}_${budget.month}`;
      if (!aggregatedBudgets[key]) {
        aggregatedBudgets[key] = {
          user_id: budget.user_id,
          category: newCat,
          year: budget.year,
          month: budget.month,
          amount: 0,
          created_at: budget.created_at,
          updated_at: budget.updated_at
        };
      }
      aggregatedBudgets[key].amount += parseFloat(budget.amount);
      // Keep earliest created_at, latest updated_at
      if (new Date(budget.created_at) < new Date(aggregatedBudgets[key].created_at)) aggregatedBudgets[key].created_at = budget.created_at;
      if (new Date(budget.updated_at) > new Date(aggregatedBudgets[key].updated_at)) aggregatedBudgets[key].updated_at = budget.updated_at;
    }

    // Delete all old budgets
    await client.query(`DELETE FROM category_budgets`);
    
    // Insert new aggregated budgets
    for (const b of Object.values(aggregatedBudgets)) {
      await client.query(
        `INSERT INTO category_budgets (user_id, category, year, month, amount, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [b.user_id, b.category, b.year, b.month, b.amount, b.created_at, b.updated_at]
      );
    }

    // Verify
    const { rows: postRows } = await client.query('SELECT COUNT(*) as count, SUM(amount) as sum FROM transactions');
    console.log("Post Migration Stats:", postRows[0]);
    
    const { rows: catCheck } = await client.query('SELECT category, count(*) FROM transactions GROUP BY category');
    console.log("New Categories in Transactions:", catCheck);

    await client.query('COMMIT');
    console.log("Migration committed successfully.");
  } catch (err) {
    await client.query('ROLLBACK');
    console.error("Migration failed and rolled back:", err);
  } finally {
    client.release();
    pool.end();
  }
}

runMigration();
