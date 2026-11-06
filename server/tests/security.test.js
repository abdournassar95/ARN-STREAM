import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedOrigin, securityHeadersMiddleware } from '../middleware/security.js';

test('non-browser clients without Origin are allowed', () => {
  assert.equal(isAllowedOrigin(undefined, '192.168.1.10:8096'), true);
});

test('same-host origin is allowed', () => {
  assert.equal(isAllowedOrigin('http://192.168.1.10:8096', '192.168.1.10:8096'), true);
  assert.equal(isAllowedOrigin('https://media.example.com', 'media.example.com'), true);
});

test('loopback development origins are allowed', () => {
  assert.equal(isAllowedOrigin('http://localhost:5173', 'localhost:8096'), true);
  assert.equal(isAllowedOrigin('http://127.0.0.1:5173', '127.0.0.1:8096'), true);
});

test('foreign origins are rejected', () => {
  assert.equal(isAllowedOrigin('https://evil.example.com', '192.168.1.10:8096'), false);
  assert.equal(isAllowedOrigin('null', '192.168.1.10:8096'), false);
  assert.equal(isAllowedOrigin('not-a-url', '192.168.1.10:8096'), false);
});

test('explicit allow-list wins', () => {
  assert.equal(
    isAllowedOrigin('https://app.example.com', '192.168.1.10:8096', ['https://app.example.com']),
    true
  );
});

test('security headers are applied', () => {
  const middleware = securityHeadersMiddleware({ production: true });
  const headers = {};
  const req = { path: '/api/movies', headers: {}, secure: false };
  const res = { setHeader(k, v) { headers[k] = v; } };
  middleware(req, res, () => {});
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['X-Frame-Options'], 'SAMEORIGIN');
  assert.match(headers['Content-Security-Policy'], /default-src 'self'/);
  assert.equal(headers['Cache-Control'], 'no-store');
  assert.equal(headers['Strict-Transport-Security'], undefined);
});
