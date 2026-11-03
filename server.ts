import 'dotenv/config';
import express from "express";
import fs from "fs";
import path from "path";
import cookieParser from "cookie-parser";
import { createServer as createViteServer } from "vite";
import apiRouter from "./server/routes/index.js";
import { NotificationScheduler } from './server/services/NotificationScheduler.js';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Enable CORS for Capacitor Android/iOS WebView origins (https://localhost, capacitor://localhost, etc.)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader(
        "Access-Control-Allow-Headers",
        "Origin, X-Requested-With, Content-Type, Accept, Authorization"
      );
      res.setHeader(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, PATCH, DELETE, OPTIONS"
      );
    }
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  // Direct download route for the compiled Android APK
  app.get("/api/download-apk", (_req, res) => {
    const candidates = [
      path.join(process.cwd(), "TrueSpend.apk"),
      path.join(process.cwd(), "public", "TrueSpend.apk"),
      path.join(process.cwd(), "dist", "TrueSpend.apk"),
      path.join(process.cwd(), "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    ];
    const apkPath = candidates.find((p) => fs.existsSync(p));
    if (!apkPath) {
      res.status(404).json({ error: "Android APK file not found on server." });
      return;
    }
    res.setHeader("Content-Type", "application/vnd.android.package-archive");
    res.setHeader("Content-Disposition", 'attachment; filename="TrueSpend.apk"');
    res.sendFile(apkPath);
  });

  // Mount clean layered API routes
  app.use("/api", apiRouter);

  // Notification Scheduler
  const scheduler = new NotificationScheduler();
  scheduler.start();

  // Vite middleware for development vs static fallback for production
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
