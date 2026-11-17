import 'dotenv/config';
import http from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import { createServer as createViteServer } from 'vite';
import apiRouter from './server/routes/index.js';
import { ensureDatabaseSchema } from './src/db/index.js';
import { NotificationScheduler } from './server/services/NotificationScheduler.js';
import {
  validateAuthConfig,
  isOriginAllowed,
  isProductionEnv,
} from './server/services/SecurityCrypto.js';
import { httpCompressionMiddleware } from './server/middleware/compression.js';
import { attachLiveVoiceGateway } from './server/services/LiveVoiceGateway.js';

async function startServer() {
  // Fail fast in production if required security secrets are missing or weak
  validateAuthConfig();

  try {
    await ensureDatabaseSchema();
  } catch (err: any) {
    console.error('[Server Startup] Deferred database schema initialization notice:', err?.message || err);
  }

  const app = express();
  const PORT = 3000;

  app.set('trust proxy', 1);
  app.use(httpCompressionMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Security headers across all HTTP responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProductionEnv()) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Strict CORS allowlist (same-origin, Capacitor mobile WebView origins, configured frontend origins)
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin && isOriginAllowed(origin)) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader(
        'Access-Control-Allow-Headers',
        'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Client-Platform'
      );
      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, PATCH, DELETE, OPTIONS'
      );
    }
    if (req.method === 'OPTIONS') {
      if (origin && !isOriginAllowed(origin)) {
        res.status(403).end();
        return;
      }
      res.status(204).end();
      return;
    }
    next();
  });

  // Direct download route for the compiled Android APK
  app.get('/api/download-apk', (_req, res) => {
    const candidates = [
      path.join(process.cwd(), 'TrueSpend.apk'),
      path.join(process.cwd(), 'public', 'TrueSpend.apk'),
      path.join(process.cwd(), 'dist', 'TrueSpend.apk'),
      path.join(process.cwd(), 'android', 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk'),
    ];
    const apkPath = candidates.find((p) => fs.existsSync(p));
    if (!apkPath) {
      res.status(404).json({ error: 'Android APK file not found on server.' });
      return;
    }
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="TrueSpend.apk"');
    res.sendFile(apkPath);
  });

  // Mount clean layered API routes
  app.use('/api', apiRouter);

  // Notification Scheduler
  const scheduler = new NotificationScheduler();
  scheduler.start();

  // Vite middleware for development vs static fallback for production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);
  attachLiveVoiceGateway(httpServer);

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
