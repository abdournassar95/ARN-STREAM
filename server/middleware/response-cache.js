/**
 * ARN Stream — Response Cache Middleware
 * Uses node-cache for in-memory caching of GET API responses.
 * Reduces repeated DB queries for endpoints like /api/library/landing by ~100x on cache HIT.
 *
 * Owner: ARN Technology — عبده رجب نصار
 */

import NodeCache from 'node-cache';

// ─── Cache instance ──────────────────────────────────────────────────────────
const responseCache = new NodeCache({
  stdTTL: 300,           // 5 minutes default TTL
  checkperiod: 60,       // check for expired keys every 60s
  useClones: false       // faster reads (we only cache immutable JSON)
});

// ─── User-specific endpoints that should NEVER be cached ─────────────────────
const NEVER_CACHE = new Set([
  '/api/auth',
  '/api/playback',
  '/api/dashboard',
  '/api/stream',
  '/api/download',
  '/api/handoff',
  '/api/settings',
  '/api/search'
]);

// ─── Per-endpoint TTL overrides (seconds) ────────────────────────────────────
const TTL_OVERRIDES = {
  '/api/library/landing': 600,      // 10 min — landing page rarely changes
  '/api/library/movies-home': 600,  // 10 min
  '/api/library/music-home': 600,   // 10 min
  '/api/movies': 300,               // 5 min
  '/api/series': 300,               // 5 min
  '/api/artists': 300,              // 5 min
  '/api/albums': 300,               // 5 min
  '/api/tracks': 300,               // 5 min
  '/api/images': 300,               // 5 min
  '/api/collections': 300,          // 5 min
  '/api/playlists': 300,            // 5 min
  '/api/libraries': 600,            // 10 min
};

/**
 * Check if a path should be cached.
 * Skips: non-GET requests, user-specific routes, image binaries, streaming.
 */
function shouldCache(req) {
  if (req.method !== 'GET') return false;

  // Skip image binary routes (already served with Cache-Control headers)
  if (req.path.startsWith('/api/image/') && (req.path.endsWith('/full') || req.path.endsWith('/thumb'))) {
    return false;
  }

  // Skip DLNA routes
  if (req.path.startsWith('/dlna/')) return false;

  // Skip user-specific endpoints
  for (const prefix of NEVER_CACHE) {
    if (req.path.startsWith(prefix)) return false;
  }

  return true;
}

/**
 * Get TTL for a given path, falling back to default.
 */
function getTTL(reqPath) {
  // Try exact match first
  if (TTL_OVERRIDES[reqPath]) return TTL_OVERRIDES[reqPath];

  // Try prefix match (longest match wins)
  let bestTTL = 300; // default 5 min
  for (const [prefix, ttl] of Object.entries(TTL_OVERRIDES)) {
    if (reqPath.startsWith(prefix) && prefix.length > 0) {
      bestTTL = ttl;
    }
  }
  return bestTTL;
}

/**
 * Express middleware: caches GET API JSON responses in memory.
 * Adds X-Response-Cache: HIT | MISS header for observability.
 */
export function responseCacheMiddleware(req, res, next) {
  if (!shouldCache(req)) return next();

  const ttl = getTTL(req.path);
  const cacheKey = `${req.path}:${JSON.stringify(req.query)}`;

  // Check for cached response
  const cached = responseCache.get(cacheKey);
  if (cached) {
    res.setHeader('X-Response-Cache', 'HIT');
    res.setHeader('Cache-Control', `private, max-age=${ttl}`);
    return res.json(cached);
  }

  // Wrap res.json to intercept and cache the response
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    // Only cache successful responses
    if (res.statusCode === 200 && body) {
      responseCache.set(cacheKey, body, ttl);
      res.setHeader('X-Response-Cache', 'MISS');
      res.setHeader('Cache-Control', `private, max-age=${ttl}`);
    }
    return originalJson(body);
  };

  next();
}

/**
 * Invalidate cached entries matching a pattern.
 * Called after /api/scan or library modifications.
 * @param {string} pattern — substring to match (e.g., '/api/library')
 */
export function invalidateCache(pattern = '') {
  const keys = responseCache.keys();
  if (pattern) {
    const matched = keys.filter(k => k.includes(pattern));
    if (matched.length > 0) {
      responseCache.del(matched);
      console.log(`[ResponseCache] Invalidated ${matched.length} keys matching "${pattern}"`);
    }
  } else {
    responseCache.flushAll();
    console.log('[ResponseCache] Cache fully flushed');
  }
}

/**
 * Get cache statistics for dashboard / monitoring.
 */
export function getCacheStats() {
  return {
    keys: responseCache.keys().length,
    stats: responseCache.getStats(),
    ttlOverrides: Object.keys(TTL_OVERRIDES).length
  };
}
