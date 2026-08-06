const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const seedEndpoint = `
  app.post("/api/seed", requireAuth, async (req: AuthRequest, res) => {
    try {
      const userId = req.dbUser.id;
      
      // Truncate tables for this user (or truncate all)
      await db.delete(splits).execute();
      await db.delete(transactions).where(eq(transactions.userId, userId)).execute();
      await db.delete(debts).where(eq(debts.userId, userId)).execute();
      
      const seedData = JSON.parse(fs.readFileSync('./src/db/seed_data.json', 'utf8'));
      
      // Insert debts
      const newDebtsMap = {}; // mapping old id to new id
      if (seedData.debts && seedData.debts.length > 0) {
        for (const debt of seedData.debts) {
          const result = await db.insert(debts).values({
            userId: userId,
            contactName: debt.contactName,
            type: debt.type,
            originalAmount: debt.originalAmount,
            remainingBalance: debt.remainingBalance,
            status: debt.status,
            createdAt: new Date(debt.createdAt)
          }).returning();
          newDebtsMap[debt.id] = result[0].id;
        }
      }
      
      // Insert transactions
      const newTxMap = {};
      if (seedData.transactions && seedData.transactions.length > 0) {
        for (const tx of seedData.transactions) {
          const result = await db.insert(transactions).values({
            userId: userId,
            createdAt: new Date(tx.createdAt),
            amount: tx.amount,
            type: tx.type,
            sourceWallet: tx.sourceWallet,
            category: tx.category,
            notes: tx.notes
          }).returning();
          newTxMap[tx.id] = result[0].id;
        }
      }
      
      // Insert splits
      if (seedData.splits && seedData.splits.length > 0) {
        for (const split of seedData.splits) {
          if (newTxMap[split.transactionId]) {
            await db.insert(splits).values({
              transactionId: newTxMap[split.transactionId],
              reimbursableAmount: split.reimbursableAmount,
              linkedContactId: split.linkedContactId ? newDebtsMap[split.linkedContactId] : null
            });
          }
        }
      }
      
      res.json({ success: true });
    } catch (e) {
      console.error('Seed error:', e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/kpis",`;

if (!code.includes("import fs from 'fs';")) {
  code = "import fs from 'fs';\n" + code;
}

code = code.replace('  app.get("/api/kpis",', seedEndpoint);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts with /api/seed');
