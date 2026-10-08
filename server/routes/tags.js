import express from 'express';
import db from '../db.js';
import { requireAdmin } from '../services/auth.js';
const router = express.Router();

router.get('/', (req, res) => {
  const tags = db.prepare(`SELECT * FROM tags ORDER BY usage_count DESC, name`).all();
  res.json({ data: tags });
});

router.post('/', requireAdmin, (req, res) => {
  const { name, color = '#3B82F6', icon = null } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: { code: 'MISSING_NAME', message: 'name required' } });
  try {
    const info = db.prepare(`INSERT INTO tags (name, color, icon) VALUES (?, ?, ?)`).run(name.trim(), color, icon);
    const tag = db.prepare(`SELECT * FROM tags WHERE id=?`).get(info.lastInsertRowid);
    res.status(201).json({ data: tag });
  } catch (e) {
    if (e.message.includes('UNIQUE')) return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Tag already exists' } });
    throw e;
  }
});

router.put('/:id', requireAdmin, (req, res) => {
  const { name, color, icon } = req.body;
  const tag = db.prepare(`SELECT * FROM tags WHERE id=?`).get(req.params.id);
  if (!tag) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tag not found' } });
  db.prepare(`UPDATE tags SET name=COALESCE(?, name), color=COALESCE(?, color), icon=COALESCE(?, icon) WHERE id=?`).run(name, color, icon, req.params.id);
  const updated = db.prepare(`SELECT * FROM tags WHERE id=?`).get(req.params.id);
  res.json({ data: updated });
});

router.delete('/:id', requireAdmin, (req, res) => {
  db.prepare(`DELETE FROM tags WHERE id=?`).run(req.params.id);
  db.prepare(`DELETE FROM media_tags WHERE tag_id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

router.post('/:id/assign', requireAdmin, (req, res) => {
  const { media_type, media_id } = req.body;
  if (!media_type || !media_id) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'media_type and media_id required' } });
  const tag = db.prepare(`SELECT * FROM tags WHERE id=?`).get(req.params.id);
  if (!tag) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Tag not found' } });
  try {
    db.prepare(`INSERT INTO media_tags (tag_id, media_type, media_id) VALUES (?, ?, ?)`).run(tag.id, media_type, Number(media_id));
    db.prepare(`UPDATE tags SET usage_count = usage_count + 1 WHERE id=?`).run(tag.id);
  } catch (e) {
    if (!e.message.includes('UNIQUE')) throw e;
  }
  res.json({ data: { success: true } });
});

router.post('/:id/unassign', requireAdmin, (req, res) => {
  const { media_type, media_id } = req.body;
  if (!media_type || !media_id) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'media_type and media_id required' } });
  const del = db.prepare(`DELETE FROM media_tags WHERE tag_id=? AND media_type=? AND media_id=?`).run(req.params.id, media_type, Number(media_id));
  if (del.changes > 0) db.prepare(`UPDATE tags SET usage_count = MAX(0, usage_count -1) WHERE id=?`).run(req.params.id);
  res.json({ data: { success: true } });
});

// Get tags for a media
router.get('/media/:type/:id', (req, res) => {
  const tags = db.prepare(`
    SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id
    WHERE media_tags.media_type=? AND media_tags.media_id=?
  `).all(req.params.type, Number(req.params.id));
  res.json({ data: tags });
});

export default router;
