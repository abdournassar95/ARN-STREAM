import express from 'express';
import db from '../db.js';
import { requireAuth } from '../services/auth.js';

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
  const { limit = 10 } = req.query;
  const rows = db.prepare(`
    SELECT playback_state.*, 
      CASE 
        WHEN playback_state.media_type='movie' THEN (SELECT title FROM movies WHERE movies.id=playback_state.media_id)
        WHEN playback_state.media_type='episode' THEN (SELECT title FROM episodes WHERE episodes.id=playback_state.media_id)
        WHEN playback_state.media_type='track' THEN (SELECT title FROM tracks WHERE tracks.id=playback_state.media_id)
      END as title
    FROM playback_state
    WHERE user_id = ? AND position > 0 AND (duration IS NULL OR position < duration * 0.9)
    ORDER BY updated_at DESC LIMIT ?
  `).all(userId, Number(limit));
  res.json({ data: rows });
});

router.delete('/:type/:id', (req, res) => {
  const userId = req.user.id;
  db.prepare(`DELETE FROM playback_state WHERE media_type=? AND media_id=? AND user_id = ?`).run(req.params.type, Number(req.params.id), userId);
  res.json({ data: { success: true } });
});

export default router;
