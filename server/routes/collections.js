import express from 'express';
import db from '../db.js';
import { requireAdmin, requireAuth } from '../services/auth.js';
const router = express.Router();

// Require authentication for collections
router.use(requireAuth);

router.get('/', (req, res) => {
  const cols = db.prepare(`SELECT * FROM collections ORDER BY sort_order, created_at DESC`).all();
  const enriched = cols.map(col => {
    const count = db.prepare(`SELECT COUNT(*) as c FROM collection_items WHERE collection_id=?`).get(col.id).c;
    const items = db.prepare(`SELECT * FROM collection_items WHERE collection_id=? ORDER BY position LIMIT 4`).all(col.id);
    return { ...col, itemsCount: count, preview: items };
  });
  res.json({ data: enriched });
});

router.post('/', requireAdmin, (req, res) => {
  const { name, description, type='manual', rules=null, cover_image_id=null } = req.body;
  if (!name) return res.status(400).json({ error: { code: 'MISSING_NAME', message: 'name required' } });
  const userId = req.user?.id || 1;
  const info = db.prepare(`INSERT INTO collections (user_id, name, description, type, rules, cover_image_id) VALUES (?, ?, ?, ?, ?, ?)`).run(userId, name, description || null, type, rules ? JSON.stringify(rules) : null, cover_image_id);
  const col = db.prepare(`SELECT * FROM collections WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json({ data: col });
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name, description, rules, cover_image_id, sort_order } = req.body;
  const col = db.prepare(`SELECT * FROM collections WHERE id=?`).get(req.params.id);
  if (!col) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } });
  db.prepare(`
    UPDATE collections SET name=COALESCE(?, name), description=COALESCE(?, description), rules=COALESCE(?, rules), cover_image_id=COALESCE(?, cover_image_id), sort_order=COALESCE(?, sort_order)
    WHERE id=?
  `).run(name, description, rules ? JSON.stringify(rules) : null, cover_image_id, sort_order, req.params.id);
  const updated = db.prepare(`SELECT * FROM collections WHERE id=?`).get(req.params.id);
  res.json({ data: updated });
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM collections WHERE id=?`).run(req.params.id);
  db.prepare(`DELETE FROM collection_items WHERE collection_id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

router.get('/:id', (req, res) => {
  const col = db.prepare(`SELECT * FROM collections WHERE id=?`).get(req.params.id);
  if (!col) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } });
  const items = db.prepare(`SELECT * FROM collection_items WHERE collection_id=? ORDER BY position`).all(col.id);
  // enrich items with titles
  const enriched = items.map(item => {
    let title = null, poster = null;
    if (item.media_type === 'movie') {
      const m = db.prepare(`SELECT title FROM movies WHERE id=?`).get(item.media_id);
      title = m?.title || null;
      const img = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND image_type='poster' AND is_primary=1`).get(item.media_id);
      poster = img ? `/api/image/${img.id}/thumb` : null;
    } else if (item.media_type === 'series') {
      const s = db.prepare(`SELECT title FROM series WHERE id=?`).get(item.media_id);
      title = s?.title || null;
      const img = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='poster' AND is_primary=1`).get(item.media_id);
      poster = img ? `/api/image/${img.id}/thumb` : null;
    }
    return { ...item, title, poster };
  });
  res.json({ data: { ...col, items: enriched } });
});

router.post('/:id/items', requireAdmin, (req, res) => {
  const { media_type, media_id } = req.body;
  if (!media_type || !media_id) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'media_type and media_id required' } });
  const maxPos = db.prepare(`SELECT MAX(position) as m FROM collection_items WHERE collection_id=?`).get(req.params.id).m || 0;
  const info = db.prepare(`INSERT INTO collection_items (collection_id, media_type, media_id, position) VALUES (?, ?, ?, ?)`).run(req.params.id, media_type, Number(media_id), maxPos + 1);
  const item = db.prepare(`SELECT * FROM collection_items WHERE id=?`).get(info.lastInsertRowid);
  res.status(201).json({ data: item });
});

router.delete('/:id/items/:itemId', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM collection_items WHERE id=? AND collection_id=?`).run(req.params.itemId, req.params.id);
  res.json({ data: { success: true } });
});

export default router;
