/**
 * ARN Stream — In-memory rate limiting (dependency-free)
 *
 * Implements a fixed-window counter with bounded memory and automatic cleanup.
 * The pure `RateLimiter` class is unit-tested in server/tests/rate-limit.test.js.
 */

export class RateLimiter {
  /**
   * @param {object} options
   * @param {number} options.windowMs  Window size in milliseconds
   * @param {number} options.max       Maximum requests per window per key
   * @param {number} [options.maxKeys] Maximum distinct keys kept in memory
   */
  constructor({ windowMs = 60_000, max = 600, maxKeys = 20_000 } = {}) {
    this.windowMs = Math.max(1000, Number(windowMs) || 60_000);
    this.max = Math.max(1, Number(max) || 600);
    this.maxKeys = Math.max(100, Number(maxKeys) || 20_000);
    this.buckets = new Map();
  }

  /**
   * Count one hit for `key`.
   * @returns {{allowed: boolean, remaining: number, retryAfterMs: number, resetAt: number}}
   */
  consume(key, now = Date.now()) {
    const bucketKey = String(key || 'unknown');

    // Opportunistic cleanup so long-running servers do not leak memory.
    if (this.buckets.size > this.maxKeys) this.prune(now);

    let bucket = this.buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + this.windowMs };
      this.buckets.set(bucketKey, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, this.max - bucket.count);
    const allowed = bucket.count <= this.max;

    return {
      allowed,
      remaining,
      resetAt: bucket.resetAt,
      retryAfterMs: allowed ? 0 : Math.max(0, bucket.resetAt - now)
    };
  }

  reset(key) {
    if (key === undefined) this.buckets.clear();
    else this.buckets.delete(String(key));
  }

  prune(now = Date.now()) {
    for (const [key, bucket] of this.buckets) {
      if (!bucket || bucket.resetAt <= now) this.buckets.delete(key);
    }
    // Still too large → drop the oldest entries (Map preserves insertion order).
    if (this.buckets.size > this.maxKeys) {
      const overflow = this.buckets.size - this.maxKeys;
      let removed = 0;
      for (const key of this.buckets.keys()) {
        this.buckets.delete(key);
        if (++removed >= overflow) break;
      }
    }
  }
}

/**
 * Express middleware factory.
 */
export function createRateLimitMiddleware(options = {}) {
  const {
    windowMs = 60_000,
    max = 600,
    message = 'عدد الطلبات كبير جداً — يرجى المحاولة بعد قليل.',
    code = 'RATE_LIMITED',
    keyGenerator = (req) => req.ip || req.socket?.remoteAddress || 'unknown',
    skip = () => false
  } = options;

  const limiter = new RateLimiter({ windowMs, max });
  const cleanupTimer = setInterval(() => limiter.prune(), Math.max(windowMs, 60_000));
  cleanupTimer.unref?.();

  function middleware(req, res, next) {
    try {
      if (skip(req)) return next();

      const result = limiter.consume(keyGenerator(req));
      res.setHeader('RateLimit-Limit', String(max));
      res.setHeader('RateLimit-Remaining', String(result.remaining));
      res.setHeader('RateLimit-Reset', String(Math.max(0, Math.ceil((result.resetAt - Date.now()) / 1000))));

      if (!result.allowed) {
        res.setHeader('Retry-After', String(Math.max(1, Math.ceil(result.retryAfterMs / 1000))));
        return res.status(429).json({ error: { code, message } });
      }

      return next();
    } catch (err) {
      // Never block traffic because of a limiter bug.
      console.error('[RateLimit] error:', err.message);
      return next();
    }
  }

  middleware.limiter = limiter;
  return middleware;
}

export default createRateLimitMiddleware;
