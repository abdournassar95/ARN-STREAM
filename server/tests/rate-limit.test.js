import test from 'node:test';
import assert from 'node:assert/strict';
import { RateLimiter, createRateLimitMiddleware } from '../middleware/rate-limit.js';

test('allows requests up to the limit then blocks', () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 3 });
  const now = 1_000_000;
  assert.equal(limiter.consume('ip', now).allowed, true);
  assert.equal(limiter.consume('ip', now).allowed, true);
  const third = limiter.consume('ip', now);
  assert.equal(third.allowed, true);
  assert.equal(third.remaining, 0);
  const fourth = limiter.consume('ip', now);
  assert.equal(fourth.allowed, false);
  assert.ok(fourth.retryAfterMs > 0);
});

test('keys are isolated from each other', () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
  const now = 5;
  assert.equal(limiter.consume('a', now).allowed, true);
  assert.equal(limiter.consume('a', now).allowed, false);
  assert.equal(limiter.consume('b', now).allowed, true);
});

test('window resets after it expires', () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 1 });
  assert.equal(limiter.consume('ip', 0).allowed, true);
  assert.equal(limiter.consume('ip', 500).allowed, false);
  assert.equal(limiter.consume('ip', 1001).allowed, true);
});

test('prune removes expired buckets and respects maxKeys', () => {
  const limiter = new RateLimiter({ windowMs: 1000, max: 5, maxKeys: 100 });
  limiter.consume('old', 0);
  limiter.consume('new', 2000);
  limiter.prune(3000);
  assert.equal(limiter.buckets.has('old'), false);
});

test('middleware returns 429 and rate-limit headers', () => {
  const middleware = createRateLimitMiddleware({ windowMs: 60_000, max: 1 });
  const headers = {};
  const req = { ip: '10.0.0.1', socket: {}, headers: {}, path: '/api/x' };
  const res = {
    statusCode: 200,
    body: null,
    setHeader(k, v) { headers[k] = v; },
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; return this; }
  };

  let called = 0;
  middleware(req, res, () => { called += 1; });
  assert.equal(called, 1);
  assert.equal(res.statusCode, 200);
  assert.equal(headers['RateLimit-Limit'], '1');

  middleware(req, res, () => { called += 1; });
  assert.equal(called, 1, 'second request must be blocked');
  assert.equal(res.statusCode, 429);
  assert.equal(res.body.error.code, 'RATE_LIMITED');
});
