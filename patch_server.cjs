const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

const importReplacement = `import { createServer as createViteServer } from "vite";
import jwt from "jsonwebtoken";
import { requireAuth, AuthRequest } from "./src/middleware/auth.js";`;

code = code.replace(`import { createServer as createViteServer } from "vite";\nimport { requireAuth, AuthRequest } from "./src/middleware/auth.js";`, importReplacement);

const routesReplacement = `  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/login", (req, res) => {
    const { username, password } = req.body;
    const adminUser = process.env.ADMIN_USERNAME || 'admin';
    const adminPass = process.env.ADMIN_PASSWORD || 'admin123';
    
    if (username === adminUser && password === adminPass) {
      const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_fallback_key';
      const token = jwt.sign({ username }, JWT_SECRET, { expiresIn: '7d' });
      res.json({ token, user: { email: username + '@local.host', uid: username } });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  });

  app.get("/api/kpis", requireAuth, async (req: AuthRequest, res) => {`;

code = code.replace(`  // API Routes\n  app.get("/api/health", (req, res) => {\n    res.json({ status: "ok" });\n  });\n\n  app.get("/api/kpis", requireAuth, async (req: AuthRequest, res) => {`, routesReplacement);

fs.writeFileSync('server.ts', code);
console.log('Patched server.ts');
