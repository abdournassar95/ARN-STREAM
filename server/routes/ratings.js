import express from 'express';
import db from '../db.js';
import { optionalAuth } from '../services/auth.js';

const router = express.Router();

function getEffectiveUserId(req) {
  // Require authenticated user - no zero-users bypass
  return req.user?.id || null;
}

router.use(optionalAuth);

router.get('/:type/:id', (req, res) => {
  const userId = getEffectiveUserId(req);
  if (!userId) return res.json({ data: null });
  const r = db.prepare(`SELECT * FROM ratings WHERE media_type=? AND media_id=? AND user_id=?`).get(req.params.type, Number(req.params.id), userId);
  if (!r) return res.json({ data: null });
  res.json({ data: r });
});

router.post('/:type/:id', (req, res) => {
  const userId = getEffectiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required to submit ratings' } });
  }

  const { rating, review } = req.body;
  if (rating === undefined || rating === null) return res.status(400).json({ error: { code: 'MISSING_RATING', message: 'rating required' } });
  const val = Number(rating);
  if (isNaN(val) || val < 0.5 || val > 5) return res.status(400).json({ error: { code: 'INVALID_RATING', message: 'rating must be 0.5 to 5.0' } });
  // enforce half steps
  if (Math.round(val * 2) !== val * 2) return res.status(400).json({ error: { code: 'INVALID_STEP', message: 'rating must be in 0.5 steps' } });

  const stmt = db.prepare(`
    INSERT INTO ratings (user_id, media_type, media_id, rating, review, rated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET rating=excluded.rating, review=excluded.review, rated_at=CURRENT_TIMESTAMP
  `);
  stmt.run(userId, req.params.type, Number(req.params.id), val, review || null);
  const saved = db.prepare(`SELECT * FROM ratings WHERE media_type=? AND media_id=? AND user_id=?`).get(req.params.type, Number(req.params.id), userId);
  res.json({ data: saved });
});

router.delete('/:type/:id', (req, res) => {
  const userId = getEffectiveUserId(req);
  if (!userId) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required to delete ratings' } });
  }

  db.prepare(`DELETE FROM ratings WHERE media_type=? AND media_id=? AND user_id=?`).run(req.params.type, Number(req.params.id), userId);
  res.json({ data: { success: true } });
});

export default router;
