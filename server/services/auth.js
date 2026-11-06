import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import db, { getSetting, setSetting, findUserById, countUsers } from '../db.js';

/* ══════════════════════════════════════════════════════════════════════════
 * ARN Stream — Authentication & Session Security
 * Hardened: httpOnly cookies, revocable tokens (token_version),
 * constant-time secret comparison, no query-string tokens on non-media APIs,
 * automatic rotation of known-leaked secrets.
 * ══════════════════════════════════════════════════════════════════════════ */

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + '/.local/share');
const internalKeyPath = path.join(appData, 'ARN_Stream', '.internal_key');
const AUTH_COOKIE = 'arn_auth_token';
const TOKEN_TTL = process.env.JWT_TTL || '30d';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

/**
 * Secrets that were published in the repository history.
 * If a stored secret matches one of these it is rotated automatically so that
 * any previously forged token becomes invalid.
 */
const REVOKED_JWT_SECRETS = new Set([
  'c2de67ea7de1cc08d39d5713f5dc71156254f47b4ea14454e6645989ae2c6abc'
]);

/**
 * Only these paths may accept a token from the query string (legacy media
 * players / Android ExoPlayer that cannot attach headers to <video src>).
 * Everything else must use the Authorization header or the httpOnly cookie.
 */
const MEDIA_QUERY_TOKEN_PATHS = /^\/(?:api\/(?:stream|download|subtitles|live\/proxy|image)|Videos|Audio|Items\/[^/]+\/(?:Download|stream)|dh\/|stream)/i;

let cachedInternalKey = null;

export function getInternalKey() {
  if (cachedInternalKey) return cachedInternalKey;
  try {
    const dir = path.dirname(internalKeyPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
    if (fs.existsSync(internalKeyPath)) {
      cachedInternalKey = fs.readFileSync(internalKeyPath, 'utf-8').trim();
    }
    if (!cachedInternalKey || cachedInternalKey.length < 32) {
      cachedInternalKey = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(internalKeyPath, cachedInternalKey, { encoding: 'utf-8', mode: 0o600 });
    }
  } catch (err) {
    console.error('[Auth] Internal key init error:', err.message);
  }
  return cachedInternalKey;
}

// Auto-initialize internal key on load so it always exists for desktop tray launcher
try {
  getInternalKey();
} catch (e) {
  console.error('[Auth] Failed to initialize internal key on load:', e.message);
}

/** Constant-time string comparison (prevents timing side channels). */
export function safeCompare(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/**
 * Returns the JWT signing secret.
 * Priority: JWT_SECRET env var → stored setting. Stored secrets that were
 * leaked publicly (or are too short) are rotated once, invalidating old tokens.
 */
function getJwtSecret() {
  const envSecret = (process.env.JWT_SECRET || '').trim();
  if (envSecret.length >= 32) return envSecret;

  let secret = getSetting('jwt_secret');
  if (!secret || secret.length < 32 || REVOKED_JWT_SECRETS.has(secret)) {
    const previous = secret;
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('jwt_secret', secret);
    if (previous) {
      console.warn('[Auth] 🔐 تم تدوير مفتاح توقيع الجلسات (JWT secret) — كل الجلسات السابقة أصبحت غير صالحة.');
    }
  }
  return secret;
}

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

import { validatePasswordStrength } from '../utils/password-policy.js';

export { validatePasswordStrength };

export function getUserTokenVersion(userId) {
  try {
    const row = db.prepare('SELECT token_version FROM users WHERE id = ?').get(userId);
    return row?.token_version || 0;
  } catch {
    return 0;
  }
}

/** Invalidates every issued token for a user (logout everywhere). */
export function bumpTokenVersion(userId) {
  try {
    db.prepare('UPDATE users SET token_version = COALESCE(token_version, 0) + 1 WHERE id = ?').run(userId);
    return true;
  } catch (err) {
    console.error('[Auth] Failed to bump token version:', err.message);
    return false;
  }
}

export function generateToken(user) {
  const secret = getJwtSecret();
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role,
    tv: getUserTokenVersion(user.id)
  };
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token) {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch {
    return null;
  }
}

/** Cookie options: httpOnly by default, Secure automatically behind HTTPS. */
export function authCookieOptions(req) {
  const forwardedProto = String(req?.headers?.['x-forwarded-proto'] || '').split(',')[0].trim();
  const isSecure = Boolean(req?.secure) || forwardedProto === 'https';
  return {
    httpOnly: true,
    path: '/',
    sameSite: 'lax',
    secure: isSecure,
    maxAge: COOKIE_MAX_AGE
  };
}

export function setAuthCookie(res, token, req) {
  if (!res || typeof res.cookie !== 'function') return;
  try {
    res.cookie(AUTH_COOKIE, token, authCookieOptions(req));
  } catch { /* ignore cookie errors */ }
}

export function clearAuthCookie(res) {
  if (!res || typeof res.clearCookie !== 'function') return;
  try {
    res.clearCookie(AUTH_COOKIE, { path: '/', httpOnly: true, sameSite: 'lax' });
  } catch { /* ignore */ }
}

/** Reads the auth cookie from the raw Cookie header (no cookie-parser needed). */
export function readAuthCookie(req) {
  const raw = req?.headers?.cookie;
  if (!raw) return null;
  const match = raw.match(new RegExp(`(?:^|;\\s*)${AUTH_COOKIE}=([^;]+)`));
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function isLoopbackRequest(req) {
  const ip = req?.socket?.remoteAddress || req?.connection?.remoteAddress || '';
  return ip === '127.0.0.1' || ip === '::1' || ip === '::ffff:127.0.0.1';
}

function mayUseQueryToken(reqPath = '') {
  return MEDIA_QUERY_TOKEN_PATHS.test(String(reqPath || ''));
}

/**
 * Resolves the authenticated user for a request (never throws).
 * Token sources: Bearer header → httpOnly cookie → query (media paths only).
 */
export function resolveUserFromToken(token) {
  if (!token || typeof token !== 'string') return null;
  const decoded = verifyToken(token);
  if (!decoded || !decoded.id) return null;

  const user = findUserById(decoded.id);
  if (!user || !user.is_active) return null;

  // Token revocation check — bumping token_version logs the user out everywhere.
  if (Number(decoded.tv || 0) !== Number(user.token_version || 0)) return null;

  return user;
}

export function resolveRequestUser(req) {
  const internalHeader = req.headers['x-arn-internal-key'];
  if (internalHeader && isLoopbackRequest(req)) {
    const validKey = getInternalKey();
    if (validKey && safeCompare(internalHeader, validKey)) {
      return { id: 1, username: 'admin', role: 'admin', is_active: 1, isInternal: true };
    }
  }

  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const cookieToken = readAuthCookie(req);
  const queryToken = mayUseQueryToken(req.path) ? (req.query?.token || null) : null;
  const token = bearerToken || cookieToken || queryToken;

  if (!token || typeof token !== 'string') return null;

  return resolveUserFromToken(token);
}

/**
 * Middleware: attaches req.user when a valid token is present.
 * Also mirrors Bearer tokens into an httpOnly cookie for browsers.
 */
export function optionalAuth(req, res, next) {
  req.user = resolveRequestUser(req);

  if (req.user && res && typeof res.cookie === 'function') {
    const bearer = req.headers['authorization'];
    if (bearer && bearer.startsWith('Bearer ') && !readAuthCookie(req)) {
      setAuthCookie(res, bearer.slice(7).trim(), req);
    }
  }

  next();
}

/**
 * Middleware: Requires an authenticated user.
 * NOTE: There is intentionally NO "zero users" bypass here. First-run setup
 * is handled exclusively by POST /api/auth/setup (guarded by requireSetupMode).
 */
export function requireAuth(req, res, next) {
  if (req.user) return next();
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Authentication required. Please log in.' }
      });
    }
    next();
  });
}

/** Middleware: Requires the user to have 'admin' role. */
export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Administrator privileges required.' }
      });
    }
    next();
  });
}

/**
 * Middleware: Setup-only gate. Allows access ONLY while the system has zero
 * users (first-run setup mode). Rejects with the same ALREADY_INITIALIZED
 * contract the setup endpoint historically returned.
 */
export function requireSetupMode(req, res, next) {
  if (countUsers() > 0) {
    return res.status(400).json({
      error: { code: 'ALREADY_INITIALIZED', message: 'System is already initialized. Please log in.' }
    });
  }
  next();
}

export { AUTH_COOKIE };
