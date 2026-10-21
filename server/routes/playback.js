import express from 'express';
import db from '../db.js';
import { requireAuth } from '../services/auth.js';
import { getContinueWatching, removePlaybackState } from '../services/playback-manager.js';

const router = express.Router();

// All playback endpoints require authentication
router.use(requireAuth);

router.post('/', (req, res) => {
  const userId = req.user.id;

  const { media_type, media_id, position, duration } = req.body;
  if (!media_type || !media_id) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'media_type and media_id required' } });
  const allowed = ['movie', 'episode', 'track', 'series'];
  if (!allowed.includes(media_type)) return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Invalid media_type' } });

  // Update existing row for this user & media if exists, else insert
  const existing = db.prepare(`SELECT id FROM playback_state WHERE media_type = ? AND media_id = ? AND user_id = ?`).get(media_type, Number(media_id), userId);
  if (existing) {
    db.prepare(`UPDATE playback_state SET position = ?, duration = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .run(position ? Math.round(position) : 0, duration ? Math.round(duration) : null, existing.id);
  } else {
    try {
      db.prepare(`
        INSERT INTO playback_state (user_id, media_type, media_id, position, duration, updated_at)
        VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `).run(userId, media_type, Number(media_id), position ? Math.round(position) : 0, duration ? Math.round(duration) : null);
    } catch (e) {
      // Fallback if legacy UNIQUE constraint exists without user_id
      db.prepare(`
        UPDATE playback_state SET user_id = ?, position = ?, duration = ?, updated_at = CURRENT_TIMESTAMP
        WHERE media_type = ? AND media_id = ?
      `).run(userId, position ? Math.round(position) : 0, duration ? Math.round(duration) : null, media_type, Number(media_id));
    }
  }

  res.json({ data: { success: true } });
});

router.get('/continue', (req, res) => {
  const userId = req.user.id;
  const { limit = 15 } = req.query;
  const list = getContinueWatching(userId, { limit: Number(limit) });
  res.json({ data: list });
});

router.delete('/:type/:id', (req, res) => {
  const userId = req.user.id;
  removePlaybackState(userId, req.params.type, Number(req.params.id));
  res.json({ data: { success: true } });
});

export default router;
