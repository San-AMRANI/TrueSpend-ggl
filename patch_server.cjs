const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Update KPI calculation
const oldDaysCalc = `        daysUntilPayday: 25 - new Date().getDate() > 0 ? 25 - new Date().getDate() : 30 + 25 - new Date().getDate(),
        dailyAllowance: (bankBalance + cashOnHand) / (25 - new Date().getDate() > 0 ? 25 - new Date().getDate() : 30 + 25 - new Date().getDate())`;

const newDaysCalc = `        daysUntilPayday: (() => {
          const payday = req.dbUser.payday || 25;
          const now = new Date();
          let nextPayday = new Date(now.getFullYear(), now.getMonth(), payday);
          if (now.getDate() >= payday) {
            nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday);
          }
          const diff = Math.ceil((nextPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return diff > 0 ? diff : 1;
        })(),
        dailyAllowance: (() => {
          const payday = req.dbUser.payday || 25;
          const now = new Date();
          let nextPayday = new Date(now.getFullYear(), now.getMonth(), payday);
          if (now.getDate() >= payday) {
            nextPayday = new Date(now.getFullYear(), now.getMonth() + 1, payday);
          }
          const diff = Math.ceil((nextPayday.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          return (bankBalance + cashOnHand) / (diff > 0 ? diff : 1);
        })(),
        payday: req.dbUser.payday || 25`;

code = code.replace(oldDaysCalc, newDaysCalc);

// Add API endpoints for settings
const settingsApi = `
  app.get("/api/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      res.json({ payday: req.dbUser.payday || 25 });
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });

  app.post("/api/settings", requireAuth, async (req: AuthRequest, res) => {
    try {
      const { payday } = req.body;
      if (payday >= 1 && payday <= 31) {
        await db.update(users).set({ payday }).where(eq(users.id, req.dbUser.id));
        res.json({ success: true, payday });
      } else {
        res.status(400).json({ error: "Invalid payday" });
      }
    } catch (e) {
      console.error(e);
      res.status(500).json({ error: "Internal Server Error" });
    }
  });
`;

code = code.replace('  // Vite middleware for development', settingsApi + '\\n  // Vite middleware for development');

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
