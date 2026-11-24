import 'dotenv/config';
import http from 'http';
import express from 'express';
import fs from 'fs';
import path from 'path';
import cookieParser from 'cookie-parser';
import {
  validateAuthConfig,
  isOriginAllowed,
  isProductionEnv,
} from './server/services/SecurityCrypto.js';
import { httpCompressionMiddleware } from './server/middleware/compression.js';

function resolveServerBindConfig(): { port: number; host: string } {
  const args = process.argv.slice(2);
  let port = Number(process.env.PORT) || 3000;
  let host = '0.0.0.0';

  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if ((arg === '--port' || arg === '-p') && args[i + 1]) {
      const parsed = Number(args[i + 1]);
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
      i += 1;
    } else if (arg.startsWith('--port=')) {
      const parsed = Number(arg.slice('--port='.length));
      if (Number.isFinite(parsed) && parsed > 0) port = parsed;
    } else if (arg === '--host' && args[i + 1]) {
      host = args[i + 1];
      i += 1;
    } else if (arg.startsWith('--host=')) {
      host = arg.slice('--host='.length);
    }
  }

  return { port, host };
}

async function startServer() {
  // Fail fast in production if required security secrets are missing or weak
  validateAuthConfig();

  const app = express();
  const { port: PORT, host: HOST } = resolveServerBindConfig();

  app.set('trust proxy', 1);
  app.use(httpCompressionMiddleware);
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  // Security headers across all HTTP responses
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (isProductionEnv()) {
      res.setHeader('X-Frame-Options', 'DENY');
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

  // Load heavy API router lazily (and pre-warm immediately once port 3000 is bound)
  let apiRouterPromise: Promise<express.Router> | null = null;
  const getApiRouter = () => {
    if (!apiRouterPromise) {
      apiRouterPromise = import('./server/routes/index.js')
        .then((mod) => mod.default)
        .catch((err) => {
          apiRouterPromise = null;
          console.error('[Server Startup] Failed to load API router:', err);
          throw err;
        });
    }
    return apiRouterPromise;
  };

  app.use('/api', (req, res, next) => {
    getApiRouter()
      .then((router) => {
        router(req, res, next);
      })
      .catch(next);
  });

  // Vite middleware for development (initialized lazily & pre-warmed once port 3000 is bound)
  // vs static fallback for production
  let viteServerRef: { close: () => Promise<void> } | null = null;
  let vitePromise: Promise<{ middlewares: express.RequestHandler; close: () => Promise<void> }> | null = null;
  const getViteServer = () => {
    if (!vitePromise) {
      const disableHmr = process.env.DISABLE_HMR === 'true';
      vitePromise = import('vite')
        .then(({ createServer: createViteServer }) =>
          createViteServer({
            server: {
              middlewareMode: true,
              ...(disableHmr ? { hmr: false, ws: false } : {}),
            },
            appType: 'spa',
          })
        )
        .then((vite) => {
          viteServerRef = vite;
          return vite;
        })
        .catch((err) => {
          vitePromise = null;
          console.error('[Server Startup] Vite dev server initialization failed:', err);
          throw err;
        });
    }
    return vitePromise;
  };

  if (process.env.NODE_ENV !== 'production') {
    app.use((req, res, next) => {
      getViteServer()
        .then((vite) => {
          vite.middlewares(req, res, next);
        })
        .catch(next);
    });
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const httpServer = http.createServer(app);

  httpServer.on('error', (err) => {
    console.error('[Server Startup] HTTP server error:', err);
  });

  // Bind port immediately before heavy DB/Vite/route/WebSocket warmup
  httpServer.listen(PORT, HOST, () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Pre-warm Vite, API routes, Live Voice WebSocket gateway, DB schema, and scheduler in background
    if (process.env.NODE_ENV !== 'production') {
      void getViteServer().catch(() => undefined);
    }
    void getApiRouter().catch(() => undefined);

    void import('./server/services/LiveVoiceGateway.js')
      .then(({ attachLiveVoiceGateway }) => {
        attachLiveVoiceGateway(httpServer);
      })
      .catch((err) => {
        console.error('[Server Startup] LiveVoiceGateway initialization notice:', err?.message || err);
      });

    void Promise.all([
      import('./src/db/index.js'),
      import('./server/services/NotificationScheduler.js'),
    ])
      .then(async ([{ ensureDatabaseSchema }, { NotificationScheduler }]) => {
        const scheduler = new NotificationScheduler();
        try {
          await ensureDatabaseSchema();
        } catch (err: any) {
          console.error('[Server Startup] Deferred database schema initialization notice:', err?.message || err);
        }
        scheduler.start();
      })
      .catch((err: any) => {
        console.error('[Server Startup] Background warmup notice:', err?.message || err);
      });
  });

  // Graceful shutdown so rapid dev server restarts never leave stale port or PGlite locks
  let shuttingDown = false;
  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.info(`[Server Shutdown] Received ${signal}, closing server cleanly...`);
    try {
      await new Promise<void>((resolve) => httpServer.close(() => resolve()));
    } catch {
      // Ignore close errors during forced shutdown
    }
    try {
      if (viteServerRef) {
        await viteServerRef.close();
      }
    } catch {
      // Ignore Vite close errors
    }
    try {
      const { closeDatabase } = await import('./src/db/index.js');
      await closeDatabase();
    } catch {
      // Ignore DB close errors
    }
    process.exit(0);
  };

  process.once('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
  process.once('SIGINT', () => {
    void shutdown('SIGINT');
  });
}

startServer().catch((err) => {
  console.error('[Server Startup] Fatal startup error:', err);
  process.exit(1);
});
