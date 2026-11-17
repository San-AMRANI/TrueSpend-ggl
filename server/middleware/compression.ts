import { Request, Response, NextFunction } from 'express';
import zlib from 'node:zlib';

const COMPRESSIBLE_CONTENT_TYPE =
  /^(application\/json|text\/|application\/javascript|application\/xml|image\/svg\+xml)/i;
const MIN_COMPRESS_BYTES = 1024;

/**
 * Lightweight built-in Gzip / Deflate Express compression middleware.
 * Avoids adding external dependencies while cutting large JSON bootstrap & static payloads by ~70-80%.
 */
export function httpCompressionMiddleware(req: Request, res: Response, next: NextFunction) {
  if (
    req.method === 'HEAD' ||
    req.path === '/api/download-apk' ||
    req.path === '/download-apk' ||
    req.path === '/api/chat/live-turn' ||
    req.path === '/chat/live-turn'
  ) {
    next();
    return;
  }

  const acceptEncoding = String(req.headers['accept-encoding'] || '').toLowerCase();
  const useGzip = acceptEncoding.includes('gzip');
  const useDeflate = !useGzip && acceptEncoding.includes('deflate');

  if (!useGzip && !useDeflate) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: any) => {
    try {
      const jsonStr = JSON.stringify(body);
      const byteLength = Buffer.byteLength(jsonStr, 'utf8');
      if (byteLength < MIN_COMPRESS_BYTES || res.headersSent) {
        return originalJson(body);
      }

      const buf = Buffer.from(jsonStr, 'utf8');
      const compressed = useGzip ? zlib.gzipSync(buf, { level: 6 }) : zlib.deflateSync(buf, { level: 6 });

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Encoding', useGzip ? 'gzip' : 'deflate');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      return res.send(compressed);
    } catch {
      return originalJson(body);
    }
  }) as typeof res.json;

  const originalSend = res.send.bind(res);
  res.send = ((body?: any) => {
    try {
      if (
        res.headersSent ||
        res.getHeader('Content-Encoding') ||
        body === undefined ||
        body === null
      ) {
        return originalSend(body);
      }

      const contentType = String(res.getHeader('Content-Type') || '');
      if (contentType && !COMPRESSIBLE_CONTENT_TYPE.test(contentType)) {
        return originalSend(body);
      }

      const buf = Buffer.isBuffer(body)
        ? body
        : typeof body === 'string'
        ? Buffer.from(body, 'utf8')
        : null;

      if (!buf || buf.length < MIN_COMPRESS_BYTES) {
        return originalSend(body);
      }

      const compressed = useGzip ? zlib.gzipSync(buf, { level: 6 }) : zlib.deflateSync(buf, { level: 6 });
      res.setHeader('Content-Encoding', useGzip ? 'gzip' : 'deflate');
      res.setHeader('Vary', 'Accept-Encoding');
      res.removeHeader('Content-Length');
      return originalSend(compressed);
    } catch {
      return originalSend(body);
    }
  }) as typeof res.send;

  next();
}
