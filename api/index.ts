import express from 'express';
import cookieParser from 'cookie-parser';
import apiRouter from '../server/routes/index.js';
import { gzipResponseCompression } from '../server/middleware/compression.js';
import {
  validateAuthConfig,
  isOriginAllowed,
  isProductionEnv,
} from '../server/services/SecurityCrypto.js';

// Fail closed in production if security secrets are missing or weak
validateAuthConfig();

const app = express();
const GITHUB_APK_URL =
  'https://github.com/San-AMRANI/TrueSpend-ggl/releases/latest/download/TrueSpend.apk';

app.set('trust proxy', 1);
app.use(gzipResponseCompression);
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (isProductionEnv()) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

const downloadLatestApk = async (_req: express.Request, res: express.Response) => {
  try {
    const response = await fetch(GITHUB_APK_URL, { redirect: 'follow' });
    if (!response.ok) {
      res.status(response.status).json({ error: 'The latest Android APK is unavailable.' });
      return;
    }

    const apk = Buffer.from(await response.arrayBuffer());
    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Content-Disposition', 'attachment; filename="TrueSpend.apk"');
    res.setHeader('Content-Length', String(apk.length));
    res.send(apk);
  } catch (error) {
    console.error('APK download proxy failed', error);
    res.status(502).json({ error: 'Could not retrieve the latest Android APK.' });
  }
};

// Vercel rewrites /api/* requests to this function at /; support both paths.
app.get('/download-apk', downloadLatestApk);
app.get('/api/download-apk', downloadLatestApk);

// Strict origin allowlist for Vercel API / Capacitor native WebView
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
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
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

app.use('/api', apiRouter);

export default app;
