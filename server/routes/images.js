import express from 'express';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { fileURLToPath } from 'url';
import db, { getDataDir } from '../db.js';
import { requireAdmin } from '../services/auth.js';
import { processAndCacheImage, getPrimaryImage, deleteImage } from '../services/image-cache.js';
import { invalidateMediaImageCache } from './metadata.js';

const router = express.Router();
const upload = multer({ dest: path.join(getDataDir(), 'tmp_uploads') });

// Ensure tmp dir

const tmpDir = path.join(getDataDir(), 'tmp_uploads');
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });

// Get images for a media
router.get('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  const allowed = ['movie','series','season','album','artist'];
  if (!allowed.includes(type)) return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Invalid media type' } });
  const images = db.prepare(`SELECT * FROM images WHERE media_type=? AND media_id=? ORDER BY image_type, is_primary DESC`).all(type, id);
  res.json({ data: images.map(img => ({
    ...img,
    url: `/api/image/${img.id}/full`,
    thumb: `/api/image/${img.id}/thumb`,
    is_primary: !!img.is_primary
  })) });
});

router.get('/:type/:id/:imageType', (req, res) => {
  const { type, id, imageType } = req.params;
  const images = db.prepare(`SELECT * FROM images WHERE media_type=? AND media_id=? AND image_type=? ORDER BY is_primary DESC`).all(type, id, imageType);
  res.json({ data: images.map(img => ({
    ...img,
    url: `/api/image/${img.id}/full`,
    thumb: `/api/image/${img.id}/thumb`,
    is_primary: !!img.is_primary
  })) });
});

router.post('/:type/:id/:imageType/set-primary', requireAdmin, (req, res) => {
  const { type, id, imageType } = req.params;
  const { imageId } = req.body;
  if (!imageId) return res.status(400).json({ error: { code: 'MISSING_IMAGE_ID', message: 'imageId required' } });
  const img = db.prepare(`SELECT * FROM images WHERE id=? AND media_type=? AND media_id=? AND image_type=?`).get(imageId, type, id, imageType);
  if (!img) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });
  db.prepare(`UPDATE images SET is_primary=0 WHERE media_type=? AND media_id=? AND image_type=?`).run(type, id, imageType);
  db.prepare(`UPDATE images SET is_primary=1 WHERE id=?`).run(imageId);
  invalidateMediaImageCache(type, id);
  res.json({ data: { success: true } });
});

router.post('/:type/:id/:imageType/upload', requireAdmin, upload.single('image'), async (req, res) => {
  const { type, id, imageType } = req.params;
  if (!req.file) return res.status(400).json({ error: { code: 'NO_FILE', message: 'No file uploaded' } });
  try {
    const result = await processAndCacheImage(req.file.path, type, Number(id), imageType, 'manual');
    // cleanup tmp
    try { fs.unlinkSync(req.file.path); } catch {}
    if (!result) return res.status(500).json({ error: { code: 'PROCESS_FAILED', message: 'Failed to process image' } });
    const rec = db.prepare(`SELECT * FROM images WHERE id=?`).get(result.id);
    invalidateMediaImageCache(type, id);
    res.json({ data: { ...rec, url: `/api/image/${rec.id}/full`, thumb: `/api/image/${rec.id}/thumb` } });
  } catch (e) {
    try { fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: { code: 'UPLOAD_FAILED', message: e.message } });
  }
});

router.post('/:type/:id/:imageType/scan', requireAdmin, async (req, res) => {
  // Trigger rescan for that media's folder
  res.json({ data: { message: 'Scan triggered - use global scan endpoint' } });
});

router.delete('/:id', requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!img) {
    return res.json({ data: { success: true, message: 'Image already deleted' } });
  }

  const wasPrimary = Number(img.is_primary) === 1;
  const { media_type, media_id, image_type, hash, local_path } = img;

  deleteImage(Number(req.params.id));

  // Prune any lingering duplicates for the same image/hash
  if (hash) {
    db.prepare('DELETE FROM images WHERE media_type = ? AND media_id = ? AND hash = ?').run(media_type, media_id, hash);
  }
  if (local_path) {
    db.prepare('DELETE FROM images WHERE media_type = ? AND media_id = ? AND LOWER(local_path) = LOWER(?)').run(media_type, media_id, local_path);
  }

  if (wasPrimary) {
    const nextImg = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = ? AND media_id = ? AND image_type = ?
      ORDER BY id DESC LIMIT 1
    `).get(media_type, media_id, image_type);
    if (nextImg) {
      db.prepare('UPDATE images SET is_primary = 1 WHERE id = ?').run(nextImg.id);
    }
  }

  invalidateMediaImageCache(media_type, media_id);
  res.json({ data: { success: true } });
});
export default router;
