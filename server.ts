import express from "express";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import { requireAuth, AuthRequest } from "./src/middleware/auth.js";
import { db } from "./src/db/index.js";
import { transactions, splits, debts, users } from "./src/db/schema.js";
import { eq, desc, and, or, sql } from "drizzle-orm";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/kpis", requireAuth, async (req: AuthRequest, res) => {
    const userId = req.dbUser.id;
    try {
      const allTx = await db.select().from(transactions).where(eq(transactions.userId, userId));
      
      let bankBalance = 0;
      let cashOnHand = 0;
      let monthlyExpenses = 0;
      let monthlyIncome = 0;
      let totalFronted = 0;

      const currentMonth = new Date().getMonth();
      const currentYear = new Date().getFullYear();

      for (const tx of allTx) {
        const txAmount = parseFloat(tx.amount as unknown as string);
        const txDate = new Date(tx.createdAt!);
        
        if (tx.sourceWallet === 'Bank') {
          if (tx.type === 'Income') bankBalance += txAmount;
          if (tx.type === 'Expense') bankBalance -= txAmount;
          if (tx.type === 'Transfer') {
            bankBalance -= txAmount;
            cashOnHand += txAmount;
          }
          if (tx.type === 'Debt Repayment') bankBalance -= txAmount;
        } else if (tx.sourceWallet === 'Cash') {
          if (tx.type === 'Income') cashOnHand += txAmount;
          if (tx.type === 'Expense') cashOnHand -= txAmount;
          if (tx.type === 'Transfer') {
            cashOnHand -= txAmount;
            bankBalance += txAmount;
          }
          if (tx.type === 'Debt Repayment') cashOnHand -= txAmount;
        }

        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          if (tx.type === 'Expense') monthlyExpenses += txAmount;
          if (tx.type === 'Income') monthlyIncome += txAmount;
        }
      }

      let debtRepayments = 0;
      let reimbursements = 0;

      for (const tx of allTx) {
        const txDate = new Date(tx.createdAt!);
        if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
          const txAmount = parseFloat(tx.amount as unknown as string);
          if (tx.type === 'Expense' && (tx.category === 'Debt Repayment' || tx.category === 'Loan' || tx.category === 'Transfer')) {
            debtRepayments += txAmount;
          }
          if (tx.type === 'Income' && (tx.category === 'Reimbursement' || tx.category === 'Repayment' || tx.category === 'Refund' || tx.category === 'Transfer')) {
            reimbursements += txAmount;
          }
        }
      }

      res.json({
        totalLiquidity: bankBalance + cashOnHand,
        bankBalance,
        cashOnHand,
        monthlyExpenses,
        monthlyIncome,
        adjustedTrueSpend: monthlyExpenses - debtRepayments - reimbursements,
        daysUntilPayday: 25 - new Date().getDate() > 0 ? 25 - new Date().getDate() : 30 + 25 - new Date().getDate(),
        dailyAllowance: (bankBalance + cashOnHand) / (25 - new Date().getDate() > 0 ? 25 - new Date().getDate() : 30 + 25 - new Date().getDate())
      });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const txs = await db.select().from(transactions).where(eq(transactions.userId, req.dbUser.id)).orderBy(desc(transactions.createdAt));
      res.json(txs);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/transactions", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amount, type, source_wallet, category, notes, reimbursable_amount, linked_contact_name } = req.body;
      
      const newTx = await db.insert(transactions).values({
        userId: req.dbUser.id,
        amount: String(amount),
        type,
        sourceWallet: source_wallet,
        category,
        notes,
      }).returning();

      if (reimbursable_amount && reimbursable_amount > 0 && linked_contact_name) {
        // Create debt
        const newDebt = await db.insert(debts).values({
          userId: req.dbUser.id,
          contactName: linked_contact_name,
          type: 'Receivable',
          originalAmount: String(reimbursable_amount),
          remainingBalance: String(reimbursable_amount),
          status: 'Pending',
        }).returning();

        // Create split
        await db.insert(splits).values({
          transactionId: newTx[0].id,
          reimbursableAmount: String(reimbursable_amount),
          linkedContactId: newDebt[0].id,
        });
      }

      res.status(201).json({ message: "Transaction created", id: newTx[0].id });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.delete("/api/transactions/:id", requireAuth, async (req: AuthRequest, res) => {
    try {
      const txId = req.params.id;
      // Delete splits associated with this transaction first
      await db.delete(splits).where(eq(splits.transactionId, txId));
      await db.delete(transactions).where(and(eq(transactions.id, txId), eq(transactions.userId, req.dbUser.id)));
      res.status(200).json({ message: "Transaction deleted" });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.get("/api/debts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const allDebts = await db.select().from(debts).where(eq(debts.userId, req.dbUser.id)).orderBy(desc(debts.createdAt));
      res.json(allDebts);
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/debts", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { amount, contact, type, debt_id } = req.body;
      
      if (debt_id) {
        const debt = await db.select().from(debts).where(and(eq(debts.id, debt_id), eq(debts.userId, req.dbUser.id)));
        if (debt.length > 0) {
          const currentRemaining = parseFloat(debt[0].remainingBalance as unknown as string);
          const newRemaining = currentRemaining - amount;
          
          await db.update(debts).set({
            remainingBalance: String(newRemaining),
            status: newRemaining <= 0 ? 'Cleared' : 'Pending'
          }).where(eq(debts.id, debt_id));
          return res.status(200).json({ message: "Debt settled" });
        }
        return res.status(404).json({ error: "Debt not found" });
      } else {
        await db.insert(debts).values({
          userId: req.dbUser.id,
          contactName: contact,
          type,
          originalAmount: String(amount),
          remainingBalance: String(amount),
          status: 'Pending',
        });
        return res.status(201).json({ message: "Debt created" });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
