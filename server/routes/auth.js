import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import db, {
  countUsers,
  findUserById,
  findUserByUsername,
  getAllUsers,
  createUser,
  updateUser,
  deleteUser,
  getAllLibraries
} from '../db.js';
import { getDataDir } from '../db.js';
import {
  hashPassword,
  verifyPassword,
  generateToken,
  optionalAuth,
  requireAuth,
  requireAdmin,
  requireSetupMode
} from '../services/auth.js';

const router = express.Router();

// Avatar upload storage setup (SVG disallowed for security/XSS protection)
const avatarsDir = path.join(getDataDir(), 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}

const avatarUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, avatarsDir);
    },
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase() || '.png';
      const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.png';
      const uniqueName = `avatar_${req.user?.id || 'usr'}_${Date.now()}${safeExt}`;
      cb(null, uniqueName);
    }
  }),
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExts = ['.jpg', '.jpeg', '.png', '.webp'];
    if (!allowedExts.includes(ext) || !file.mimetype.startsWith('image/') || ext === '.svg' || file.mimetype === 'image/svg+xml') {
      return cb(new Error('Only valid image files (.jpg, .jpeg, .png, .webp) are allowed'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 }
});

// In-memory rate limiter for login brute-force protection
const loginAttempts = new Map();

function checkLoginRateLimit(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return { allowed: true };
  }
  if (entry.count >= 8) {
    const waitSeconds = Math.ceil((entry.resetAt - now) / 1000);
    return { allowed: false, waitSeconds };
  }
  entry.count++;
  return { allowed: true };
}

function recordFailedLogin(ip) {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (entry) {
    entry.count++;
  } else {
    loginAttempts.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
  }
}

function normalizeDigits(str) {
  if (typeof str !== 'string') return str;
  return str
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}


/**
 * GET /api/auth/status
 * Returns system initialization status (whether an admin exists)
 * and whether the requesting client has a valid session.
 */
router.get('/status', optionalAuth, (req, res) => {
  const usersCount = countUsers();
  res.json({
    data: {
      initialized: usersCount > 0,
      authenticated: Boolean(req.user),
      user: req.user || null,
      hasLibraries: getAllLibraries().length > 0
    }
  });
});

/**
 * POST /api/auth/setup
 * First-run setup: creates the primary Super Admin account.
 * Only accessible when no users exist in the database (requireSetupMode).
 */
router.post('/setup', requireSetupMode, async (req, res) => {
  try {
    const { username, password, display_name } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Username and password are required.' }
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 4 characters.' }
      });
    }

    const password_hash = await hashPassword(password);
    const admin = createUser({
      username: username.trim(),
      password_hash,
      display_name: display_name ? display_name.trim() : username.trim(),
      role: 'admin',
      allowed_libraries: null
    });

    // Assign existing orphaned playlists to this initial admin
    try {
      db.prepare('UPDATE playlists SET user_id = ? WHERE user_id IS NULL').run(admin.id);
    } catch {}

    const token = generateToken(admin);
    res.cookie('arn_auth_token', token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
    res.json({
      data: {
        token,
        user: admin,
        message: 'Admin account created successfully'
      }
    });
  } catch (err) {
    console.error('[Auth Setup Error]', err);
    res.status(500).json({ error: { code: 'SETUP_FAILED', message: err.message } });
  }
});

/**
 * GET /api/auth/public-users
 * Get list of visible active users for the login profile selection screen
 */
router.get('/public-users', (req, res) => {
  try {
    const users = getAllUsers().filter(u => u.show_on_login && u.is_active);
    const safeUsers = users.map(u => ({
      id: u.id,
      username: u.username,
      display_name: u.display_name,
      avatar: u.avatar
    }));
    res.json({ data: safeUsers });
  } catch (error) {
    console.error(`Error fetching public users: ${error.message}`);
    res.status(500).json({ error: { code: 'SERVER_ERROR', message: 'Failed to fetch public users.' } });
  }
});

/**
 * POST /api/auth/login
 * Standard user login
 */
router.post('/login', async (req, res) => {
  try {
    const clientIp = req.ip || req.connection?.remoteAddress || 'unknown';
    const rateCheck = checkLoginRateLimit(clientIp);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: { 
          code: 'TOO_MANY_ATTEMPTS', 
          message: `تم حظر المحاولات مؤقتاً لتكرار الفشل. يرجى المحاولة بعد ${rateCheck.waitSeconds} ثانية.` 
        }
      });
    }

    let { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Username and password are required.' }
      });
    }

    username = username.trim();
    const normalizedUsername = normalizeDigits(username);

    const user = findUserByUsername(username) || findUserByUsername(normalizedUsername);
    if (!user) {
      recordFailedLogin(clientIp);
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' }
      });
    }

    if (!user.is_active) {
      return res.status(403).json({
        error: { code: 'ACCOUNT_DISABLED', message: 'This account has been disabled by an administrator.' }
      });
    }

    let isMatch = await verifyPassword(password, user.password_hash);
    if (!isMatch && normalizeDigits(password) !== password) {
      isMatch = await verifyPassword(normalizeDigits(password), user.password_hash);
    }

    if (!isMatch) {
      recordFailedLogin(clientIp);
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid username or password.' }
      });
    }

    // Clear failed login tracker on success
    clearLoginAttempts(clientIp);

    // Update last login timestamp
    updateUser(user.id, { last_login: new Date().toISOString() });

    const safeUser = findUserById(user.id);
    const token = generateToken(safeUser);

    res.cookie('arn_auth_token', token, {
      path: '/',
      httpOnly: false,
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.json({
      data: {
        token,
        user: safeUser,
        hasLibraries: getAllLibraries().length > 0
      }
    });
  } catch (err) {
    console.error('[Auth Login Error]', err);
    res.status(500).json({ error: { code: 'LOGIN_FAILED', message: err.message } });
  }
});

/**
 * POST /api/auth/logout
 * Clears session cookie
 */
router.post('/logout', (req, res) => {
  res.clearCookie('arn_auth_token', { path: '/' });
  res.json({ data: { success: true } });
});

/**
 * GET /api/auth/me
 * Get current authenticated user profile
 */
router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

/**
 * PUT /api/auth/password
 * Change password for current logged-in user
 */
router.put('/password', requireAuth, async (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    if (!new_password || new_password.length < 4) {
      return res.status(400).json({
        error: { code: 'INVALID_PASSWORD', message: 'New password must be at least 4 characters.' }
      });
    }

    const user = findUserByUsername(req.user.username);
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const isMatch = await verifyPassword(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect.' }
      });
    }

    const password_hash = await hashPassword(new_password);
    updateUser(user.id, { password_hash });

    res.json({ data: { success: true, message: 'Password updated successfully' } });
  } catch (err) {
    console.error('[Change Password Error]', err);
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

/**
 * POST /api/auth/avatar
 * Upload avatar image for authenticated user
 */
router.post('/avatar', requireAuth, avatarUpload.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'No image uploaded.' } });
  }
  const avatarUrl = `/api/avatars/${req.file.filename}`;
  res.json({ data: { avatarUrl } });
});

/**
 * PUT /api/auth/profile
 * Update profile (display name, avatar, optional password) for current user
 */
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { display_name, avatar, current_password, new_password } = req.body;
    const user = findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: { code: 'USER_NOT_FOUND', message: 'User not found.' } });
    }

    const updates = {};
    if (display_name !== undefined) {
      updates.display_name = display_name ? display_name.trim() : user.username;
    }
    if (avatar !== undefined) {
      updates.avatar = avatar || null;
    }

    if (new_password) {
      if (!current_password) {
        return res.status(400).json({ error: { code: 'CURRENT_PASSWORD_REQUIRED', message: 'Current password is required to set a new password.' } });
      }
      if (new_password.length < 4) {
        return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'New password must be at least 4 characters.' } });
      }
      const fullUser = findUserByUsername(user.username);
      const isMatch = await verifyPassword(current_password, fullUser.password_hash);
      if (!isMatch) {
        return res.status(400).json({ error: { code: 'WRONG_PASSWORD', message: 'Current password is incorrect.' } });
      }
      updates.password_hash = await hashPassword(new_password);
    }

    const updated = updateUser(user.id, updates);
    res.json({ data: updated });
  } catch (err) {
    console.error('[Update Profile Error]', err);
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

// ----------------------------------------------------
// User Management Endpoints (Admin Only)
// ----------------------------------------------------

/**
 * GET /api/auth/users
 * List all users
 */
router.get('/users', requireAdmin, (req, res) => {
  const users = getAllUsers();
  res.json({ data: users });
});

/**
 * POST /api/auth/users
 * Admin creates a new user
 */
router.post('/users', requireAdmin, async (req, res) => {
  try {
    const { 
      username, 
      password, 
      display_name, 
      avatar = null,
      role = 'user', 
      allowed_libraries = null,
      can_download = true,
      can_cast = true,
      show_on_login = true
    } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: { code: 'INVALID_INPUT', message: 'Username and password are required.' }
      });
    }

    if (password.length < 4) {
      return res.status(400).json({
        error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 4 characters.' }
      });
    }

    const existing = findUserByUsername(username);
    if (existing) {
      return res.status(400).json({
        error: { code: 'USERNAME_TAKEN', message: 'Username already exists.' }
      });
    }

    const password_hash = await hashPassword(password);
    const newUser = createUser({
      username: username.trim(),
      password_hash,
      display_name: display_name ? display_name.trim() : username.trim(),
      avatar: avatar || null,
      role: ['admin', 'user', 'guest'].includes(role) ? role : 'user',
      allowed_libraries: Array.isArray(allowed_libraries) && allowed_libraries.length > 0 ? allowed_libraries : null,
      can_download: can_download === false || can_download === 0 ? 0 : 1,
      can_cast: can_cast === false || can_cast === 0 ? 0 : 1,
      show_on_login: show_on_login === false || show_on_login === 0 ? 0 : 1
    });

    res.status(201).json({ data: newUser });
  } catch (err) {
    console.error('[Admin Create User Error]', err);
    res.status(500).json({ error: { code: 'CREATE_FAILED', message: err.message } });
  }
});

/**
 * PUT /api/auth/users/:id
 * Admin updates an existing user
 */
router.put('/users/:id', requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const user = findUserById(id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    const updates = {};
    if (req.body.display_name !== undefined) updates.display_name = req.body.display_name;
    if (req.body.avatar !== undefined) updates.avatar = req.body.avatar;
    if (req.body.role !== undefined) {
      if (!['admin', 'user', 'guest'].includes(req.body.role)) {
        return res.status(400).json({ error: { code: 'INVALID_ROLE', message: 'Invalid role.' } });
      }
      updates.role = req.body.role;
    }
    if (req.body.allowed_libraries !== undefined) {
      updates.allowed_libraries = Array.isArray(req.body.allowed_libraries) && req.body.allowed_libraries.length > 0 
        ? req.body.allowed_libraries 
        : null;
    }
    if (req.body.can_download !== undefined) {
      updates.can_download = req.body.can_download === false || req.body.can_download === 0 ? 0 : 1;
    }
    if (req.body.can_cast !== undefined) {
      updates.can_cast = req.body.can_cast === false || req.body.can_cast === 0 ? 0 : 1;
    }
    if (req.body.show_on_login !== undefined) {
      updates.show_on_login = req.body.show_on_login === false || req.body.show_on_login === 0 ? 0 : 1;
    }
    if (req.body.is_active !== undefined) {
      // Don't allow deactivating self
      if (req.user?.id === id && req.body.is_active === false) {
        return res.status(400).json({ error: { code: 'CANNOT_DEACTIVATE_SELF', message: 'You cannot deactivate your own account.' } });
      }
      updates.is_active = Boolean(req.body.is_active);
    }
    if (req.body.password) {
      if (req.body.password.length < 4) {
        return res.status(400).json({ error: { code: 'WEAK_PASSWORD', message: 'Password must be at least 4 characters.' } });
      }
      updates.password_hash = await hashPassword(req.body.password);
    }

    const updated = updateUser(id, updates);
    res.json({ data: updated });
  } catch (err) {
    console.error('[Admin Update User Error]', err);
    res.status(500).json({ error: { code: 'UPDATE_FAILED', message: err.message } });
  }
});

/**
 * DELETE /api/auth/users/:id
 * Admin deletes a user
 */
router.delete('/users/:id', requireAdmin, (req, res) => {
  try {
    const id = Number(req.params.id);
    if (req.user?.id === id) {
      return res.status(400).json({
        error: { code: 'CANNOT_DELETE_SELF', message: 'You cannot delete your own account.' }
      });
    }

    const user = findUserById(id);
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found.' } });
    }

    deleteUser(id);
    res.json({ data: { success: true, message: 'User deleted successfully' } });
  } catch (err) {
    console.error('[Admin Delete User Error]', err);
    res.status(500).json({ error: { code: 'DELETE_FAILED', message: err.message } });
  }
});

export default router;
