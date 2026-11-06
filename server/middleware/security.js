/**
 * ARN Stream — HTTP security hardening
 * · OWASP security headers + conservative Content-Security-Policy
 * · Origin allow-list CORS (same-host, loopback dev, explicit CORS_ORIGINS)
 *
 * Notes:
 *  - The CSP is applied in production only, because the Vite dev server needs
 *    inline HMR scripts and websockets that would otherwise be blocked.
 *  - `upgrade-insecure-requests` is intentionally NOT set: ARN Stream is usually
 *    served over plain HTTP on a LAN (e.g. http://192.168.1.10:8096).
 */

const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]', '::1']);

function parseOrigin(origin) {
  try {
    return new URL(origin);
  } catch {
    return null;
  }
}

/**
 * Decides whether a browser Origin is allowed to call the API.
 * @param {string|undefined} origin  Value of the Origin header
 * @param {string|undefined} host    Value of the Host header (target server)
 */
export function isAllowedOrigin(origin, host, extraOrigins = []) {
  if (!origin) return true; // non-browser clients (curl, Android, DLNA) send no Origin
  if (origin === 'null') return false;

  const parsed = parseOrigin(origin);
  if (!parsed) return false;

  if (extraOrigins.includes(origin)) return true;

  // Same host (any scheme) → always allowed.
  if (host && parsed.host === host) return true;

  // Local development (Vite on :5173 talking to :8096, etc.).
  if (LOOPBACK_HOSTNAMES.has(parsed.hostname)) return true;

  if (process.env.CORS_ALLOW_ALL === 'true') return true;

  return false;
}

/**
 * Builds the options callback consumed by the `cors` middleware.
 */
export function buildCorsOptions() {
  const extraOrigins = String(process.env.CORS_ORIGINS || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return (req, callback) => {
    const origin = req.headers.origin;
    const allowed = isAllowedOrigin(origin, req.headers.host, extraOrigins);

    if (!allowed) {
      // Do not throw: just omit CORS headers so the browser blocks the response
      // while non-browser request handling is unaffected.
      return callback(null, { origin: false });
    }

    return callback(null, {
      origin: origin ? true : false,
      credentials: true,
      methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'X-ARN-Internal-Key',
        'X-Async',
        'Range',
        'If-Range',
        'X-No-Compression'
      ],
      exposedHeaders: [
        'Content-Range',
        'Accept-Ranges',
        'Content-Length',
        'Content-Disposition',
        'X-Response-Cache',
        'X-Stream-Mode',
        'X-Thumb-Duration',
        'RateLimit-Limit',
        'RateLimit-Remaining',
        'RateLimit-Reset',
        'Retry-After'
      ],
      maxAge: 600
    });
  };
}

const BASE_DIRECTIVES = {
  'base-uri': ["'self'"],
  'object-src': ["'none'"],
  'frame-ancestors': ["'self'"],
  'form-action': ["'self'"]
};

/**
 * @param {object} [options]
 * @param {boolean} [options.production] Apply the CSP as well
 */
export function securityHeadersMiddleware({ production = process.env.NODE_ENV === 'production' } = {}) {
  return function securityHeaders(req, res, next) {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
    res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
    res.setHeader('Permissions-Policy', 'camera=(self), microphone=(), geolocation=()');

    if (production) {
      const csp = {
        'default-src': ["'self'"],
        'script-src': ["'self'", "'unsafe-inline'"],
        'style-src': ["'self'", "'unsafe-inline'"],
        'img-src': ["'self'", 'data:', 'blob:', 'https:'],
        'media-src': ["'self'", 'blob:', 'data:'],
        'font-src': ["'self'", 'data:'],
        'connect-src': ["'self'", 'ws:', 'wss:'],
        'worker-src': ["'self'", 'blob:'],
        ...BASE_DIRECTIVES
      };
      res.setHeader(
        'Content-Security-Policy',
        Object.entries(csp).map(([key, values]) => `${key} ${values.join(' ')}`).join('; ')
      );

      if (req.secure || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') {
        res.setHeader('Strict-Transport-Security', 'max-age=15552000; includeSubDomains');
      }
    }

    // Authenticated API responses must never be cached by shared proxies.
    if (String(req.path || '').startsWith('/api/')) {
      res.setHeader('Cache-Control', 'no-store');
    }

    next();
  };
}

export default securityHeadersMiddleware;
