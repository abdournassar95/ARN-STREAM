import http from 'http';
import https from 'https';
import { URL } from 'url';
import { getRequestToken } from './auth.js';
import { parseId } from './ids.js';
import { canAccessMediaItem, findMediaTypeById } from './query.js';

const PROXY_HEADERS = [
  'content-type',
  'content-length',
  'content-range',
  'accept-ranges',
  'cache-control',
  'etag',
  'last-modified',
  'content-disposition',
  'x-stream-mode'
];

export function publicBaseUrl(req) {
  const configured = process.env.ARN_PUBLIC_URL || process.env.ARN_JF_PUBLIC_URL;
  if (configured) return String(configured).replace(/\/+$/, '');

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'];
  const protocol = forwardedProto ? String(forwardedProto).split(',')[0].trim() : req.protocol;
  const host = forwardedHost ? String(forwardedHost).split(',')[0].trim() : req.get('host');
  return `${protocol}://${host}`;
}

export function internalBaseUrl(req) {
  const port = req.socket && req.socket.localPort ? req.socket.localPort : (process.env.PORT || 8096);
  return `http://127.0.0.1:${port}`;
}

export function resolveStreamableId(value) {
  const parsed = parseId(value);
  if (parsed && (parsed.type === 'movie' || parsed.type === 'episode' || parsed.type === 'track')) {
    return parsed;
  }
  const fallbackType = findMediaTypeById(value);
  return fallbackType ? { type: fallbackType, id: Number(value) } : null;
}

export function buildStreamUrl(req, type, id, options = {}) {
  if (type !== 'movie' && type !== 'episode' && type !== 'track') return null;

  const relative = options.relative
    ? `/api/stream/${type}/${id}`
    : `${publicBaseUrl(req)}/api/stream/${type}/${id}`;
  const url = new URL(relative, 'http://localhost');
  const token = options.token || getRequestToken(req);

  if (token) url.searchParams.set('token', token);
  if (options.startSeconds) url.searchParams.set('t', String(Math.floor(options.startSeconds)));
  if (options.mode) url.searchParams.set('mode', options.mode);

  if (options.relative) {
    return `${url.pathname}${url.search}`;
  }
  return url.toString();
}

export function proxyStream(req, res, target) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const url = new URL(target);
    const client = url.protocol === 'https:' ? https : http;
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    if (req.headers['user-agent']) headers['User-Agent'] = req.headers['user-agent'];
    headers.Accept = '*/*';

    const upstream = client.request(url, { method: 'GET', headers }, (upstreamRes) => {
      if (!res.headersSent) {
        res.status(upstreamRes.statusCode || 502);
        for (const name of PROXY_HEADERS) {
          const value = upstreamRes.headers[name];
          if (value !== undefined) res.setHeader(name, value);
        }
        if (!upstreamRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', 'bytes');
        }
      }

      upstreamRes.on('error', () => {
        if (!res.headersSent) res.status(502).end();
        else res.destroy();
        finish();
      });
      upstreamRes.on('end', finish);
      upstreamRes.pipe(res);
    });

    upstream.on('error', (error) => {
      if (!res.headersSent) {
        res.status(502).json({ error: `Stream proxy failed: ${error.message}` });
      } else {
        res.destroy();
      }
      finish();
    });

    upstream.setTimeout(30000, () => upstream.destroy(new Error('Stream timeout')));

    res.on('close', () => {
      upstream.destroy();
      finish();
    });

    upstream.end();
  });
}

export function handleItemStream(req, res) {
  const parsed = resolveStreamableId(req.params.itemId);
  if (!parsed) {
    return res.status(404).json({ error: 'Item not found' });
  }
  if (!canAccessMediaItem(req.jfUser, parsed.type, parsed.id)) {
    return res.status(404).json({ error: 'Item not found' });
  }

  const startTicks = Number(req.query.StartTimeTicks || req.query.startTimeTicks || 0);
  const startSeconds = startTicks > 0 ? startTicks / 10000000 : Number(req.query.StartTime || 0);
  const mode = req.query.Static === 'true' || req.query.static === 'true'
    ? 'direct'
    : (req.query.mode || undefined);

  const target = new URL(`${internalBaseUrl(req)}/api/stream/${parsed.type}/${parsed.id}`);
  target.searchParams.set('token', req.jfToken || getRequestToken(req) || '');
  if (startSeconds) target.searchParams.set('t', String(Math.floor(startSeconds)));
  if (mode) target.searchParams.set('mode', mode);

  return proxyStream(req, res, target.toString());
}
