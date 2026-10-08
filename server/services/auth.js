import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import db, { getSetting, setSetting, findUserById, countUsers } from '../db.js';

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
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  const queryToken = req.query?.token;
  const token = bearerToken || queryToken;

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
