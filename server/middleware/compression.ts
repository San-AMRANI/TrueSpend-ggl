import type { NextFunction, Request, Response } from 'express';
import zlib from 'node:zlib';

const COMPRESSIBLE_CONTENT_TYPE = /^(text\/|application\/(json|javascript|xml|x-javascript|xhtml\+xml)|.*\+json\b)/i;
const MIN_COMPRESS_BYTES = 1024;

function appendVaryAcceptEncoding(res: Response) {
  const existing = res.getHeader('Vary');
  if (!existing) {
    res.setHeader('Vary', 'Accept-Encoding');
    return;
  }
  const str = Array.isArray(existing) ? existing.join(', ') : String(existing);
  if (!str.toLowerCase().includes('accept-encoding')) {
    res.setHeader('Vary', `${str}, Accept-Encoding`);
  }
}

/**
 * Lightweight gzip response compression middleware using Node's built-in zlib.
 * Intercepts res.json / res.send payloads >= 1 KB when the client accepts gzip.
 */
export function gzipResponseCompression(req: Request, res: Response, next: NextFunction) {
  if (req.method === 'HEAD') return next();
  const acceptEncoding = String(req.headers['accept-encoding'] || '');
  if (!/\bgzip\b/i.test(acceptEncoding)) return next();

  const origSend = res.send.bind(res);
  const origJson = res.json.bind(res);

  const sendMaybeCompressed = (body: any) => {
    if (res.headersSent || res.statusCode === 204 || res.statusCode === 304) {
      return origSend(body);
    }
    if (res.getHeader('Content-Encoding')) {
      return origSend(body);
    }

    const contentType = String(res.getHeader('Content-Type') || '');
    if (contentType && !COMPRESSIBLE_CONTENT_TYPE.test(contentType)) {
      return origSend(body);
    }

    let rawBuffer: Buffer | null = null;
    if (Buffer.isBuffer(body)) {
      rawBuffer = body;
    } else if (typeof body === 'string') {
      rawBuffer = Buffer.from(body, 'utf8');
    } else {
      return origSend(body);
    }

    if (rawBuffer.length < MIN_COMPRESS_BYTES) {
      return origSend(body);
    }

    try {
      const compressed = zlib.gzipSync(rawBuffer, { level: zlib.constants.Z_BEST_SPEED });
      if (compressed.length >= rawBuffer.length) {
        return origSend(body);
      }
      res.setHeader('Content-Encoding', 'gzip');
      res.setHeader('Content-Length', String(compressed.length));
      appendVaryAcceptEncoding(res);
      return origSend(compressed);
    } catch {
      return origSend(body);
    }
  };

  res.json = ((payload: any) => {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    const serialized = JSON.stringify(payload);
    return sendMaybeCompressed(serialized);
  }) as any;

  res.send = ((body?: any) => {
    if (typeof body === 'string' || Buffer.isBuffer(body)) {
      return sendMaybeCompressed(body);
    }
    if (body !== undefined && body !== null && typeof body === 'object') {
      if (!res.getHeader('Content-Type')) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      return sendMaybeCompressed(JSON.stringify(body));
    }
    return origSend(body);
  }) as any;

  next();
}
