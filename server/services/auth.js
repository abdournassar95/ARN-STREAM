import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs';
import db, { getSetting, setSetting, findUserById, countUsers } from '../db.js';

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const internalKeyPath = path.join(appData, 'ARN_Stream', '.internal_key');
let cachedInternalKey = null;

export function getInternalKey() {
  if (cachedInternalKey) return cachedInternalKey;
  try {
    const dir = path.dirname(internalKeyPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(internalKeyPath)) {
      cachedInternalKey = fs.readFileSync(internalKeyPath, 'utf-8').trim();
    } else {
      cachedInternalKey = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(internalKeyPath, cachedInternalKey, { encoding: 'utf-8' });
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

// Get or initialize JWT secret key
function getJwtSecret() {
  let secret = getSetting('jwt_secret');
  if (!secret) {
    secret = crypto.randomBytes(32).toString('hex');
    setSetting('jwt_secret', secret);
  }
  return secret;
}

export async function hashPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
}

export async function verifyPassword(plainPassword, hashedPassword) {
  if (!plainPassword || !hashedPassword) return false;
  return bcrypt.compare(plainPassword, hashedPassword);
}

export function generateToken(user) {
  const secret = getJwtSecret();
  const payload = {
    id: user.id,
    username: user.username,
    role: user.role
  };
  return jwt.sign(payload, secret, { expiresIn: '30d' });
}

export function verifyToken(token) {
  try {
    const secret = getJwtSecret();
    return jwt.verify(token, secret);
  } catch (e) {
    return null;
  }
}

/**
 * Middleware: Extract token from Bearer header or query string (?token=...)
 * Attaches user to req.user if valid.
 */
export function optionalAuth(req, res, next) {
  // Check for local desktop application internal key (loopback host authentication)
  const internalHeader = req.headers['x-arn-internal-key'];
  const clientIp = req.ip || req.connection?.remoteAddress || '';
  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  if (internalHeader && isLoopback) {
    const validKey = getInternalKey();
    if (validKey && internalHeader === validKey) {
      req.user = { id: 1, username: 'admin', role: 'admin', is_active: 1, isInternal: true };
      return next();
    }
  }

  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryToken = req.query?.token;
  let cookieToken = null;
  if (req.cookies?.arn_auth_token) {
    cookieToken = req.cookies.arn_auth_token;
  } else if (req.headers.cookie) {
    const match = req.headers.cookie.match(/(?:^|;\s*)arn_auth_token=([^;]+)/);
    if (match) {
      cookieToken = decodeURIComponent(match[1]);
    }
  }
  const token = bearerToken || queryToken || cookieToken;

  if (!token) {
    req.user = null;
    return next();
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    req.user = null;
    return next();
  }

  const user = findUserById(decoded.id);
  if (user && user.is_active) {
    req.user = user;
    if (res && typeof res.cookie === 'function' && !cookieToken) {
      try {
        res.cookie('arn_auth_token', token, {
          httpOnly: false,
          path: '/',
          maxAge: 30 * 24 * 60 * 60 * 1000,
          sameSite: 'lax'
        });
      } catch (e) {}
    }
  } else {
    req.user = null;
  }
  next();
}

/**
 * Middleware: Requires an authenticated user.
 * NOTE: There is intentionally NO "zero users" bypass here. First-run setup
 * is handled exclusively by POST /api/auth/setup (guarded by requireSetupMode).
 * Every other protected route requires a valid token, even on a fresh system.
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

/**
 * Middleware: Requires the user to have 'admin' role.
 */
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
 * users (first-run setup mode). Once any account exists, setup is closed.
 * Rejects with the same ALREADY_INITIALIZED contract the setup endpoint
 * historically returned, so existing clients are unaffected.
 */
export function requireSetupMode(req, res, next) {
  if (countUsers() > 0) {
    return res.status(400).json({
      error: { code: 'ALREADY_INITIALIZED', message: 'System is already initialized. Please log in.' }
    });
  }
  next();
}
