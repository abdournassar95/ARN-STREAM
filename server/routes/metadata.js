import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import db, { getSetting, setSetting } from '../db.js';
import { saveMediaImageToFolder, saveMetadataToFolder } from '../services/media-file-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const uploadDir = path.join(appData, 'ARN_Stream', 'data', 'images_cache');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  dest: path.join(appData, 'ARN_Stream', 'data', 'tmp_uploads'),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB
});

import { requireAdmin, requireAuth } from '../services/auth.js';
import { invalidateCache } from '../middleware/response-cache.js';

// Require authentication for all metadata endpoints
router.use(requireAuth);

/**
 * Invalidate all related in-memory response caches when media images or metadata change.
 */
export function invalidateMediaImageCache(mediaType, mediaId) {
  try {
    invalidateCache('/api/library');
    invalidateCache('/api/libraries');
    invalidateCache('/api/images');
    if (mediaType === 'movie') {
      invalidateCache(`/api/movies/${mediaId}`);
      invalidateCache('/api/movies');
      invalidateCache('/api/libraries');
    } else if (mediaType === 'series' || mediaType === 'season' || mediaType === 'episode') {
      invalidateCache(`/api/series/${mediaId}`);
      invalidateCache('/api/series');
      invalidateCache('/api/libraries');
    } else if (mediaType === 'artist' || mediaType === 'album' || mediaType === 'track') {
      invalidateCache(`/api/artists/${mediaId}`);
      invalidateCache(`/api/albums/${mediaId}`);
      invalidateCache('/api/artists');
      invalidateCache('/api/albums');
      invalidateCache('/api/tracks');
      invalidateCache('/api/libraries');
      invalidateCache('/api/library/music-home');
      invalidateCache('/api/library/landing');
    }
  } catch (e) {
    console.warn('[Cache Invalidate Error]:', e.message);
  }
}


/**
 * Validates external image URLs to protect against SSRF attacks.
 * Blocks non-http(s) protocols, loopback addresses, and private IP spaces.
 */
function isSafeExternalImageUrl(urlStr) {
  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return false;
    }
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1') {
      return false;
    }
    // Block private/local IP spaces (10.x.x.x, 192.168.x.x, 172.16-31.x.x, 169.254.x.x)
    if (/^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(host)) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

// Helper to deduplicate images
function deduplicateImageList(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const img of list) {
    const key = img.hash || (img.local_path ? path.normalize(img.local_path).toLowerCase() : null) || (img.cached_path ? path.basename(img.cached_path).toLowerCase() : null) || `id:${img.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(img);
    }
  }
  return result;
}

// GET all images for a media item
router.get('/:type/:id/images', (req, res) => {
  const { type, id } = req.params;
  const rawImages = db.prepare(`
    SELECT * FROM images 
    WHERE media_type = ? AND media_id = ?
    ORDER BY is_primary DESC, id DESC
  `).all(type, id);

  const images = deduplicateImageList(rawImages);

  res.json({
    data: images.map(img => ({
      id: img.id,
      image_type: img.image_type,
      is_primary: !!img.is_primary,
      source: img.source,
      thumb: `/api/image/${img.id}/thumb`,
      full: `/api/image/${img.id}/full`,
      width: img.width,
      height: img.height
    }))
  });
});

// Set primary image
router.post('/images/:id/set-primary', requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!img) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });

  const isPosterFamily = img.image_type === 'poster' || img.image_type === 'season_poster';
  const isBackdropFamily = img.image_type === 'backdrop' || img.image_type === 'fanart';

  if (isPosterFamily) {
    db.prepare(`
      UPDATE images 
      SET is_primary = 0 
      WHERE media_type = ? AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')
    `).run(img.media_type, img.media_id);
  } else if (isBackdropFamily) {
    db.prepare(`
      UPDATE images 
      SET is_primary = 0 
      WHERE media_type = ? AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
    `).run(img.media_type, img.media_id);
  } else {
    db.prepare(`
      UPDATE images 
      SET is_primary = 0 
      WHERE media_type = ? AND media_id = ? AND image_type = ?
    `).run(img.media_type, img.media_id, img.image_type);
  }

  db.prepare('UPDATE images SET is_primary = 1 WHERE id = ?').run(img.id);

  // Sync Season 1 and Series if applicable
  if (img.media_type === 'season') {
    const season = db.prepare('SELECT series_id, season_number FROM seasons WHERE id = ?').get(img.media_id);
    if (season && season.season_number === 1) {
      if (isPosterFamily) {
        db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'series' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).run(season.series_id);
      } else if (isBackdropFamily) {
        db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'series' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).run(season.series_id);
      }
    }
  }

  // Invalidate in-memory caches immediately
  invalidateMediaImageCache(img.media_type, img.media_id);

  res.json({ data: { success: true } });
});

// Delete specific media image
router.delete('/images/:id', requireAdmin, (req, res) => {
  const img = db.prepare('SELECT * FROM images WHERE id = ?').get(req.params.id);
  if (!img) {
    return res.json({ data: { success: true, message: 'Image already deleted' } });
  }

  // 1. Delete physical cached and thumbnail files
  if (img.cached_path && fs.existsSync(img.cached_path)) {
    try { fs.unlinkSync(img.cached_path); } catch {}
  }
  if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) {
    try { fs.unlinkSync(img.thumbnail_path); } catch {}
  }
  // Safe deletion of local_path: only if it's strictly an image file!
  if (img.local_path && fs.existsSync(img.local_path)) {
    const isImageFile = /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path);
    if (isImageFile) {
      try { fs.unlinkSync(img.local_path); } catch {}
    }
  }

  const wasPrimary = Number(img.is_primary) === 1;
  const { media_type, media_id, image_type } = img;

  // 2. Remove record and any duplicate rows for the same file/hash from database
  if (img.hash) {
    db.prepare('DELETE FROM images WHERE media_type = ? AND media_id = ? AND hash = ?').run(media_type, media_id, img.hash);
  }
  if (img.local_path) {
    db.prepare('DELETE FROM images WHERE media_type = ? AND media_id = ? AND LOWER(local_path) = LOWER(?)').run(media_type, media_id, img.local_path);
  }
  db.prepare('DELETE FROM images WHERE id = ?').run(img.id);

  // 3. If deleted image was primary, automatically promote the next available image to primary
  if (wasPrimary) {
    const isPosterFamily = image_type === 'poster' || image_type === 'season_poster';
    const isBackdropFamily = image_type === 'backdrop' || image_type === 'fanart';

    let nextImg = null;
    if (isPosterFamily) {
      nextImg = db.prepare(`
        SELECT id FROM images 
        WHERE media_type = ? AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')
        ORDER BY id DESC LIMIT 1
      `).get(media_type, media_id);
    } else if (isBackdropFamily) {
      nextImg = db.prepare(`
        SELECT id FROM images 
        WHERE media_type = ? AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
        ORDER BY id DESC LIMIT 1
      `).get(media_type, media_id);
    } else {
      nextImg = db.prepare(`
        SELECT id FROM images 
        WHERE media_type = ? AND media_id = ? AND image_type = ?
        ORDER BY id DESC LIMIT 1
      `).get(media_type, media_id, image_type);
    }

    if (nextImg) {
      db.prepare('UPDATE images SET is_primary = 1 WHERE id = ?').run(nextImg.id);
    }
  }

  // 4. Invalidate all relevant in-memory caches so GET endpoints immediately reflect deletion
  invalidateMediaImageCache(media_type, media_id);

  res.json({ data: { success: true, message: 'Image deleted successfully' } });
});

// Delete / remove backdrop for a media item (e.g. artist, series, season, movie)
router.delete('/:type/:id/backdrop', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const backdrops = db.prepare(`
    SELECT * FROM images 
    WHERE media_type = ? AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
  `).all(type, id);

  for (const img of backdrops) {
    if (img.cached_path && fs.existsSync(img.cached_path)) {
      try { fs.unlinkSync(img.cached_path); } catch {}
    }
    if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) {
      try { fs.unlinkSync(img.thumbnail_path); } catch {}
    }
    if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) {
      try { fs.unlinkSync(img.local_path); } catch {}
    }
  }

  db.prepare(`
    DELETE FROM images 
    WHERE media_type = ? AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
  `).run(type, id);

  // Sync delete with Season 1 if Series
  if (type === 'series') {
    const s1 = db.prepare('SELECT id FROM seasons WHERE series_id = ? AND season_number = 1').get(id);
    if (s1) {
      const s1Imgs = db.prepare(`SELECT * FROM images WHERE media_type = 'season' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).all(s1.id);
      for (const img of s1Imgs) {
        if (img.cached_path && fs.existsSync(img.cached_path)) { try { fs.unlinkSync(img.cached_path); } catch {} }
        if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) { try { fs.unlinkSync(img.thumbnail_path); } catch {} }
        if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) { try { fs.unlinkSync(img.local_path); } catch {} }
      }
      db.prepare(`DELETE FROM images WHERE media_type = 'season' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).run(s1.id);
    }
  } else if (type === 'season') {
    const currentSeason = db.prepare('SELECT series_id, season_number FROM seasons WHERE id = ?').get(id);
    if (currentSeason && currentSeason.season_number === 1) {
      const seriesImgs = db.prepare(`SELECT * FROM images WHERE media_type = 'series' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).all(currentSeason.series_id);
      for (const img of seriesImgs) {
        if (img.cached_path && fs.existsSync(img.cached_path)) { try { fs.unlinkSync(img.cached_path); } catch {} }
        if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) { try { fs.unlinkSync(img.thumbnail_path); } catch {} }
        if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) { try { fs.unlinkSync(img.local_path); } catch {} }
      }
      db.prepare(`DELETE FROM images WHERE media_type = 'series' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).run(currentSeason.series_id);
    }
  }

  // Invalidate in-memory caches
  invalidateMediaImageCache(type, id);

  res.json({ data: { success: true, message: 'Backdrop removed successfully' } });
});

// Delete / remove poster for a media item
router.delete('/:type/:id/poster', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const posters = db.prepare(`
    SELECT * FROM images 
    WHERE media_type = ? AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')
  `).all(type, id);

  for (const img of posters) {
    if (img.cached_path && fs.existsSync(img.cached_path)) {
      try { fs.unlinkSync(img.cached_path); } catch {}
    }
    if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) {
      try { fs.unlinkSync(img.thumbnail_path); } catch {}
    }
    if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) {
      try { fs.unlinkSync(img.local_path); } catch {}
    }
  }

  db.prepare(`
    DELETE FROM images 
    WHERE media_type = ? AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')
  `).run(type, id);

  // Sync delete with Season 1 if Series
  if (type === 'series') {
    const s1 = db.prepare('SELECT id FROM seasons WHERE series_id = ? AND season_number = 1').get(id);
    if (s1) {
      const s1Imgs = db.prepare(`SELECT * FROM images WHERE media_type = 'season' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).all(s1.id);
      for (const img of s1Imgs) {
        if (img.cached_path && fs.existsSync(img.cached_path)) { try { fs.unlinkSync(img.cached_path); } catch {} }
        if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) { try { fs.unlinkSync(img.thumbnail_path); } catch {} }
        if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) { try { fs.unlinkSync(img.local_path); } catch {} }
      }
      db.prepare(`DELETE FROM images WHERE media_type = 'season' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).run(s1.id);
    }
  } else if (type === 'season') {
    const currentSeason = db.prepare('SELECT series_id, season_number FROM seasons WHERE id = ?').get(id);
    if (currentSeason && currentSeason.season_number === 1) {
      const seriesImgs = db.prepare(`SELECT * FROM images WHERE media_type = 'series' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).all(currentSeason.series_id);
      for (const img of seriesImgs) {
        if (img.cached_path && fs.existsSync(img.cached_path)) { try { fs.unlinkSync(img.cached_path); } catch {} }
        if (img.thumbnail_path && fs.existsSync(img.thumbnail_path)) { try { fs.unlinkSync(img.thumbnail_path); } catch {} }
        if (img.local_path && fs.existsSync(img.local_path) && /\.(jpe?g|png|webp|gif|bmp|tbn)$/i.test(img.local_path)) { try { fs.unlinkSync(img.local_path); } catch {} }
      }
      db.prepare(`DELETE FROM images WHERE media_type = 'series' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).run(currentSeason.series_id);
    }
  }

  // Invalidate in-memory caches
  invalidateMediaImageCache(type, id);

  res.json({ data: { success: true, message: 'Poster removed successfully' } });
});

function assignTagsToMedia(genres, mediaType, mediaId) {
  if (!genres || !genres.length) return;
  const insertTag = db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)');
  const getTag = db.prepare('SELECT id FROM tags WHERE name = ?');
  const insertMediaTag = db.prepare('INSERT OR IGNORE INTO media_tags (tag_id, media_type, media_id) VALUES (?, ?, ?)');
  const incrementUsage = db.prepare('UPDATE tags SET usage_count = usage_count + 1 WHERE id = ?');
  
  for (const g of genres) {
    if (!g) continue;
    let name = String(g).trim();
    if (!name) continue;
    name = name.charAt(0).toUpperCase() + name.slice(1);
    insertTag.run(name);
    const tag = getTag.get(name);
    if (tag) {
      const res = insertMediaTag.run(tag.id, mediaType, mediaId);
      if (res.changes > 0) incrementUsage.run(tag.id);
    }
  }
}

// Update metadata (Title, Year, Plot, Rating, Genres, tmdb_id)
router.put('/:type/:id', requireAdmin, (req, res) => {
  const { type, id } = req.params;
  const { title, name, year, plot, bio, country, genre, rating, season_number, genres, tmdb_id } = req.body || {};

  if (!['movie', 'series', 'season', 'artist'].includes(type)) {
    return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Type must be movie, series, season, or artist' } });
  }

  if (type === 'artist') {
    const artist = db.prepare('SELECT * FROM artists WHERE id = ?').get(id);
    if (!artist) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artist not found' } });

    const newName = (name || title) !== undefined && String(name || title).trim() ? String(name || title).trim() : artist.name;
    const newBio = (bio !== undefined ? bio : plot) !== undefined ? String(bio || plot).trim() : (artist.bio || null);
    const newCountry = country !== undefined ? String(country).trim() : (artist.country || null);
    const newGenre = genre !== undefined ? String(genre).trim() : (artist.genre || null);

    if (newName !== artist.name) {
      const existingOther = db.prepare('SELECT * FROM artists WHERE name = ? AND id != ?').get(newName, id);
      if (existingOther) {
        // Merge this artist into existingOther
        const oldAlbums = db.prepare('SELECT * FROM albums WHERE artist_id = ?').all(id);
        for (const alb of oldAlbums) {
          const targetAlb = db.prepare('SELECT id FROM albums WHERE artist_id = ? AND title = ?').get(existingOther.id, alb.title);
          if (targetAlb) {
            db.prepare('UPDATE tracks SET album_id = ? WHERE album_id = ?').run(targetAlb.id, alb.id);
            db.prepare('DELETE FROM images WHERE media_type = "album" AND media_id = ?').run(alb.id);
            db.prepare('DELETE FROM albums WHERE id = ?').run(alb.id);
          } else {
            db.prepare('UPDATE albums SET artist_id = ? WHERE id = ?').run(existingOther.id, alb.id);
          }
        }

        db.prepare(`
          UPDATE artists SET 
            bio = COALESCE(?, bio),
            country = COALESCE(?, country),
            genre = COALESCE(?, genre)
          WHERE id = ?
        `).run(newBio || artist.bio, newCountry || artist.country, newGenre || artist.genre, existingOther.id);

        const hasExistingPoster = db.prepare(`SELECT 1 FROM images WHERE media_type = 'artist' AND media_id = ?`).get(existingOther.id);
        if (!hasExistingPoster) {
          db.prepare(`UPDATE images SET media_id = ? WHERE media_type = 'artist' AND media_id = ?`).run(existingOther.id, id);
        } else {
          db.prepare(`DELETE FROM images WHERE media_type = 'artist' AND media_id = ?`).run(id);
        }

        db.prepare('DELETE FROM artists WHERE id = ?').run(id);

        return res.json({ data: { success: true, message: 'Artist merged successfully', mergedId: existingOther.id } });
      }
    }

    db.prepare('UPDATE artists SET name = ?, bio = ?, country = ?, genre = ? WHERE id = ?')
      .run(newName, newBio, newCountry, newGenre, id);

    return res.json({ data: { success: true, message: 'Artist updated successfully' } });
  }

  if (type === 'season') {
    const item = db.prepare('SELECT * FROM seasons WHERE id = ?').get(id);
    if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found' } });

    const newTitle = title !== undefined ? title.trim() : item.title;
    const newPlot = plot !== undefined ? plot : item.plot;
    const newYear = year !== undefined ? (Number(year) || null) : item.year;
    const newSeasonNum = season_number !== undefined ? (Number(season_number) || item.season_number) : item.season_number;

    db.prepare('UPDATE seasons SET title = ?, plot = ?, year = ?, season_number = ? WHERE id = ?').run(newTitle, newPlot, newYear, newSeasonNum, id);
    saveMetadataToFolder('season', id);

    // If Season 1, also update series metadata to keep them in sync
    if (newSeasonNum === 1 && item.series_id) {
      const ser = db.prepare('SELECT * FROM series WHERE id = ?').get(item.series_id);
      if (ser) {
        const serPlot = (!ser.plot || ser.plot.trim() === '') ? newPlot : ser.plot;
        const serYear = !ser.year ? newYear : ser.year;
        db.prepare('UPDATE series SET plot = ?, year = ? WHERE id = ?').run(serPlot, serYear, ser.id);
        saveMetadataToFolder('series', ser.id);
      }
    }

    return res.json({ data: { success: true, message: 'Season updated successfully' } });
  }

  const table = type === 'movie' ? 'movies' : 'series';
  const item = db.prepare(`SELECT * FROM ${table} WHERE id = ?`).get(id);
  if (!item) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Item not found' } });

  const newTitle = title !== undefined ? title.trim() : item.title;
  const newPlot = plot !== undefined ? plot : item.plot;
  const newYear = year !== undefined ? (Number(year) || null) : item.year;
  const newTmdbId = tmdb_id !== undefined ? (Number(tmdb_id) || null) : item.tmdb_id;

  if (type === 'movie') {
    db.prepare('UPDATE movies SET title = ?, year = ?, plot = ?, tmdb_id = COALESCE(?, tmdb_id) WHERE id = ?').run(newTitle, newYear, newPlot, newTmdbId, id);
    saveMetadataToFolder('movie', id);
  } else {
    db.prepare('UPDATE series SET title = ?, year = ?, plot = ?, tmdb_id = COALESCE(?, tmdb_id) WHERE id = ?').run(newTitle, newYear, newPlot, newTmdbId, id);
    saveMetadataToFolder('series', id);

    // Also sync Season 1 metadata (year, plot) if Season 1 exists
    const s1 = db.prepare('SELECT id, year, plot FROM seasons WHERE series_id = ? AND season_number = 1').get(id);
    if (s1) {
      const s1Year = newYear || s1.year;
      const s1Plot = newPlot || s1.plot;
      db.prepare('UPDATE seasons SET year = ?, plot = ? WHERE id = ?').run(s1Year, s1Plot, s1.id);
      saveMetadataToFolder('season', s1.id);
    }
  }

  // Handle genres / tags assignment
  if (genres !== undefined) {
    const list = Array.isArray(genres)
      ? genres.map(g => (typeof g === 'object' && g.name) ? g.name : String(g)).filter(Boolean)
      : (typeof genres === 'string' ? genres.split(',').map(s => s.trim()).filter(Boolean) : []);
    
    db.prepare('DELETE FROM media_tags WHERE media_type = ? AND media_id = ?').run(type, Number(id));
    if (list.length > 0) {
      assignTagsToMedia(list, type, Number(id));
    }
  }

  // Update rating
  if (rating !== undefined && rating !== null && rating !== '') {
    const rVal = Number(rating);
    if (!isNaN(rVal) && rVal >= 0 && rVal <= 10) {
      const userId = req.user?.id || 1;
      db.prepare(`
        INSERT INTO ratings (user_id, media_type, media_id, rating, rated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id, media_type, media_id) DO UPDATE SET rating = excluded.rating, rated_at = CURRENT_TIMESTAMP
      `).run(userId, type, Number(id), rVal);
    }
  }

  invalidateMediaImageCache(type, id);

  res.json({ data: { success: true, message: 'Metadata updated successfully' } });
});

// Upload poster or set by URL
router.post('/:type/:id/poster', requireAdmin, upload.single('file'), async (req, res) => {
  const { type, id } = req.params;
  const { imageUrl, imageType = 'poster' } = req.body || {};

  if (!['movie', 'series', 'season', 'artist'].includes(type)) {
    return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Type must be movie, series, season, or artist' } });
  }

  let finalImageType = imageType;
  if (type === 'season' && (imageType === 'poster' || !imageType)) {
    finalImageType = 'season_poster';
  } else if (type === 'artist') {
    if (imageType === 'avatar' || !imageType) finalImageType = 'poster';
    else if (imageType === 'fanart') finalImageType = 'backdrop';
  }

  try {
    let buffer = null;

    if (req.file) {
      buffer = fs.readFileSync(req.file.path);
      try { fs.unlinkSync(req.file.path); } catch {}
    } else if (imageUrl) {
      if (!isSafeExternalImageUrl(imageUrl)) {
        return res.status(400).json({ error: { code: 'INVALID_URL', message: 'Invalid or forbidden image URL' } });
      }
      const resp = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      if (!resp.ok) throw new Error('Failed to download image from URL');
      const ct = resp.headers.get('content-type') || '';
      if (!ct.startsWith('image/')) {
        throw new Error('Remote URL did not return a valid image');
      }
      const ab = await resp.arrayBuffer();
      buffer = Buffer.from(ab);
    } else {
      return res.status(400).json({ error: { code: 'MISSING_IMAGE', message: 'Provide a file upload or imageUrl' } });
    }

    const baseName = `${type}-${id}-${finalImageType}-${Date.now()}`;
    const cachedPath = path.join(uploadDir, `${baseName}.webp`);
    const thumbPath = path.join(uploadDir, `${baseName}-thumb.webp`);

    // Image dimensions: 1:1 square for albums/artists, 2:3 for posters, 16:9 for backdrops
    const isLandscape = finalImageType === 'backdrop' || finalImageType === 'fanart';
    const isSquare = type === 'artist'; // artists are 1:1 square
    const isPosterType = finalImageType === 'poster' || finalImageType === 'season_poster';

    // Full image dimensions
    let fullWidth, fullHeight;
    if (isLandscape) {
      fullWidth = 1280;
      fullHeight = Math.round(fullWidth * 0.5625); // 16:9
    } else if (isSquare) {
      fullWidth = 500;
      fullHeight = 500; // ★ 1:1 square
    } else if (isPosterType) {
      fullWidth = 500;
      fullHeight = Math.round(fullWidth * 1.5); // 2:3
    } else {
      fullWidth = 500;
      fullHeight = 750; // fallback portrait
    }

    const meta = await sharp(buffer)
      .resize({
        width: fullWidth,
        height: fullHeight,
        fit: 'cover',
        position: 'attention'
      })
      .webp({ quality: 85, effort: 4 })
      .toFile(cachedPath);

    // Thumbnail
    let thumbWidth, thumbHeight;
    if (isLandscape) {
      thumbWidth = 400;
      thumbHeight = Math.round(thumbWidth * 0.5625);
    } else if (isSquare) {
      thumbWidth = 300;
      thumbHeight = 300; // ★ 1:1 square
    } else if (isPosterType) {
      thumbWidth = 300;
      thumbHeight = Math.round(thumbWidth * 1.5);
    } else {
      thumbWidth = 250;
      thumbHeight = 375;
    }

    await sharp(buffer)
      .resize({
        width: thumbWidth,
        height: thumbHeight,
        fit: 'cover',
        position: 'attention'
      })
      .webp({ quality: 80 })
      .toFile(thumbPath);

    const hiddenPath = await saveMediaImageToFolder(type, id, finalImageType, buffer);

    const isPosterFamily = finalImageType === 'poster' || finalImageType === 'season_poster';
    const isBackdropFamily = finalImageType === 'backdrop' || finalImageType === 'fanart';

    // Unset current primary for all matching image types for this media
    if (isPosterFamily) {
      db.prepare(`
        UPDATE images SET is_primary = 0 
        WHERE media_type = ? AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')
      `).run(type, id);
    } else if (isBackdropFamily) {
      db.prepare(`
        UPDATE images SET is_primary = 0 
        WHERE media_type = ? AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')
      `).run(type, id);
    } else {
      db.prepare(`
        UPDATE images SET is_primary = 0 
        WHERE media_type = ? AND media_id = ? AND image_type = ?
      `).run(type, id, finalImageType);
    }

    const imgHash = crypto.createHash('md5').update(buffer).digest('hex');

    // Deduplicate: check if an image with matching hash or local_path already exists for this media
    const existingImg = db.prepare(`
      SELECT id FROM images 
      WHERE media_type = ? AND media_id = ? AND image_type = ?
        AND (
          (? IS NOT NULL AND hash = ?) 
          OR (? IS NOT NULL AND local_path IS NOT NULL AND LOWER(local_path) = LOWER(?))
        )
      ORDER BY id DESC LIMIT 1
    `).get(type, id, finalImageType, imgHash, imgHash, hiddenPath, hiddenPath);

    let savedImgId;
    if (existingImg) {
      db.prepare(`
        UPDATE images 
        SET cached_path = ?, thumbnail_path = ?, local_path = COALESCE(?, local_path),
            is_primary = 1, width = ?, height = ?, file_size = ?, hash = ?
        WHERE id = ?
      `).run(cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash, existingImg.id);
      savedImgId = existingImg.id;
    } else {
      const ins = db.prepare(`
        INSERT INTO images (media_type, media_id, image_type, source, cached_path, thumbnail_path, local_path, is_primary, width, height, file_size, hash)
        VALUES (?, ?, ?, 'manual_upload', ?, ?, ?, 1, ?, ?, ?, ?)
      `).run(type, id, finalImageType, cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash);
      savedImgId = ins.lastInsertRowid;
    }

    // Synchronize images table between Season 1 and Series so UI never goes out of sync
    if (type === 'season') {
      const seasonRow = db.prepare('SELECT series_id, season_number FROM seasons WHERE id = ?').get(id);
      if (seasonRow && seasonRow.season_number === 1) {
        const seriesImageType = isPosterFamily ? 'poster' : 'backdrop';
        if (isPosterFamily) {
          db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'series' AND media_id = ? AND (image_type = 'poster' OR image_type = 'season_poster')`).run(seasonRow.series_id);
        } else {
          db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'series' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).run(seasonRow.series_id);
        }

        const existingSeriesImg = db.prepare(`
          SELECT id FROM images 
          WHERE media_type = 'series' AND media_id = ? AND image_type = ?
            AND (
              (? IS NOT NULL AND hash = ?) 
              OR (? IS NOT NULL AND local_path IS NOT NULL AND LOWER(local_path) = LOWER(?))
            )
          ORDER BY id DESC LIMIT 1
        `).get(seasonRow.series_id, seriesImageType, imgHash, imgHash, hiddenPath, hiddenPath);

        if (existingSeriesImg) {
          db.prepare(`
            UPDATE images 
            SET cached_path = ?, thumbnail_path = ?, local_path = COALESCE(?, local_path),
                is_primary = 1, width = ?, height = ?, file_size = ?, hash = ?
            WHERE id = ?
          `).run(cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash, existingSeriesImg.id);
        } else {
          db.prepare(`
            INSERT INTO images (media_type, media_id, image_type, source, cached_path, thumbnail_path, local_path, is_primary, width, height, file_size, hash)
            VALUES ('series', ?, ?, 'manual_upload', ?, ?, ?, 1, ?, ?, ?, ?)
          `).run(seasonRow.series_id, seriesImageType, cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash);
        }
        invalidateMediaImageCache('series', seasonRow.series_id);
      }
    } else if (type === 'series') {
      const season1 = db.prepare('SELECT id FROM seasons WHERE series_id = ? AND season_number = 1').get(id);
      if (season1) {
        const seasonImageType = isPosterFamily ? 'season_poster' : 'backdrop';
        if (isPosterFamily) {
          db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'season' AND media_id = ? AND (image_type = 'season_poster' OR image_type = 'poster')`).run(season1.id);
        } else {
          db.prepare(`UPDATE images SET is_primary = 0 WHERE media_type = 'season' AND media_id = ? AND (image_type = 'backdrop' OR image_type = 'fanart')`).run(season1.id);
        }

        const existingSeasonImg = db.prepare(`
          SELECT id FROM images 
          WHERE media_type = 'season' AND media_id = ? AND image_type = ?
            AND (
              (? IS NOT NULL AND hash = ?) 
              OR (? IS NOT NULL AND local_path IS NOT NULL AND LOWER(local_path) = LOWER(?))
            )
          ORDER BY id DESC LIMIT 1
        `).get(season1.id, seasonImageType, imgHash, imgHash, hiddenPath, hiddenPath);

        if (existingSeasonImg) {
          db.prepare(`
            UPDATE images 
            SET cached_path = ?, thumbnail_path = ?, local_path = COALESCE(?, local_path),
                is_primary = 1, width = ?, height = ?, file_size = ?, hash = ?
            WHERE id = ?
          `).run(cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash, existingSeasonImg.id);
        } else {
          db.prepare(`
            INSERT INTO images (media_type, media_id, image_type, source, cached_path, thumbnail_path, local_path, is_primary, width, height, file_size, hash)
            VALUES ('season', ?, ?, 'manual_upload', ?, ?, ?, 1, ?, ?, ?, ?)
          `).run(season1.id, seasonImageType, cachedPath, thumbPath, hiddenPath, meta.width, meta.height, meta.size, imgHash);
        }
        invalidateMediaImageCache('season', season1.id);
      }
    }

    invalidateMediaImageCache(type, id);

    res.json({
      data: {
        id: savedImgId,
        thumb: `/api/image/${savedImgId}/thumb`,
        full: `/api/image/${savedImgId}/full`
      },
      message: 'Poster updated successfully'
    });
  } catch (err) {
    console.error('Update poster error:', err);
    res.status(500).json({ error: { code: 'POSTER_UPDATE_FAILED', message: err.message } });
  }
});

// Get TMDB API Key
router.get('/tmdb-key', requireAdmin, (req, res) => {
  const key = getSetting('tmdb_api_key', '') || process.env.TMDB_API_KEY || '';
  res.json({ data: { key } });
});

// Set TMDB API Key
router.post('/tmdb-key', requireAdmin, (req, res) => {
  const { key } = req.body || {};
  setSetting('tmdb_api_key', key ? String(key).trim() : '');
  res.json({ success: true, message: 'TMDB API key updated successfully' });
});

// Scrape TMDB metadata directly without requiring an API key
async function fetchTmdbDirect(targetType, tmdbId) {
  try {
    const url = `https://www.themoviedb.org/${targetType}/${tmdbId}?language=ar`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,ar-EG;q=0.9,en;q=0.8'
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return null;
    const html = await res.text();

    const ogMap = {};
    for (const m of html.matchAll(/<meta\s+property=["']([^"']+)["']\s+content=["']([^"']+)["']/gi)) {
      ogMap[m[1]] = m[2];
    }

    if (!ogMap['og:title']) return null;

    // Year
    const yearMatch = html.match(/<span class="tag release_date">\s*\((\d{4})\)/i) 
      || html.match(/\((\d{4})\)/)
      || html.match(/first_air_date["']:["'](\d{4})/i)
      || html.match(/"datePublished":\s*"(\d{4})/i);

    // Rating
    const ratingMatch = html.match(/data-percent=["']([\d\.]+)["']/i);
    const rating = ratingMatch ? Math.round(Number(ratingMatch[1])) / 10 : null;

    // Poster
    const posterMatch = html.match(/class="poster lazyload"\s+data-src=["']([^"']+)["']/i)
      || html.match(/class="poster[^"]*"\s+src=["']([^"']+)["']/i);
    
    let poster = ogMap['og:image'] || null;
    if (posterMatch && posterMatch[1]) {
      poster = posterMatch[1].startsWith('http') ? posterMatch[1] : `https://image.tmdb.org/t/p/w500${posterMatch[1]}`;
    }

    // Backdrop
    let backdrop = null;
    const bgMatch = html.match(/image\.tmdb\.org\/t\/p\/w1920_and_h800_multi_faces\/([a-zA-Z0-9_\-\.]+\.(?:jpg|png|webp))/i)
      || html.match(/image\.tmdb\.org\/t\/p\/original\/([a-zA-Z0-9_\-\.]+\.(?:jpg|png|webp))/i)
      || html.match(/media\.themoviedb\.org\/t\/p\/[^\/]+\/([a-zA-Z0-9_\-\.]+\.(?:jpg|png|webp))/i);

    if (bgMatch) {
      backdrop = `https://image.tmdb.org/t/p/original/${bgMatch[1]}`;
    } else {
      const bgFallback = html.match(/background-image:\s*url\((['"]?)([^'"\)]+)\1\)/i);
      if (bgFallback && bgFallback[2]) {
        backdrop = bgFallback[2].startsWith('http') ? bgFallback[2] : `https://image.tmdb.org/t/p/w1280${bgFallback[2]}`;
      }
    }

    const titleClean = (ogMap['og:title'] || '').replace(/\s*\(\d{4}\)\s*$/, '').trim();

    // Genres
    let genres = [];
    const genresMatch = html.match(/class=["']genres["'][^>]*>([\s\S]*?)<\/span>/i);
    if (genresMatch) {
      genres = genresMatch[1].replace(/<[^>]+>/g, ',').split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      id: `tmdb-${tmdbId}`,
      title: titleClean,
      year: yearMatch ? Number(yearMatch[1]) : null,
      plot: ogMap['og:description'] || null,
      poster: poster,
      backdrop: backdrop,
      rating: rating,
      genres: genres,
      source: 'tmdb',
      isDirectMatch: true
    };
  } catch (err) {
    console.error('TMDB direct scraper error:', err.message);
    return null;
  }
}

// Scrape TMDB search results directly without requiring an API key
async function searchTmdbDirect(query, isSeries) {
  try {
    const tmdbType = isSeries ? 'tv' : 'movie';
    const url = `https://www.themoviedb.org/search/${tmdbType}?query=${encodeURIComponent(query)}&language=ar`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept-Language': 'ar,ar-EG;q=0.9,en;q=0.8'
      },
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const re = new RegExp(`\\/${tmdbType}\\/(\\d+)`, 'g');
    let m;
    const ids = [];
    while ((m = re.exec(html)) !== null) {
      if (!ids.includes(m[1])) {
        ids.push(m[1]);
        if (ids.length >= 4) break;
      }
    }
    const promises = ids.map(id => fetchTmdbDirect(tmdbType, id));
    const items = await Promise.all(promises);
    return items.filter(Boolean);
  } catch (err) {
    console.error('searchTmdbDirect error:', err.message);
    return [];
  }
}

// Search online metadata (IMDb + TMDB ONLY - NO Wikipedia, NO Actors/Cast)
router.get('/search', async (req, res) => {
  const query = req.query.q ? String(req.query.q).trim() : '';
  const type = req.query.type || 'movie';

  if (!query) {
    return res.json({ data: [] });
  }

  const results = [];
  const isSeries = (type === 'series' || type === 'season');
  const cMediaType = isSeries ? 'series' : 'movie';
  const tmdbType = isSeries ? 'tv' : 'movie';
  const tmdbKey = getSetting('tmdb_api_key') || process.env.TMDB_API_KEY || null;

  // 1. Check for explicit IMDb ID or IMDb URL (e.g. tt1234567, tt12345678, https://www.imdb.com/title/tt2290891/...)
  const imdbIdMatch = query.match(/\b(tt\d{6,10})\b/i);
  if (imdbIdMatch) {
    const imdbId = imdbIdMatch[1].toLowerCase();
    try {
      let cRes = await fetch(`https://cinemeta-live.strem.io/meta/${cMediaType}/${imdbId}.json`, { redirect: 'follow' });
      if (!cRes.ok) {
        cRes = await fetch(`https://v3-cinemeta.strem.io/meta/${cMediaType}/${imdbId}.json`, { redirect: 'follow' });
      }
      if (cRes.ok) {
        const cData = await cRes.json();
        if (cData.meta) {
          const m = cData.meta;
          const yearVal = m.year ? Number(String(m.year).split(/[\s–-]/)[0]) : (m.releaseInfo ? Number(String(m.releaseInfo).split(/[\s–-]/)[0]) : null);
          results.push({
            id: m.id,
            title: m.name,
            year: yearVal,
            plot: m.description || null,
            poster: m.poster || null,
            backdrop: m.background || null,
            rating: m.imdbRating ? Number(m.imdbRating) : null,
            genres: Array.isArray(m.genres) ? m.genres : [],
            source: 'imdb',
            isDirectMatch: true
          });
        }
      }
    } catch (e) {
      console.error('IMDb direct ID search error:', e.message);
    }
  }

  // 2. Check for explicit TMDB ID, URL, or URL Slug (e.g. 52698-al-kabeer, https://www.themoviedb.org/tv/52698-al-kabeer, tv/52698, 52698)
  const tmdbUrlMatch = query.match(/(?:themoviedb\.org\/)?(tv|movie)\/(\d+)(?:-[a-z0-9\-_]+)?/i);
  const tmdbSlugMatch = !imdbIdMatch && !tmdbUrlMatch && query.match(/^(?:tmdb[:\-])?(\d{2,10})(?:-[a-z0-9\-_]+)?$/i);
  
  if (tmdbUrlMatch || tmdbSlugMatch) {
    const targetType = tmdbUrlMatch ? (tmdbUrlMatch[1].toLowerCase() === 'tv' ? 'tv' : 'movie') : tmdbType;
    const tmdbId = tmdbUrlMatch ? tmdbUrlMatch[2] : tmdbSlugMatch[1];

    // Try direct TMDB web scraper first (Zero API key needed!)
    try {
      const directItem = await fetchTmdbDirect(targetType, tmdbId);
      if (directItem) {
        results.push(directItem);
      }
    } catch (e) {
      console.error('Direct TMDB fetch error:', e);
    }

    // Fallback to TMDB API if key configured and scraper didn't return
    if (results.length === 0 && tmdbKey) {
      try {
        const tRes = await fetch(`https://api.themoviedb.org/3/${targetType}/${tmdbId}?api_key=${tmdbKey}&language=ar&append_to_response=images`);
        if (tRes.ok) {
          const tData = await tRes.json();
          let overview = tData.overview;
          let titleName = tData.title || tData.name;
          if (!overview) {
            try {
              const enRes = await fetch(`https://api.themoviedb.org/3/${targetType}/${tmdbId}?api_key=${tmdbKey}&language=en-US`);
              if (enRes.ok) {
                const enData = await enRes.json();
                overview = enData.overview;
                if (!titleName) titleName = enData.title || enData.name;
              }
            } catch {}
          }

          results.push({
            id: `tmdb-${tData.id}`,
            title: titleName,
            year: (tData.release_date || tData.first_air_date || '').split('-')[0] ? Number((tData.release_date || tData.first_air_date || '').split('-')[0]) : null,
            plot: overview || null,
            poster: tData.poster_path ? `https://image.tmdb.org/t/p/w500${tData.poster_path}` : null,
            backdrop: tData.backdrop_path ? `https://image.tmdb.org/t/p/w1280${tData.backdrop_path}` : null,
            rating: tData.vote_average ? Math.round(tData.vote_average * 10) / 10 : null,
            genres: (tData.genres || []).map(g => g.name).filter(Boolean),
            source: 'tmdb',
            isDirectMatch: true
          });
        }
      } catch (e) {
        console.error('TMDB direct ID search error:', e.message);
      }
    }
  }

  const isDirectCodeMatch = Boolean(imdbIdMatch || tmdbUrlMatch || tmdbSlugMatch);

  // 3. Search TMDB (Official API if key configured, or Direct TMDB Web Scraper if no key)
  if (!isDirectCodeMatch) {
    if (tmdbKey) {
      try {
        const tmdbEndpoint = isSeries
          ? `https://api.themoviedb.org/3/search/tv?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&language=ar`
          : `https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(query)}&language=ar`;

        const tRes = await fetch(tmdbEndpoint);
        if (tRes.ok) {
          const tData = await tRes.json();
          for (const item of (tData.results || []).slice(0, 8)) {
            if (results.some(r => r.id === `tmdb-${item.id}`)) continue;
            results.push({
              id: `tmdb-${item.id}`,
              title: item.title || item.name,
              year: (item.release_date || item.first_air_date || '').split('-')[0] ? Number((item.release_date || item.first_air_date || '').split('-')[0]) : null,
              plot: item.overview || null,
              poster: item.poster_path ? `https://image.tmdb.org/t/p/w500${item.poster_path}` : null,
              backdrop: item.backdrop_path ? `https://image.tmdb.org/t/p/w1280${item.backdrop_path}` : null,
              rating: item.vote_average ? Math.round(item.vote_average * 10) / 10 : null,
              genres: [],
              source: 'tmdb'
            });
          }
        }
      } catch (e) {
        console.error('TMDB search error:', e.message);
      }
    } else {
      // Direct TMDB Search Scraper (Zero API Key needed - perfect for Arabic TV shows and movies!)
      try {
        const directResults = await searchTmdbDirect(query, isSeries);
        for (const item of directResults) {
          if (!results.some(r => r.id === item.id)) {
            results.push(item);
          }
        }
      } catch (e) {
        console.error('Direct TMDB search error:', e.message);
      }
    }
  }

  // 4. Search IMDb via Cinemeta Catalogue (Strictly series or movie)
  if (!isDirectCodeMatch) {
    try {
      const cSearchUrl = `https://v3-cinemeta.strem.io/catalog/${cMediaType}/top/search=${encodeURIComponent(query)}.json`;
      const cRes = await fetch(cSearchUrl, { redirect: 'follow' });
      if (cRes.ok) {
        const cData = await cRes.json();
        for (const item of (cData.metas || []).slice(0, 8)) {
          if (results.some(r => r.id === item.id)) continue;
          if (item.type && item.type !== cMediaType) continue;
          const yearVal = item.year ? Number(String(item.year).split(/[\s–-]/)[0]) : (item.releaseInfo ? Number(String(item.releaseInfo).split(/[\s–-]/)[0]) : null);
          results.push({
            id: item.id,
            title: item.name,
            year: yearVal,
            plot: item.description || null,
            poster: item.poster || null,
            backdrop: item.background || null,
            rating: item.imdbRating ? Number(item.imdbRating) : null,
            genres: Array.isArray(item.genres) ? item.genres : [],
            source: 'imdb'
          });
        }
      }
    } catch (e) {
      console.error('Cinemeta search error:', e.message);
    }
  }

  // 5. Search IMDb Suggest API only as a fallback when needed
  if (!isDirectCodeMatch && results.length < 3) {
    try {
      const sUrl = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(query)}.json`;
      const sRes = await fetch(sUrl);
      if (sRes.ok) {
        const sData = await sRes.json();
        const validItems = (sData.d || []).filter(item => {
          if (!item.id || !item.id.startsWith('tt')) return false;
          if (item.s && (item.s.toLowerCase().includes('actor') || item.s.toLowerCase().includes('actress'))) return false;
          if (isSeries) {
            return item.qid === 'tvSeries' || item.qid === 'tvMiniSeries' || item.qid === 'tvSpecial' || (item.q && item.q.toLowerCase().includes('tv'));
          } else {
            return item.qid === 'movie' || item.qid === 'tvMovie' || (item.q && (item.q.toLowerCase().includes('feature') || item.q.toLowerCase().includes('movie')));
          }
        });

        for (const item of validItems.slice(0, 6)) {
          if (results.some(r => r.id === item.id)) continue;
          results.push({
            id: item.id,
            title: item.l,
            year: item.y || null,
            plot: item.s || null,
            poster: item.i?.imageUrl || null,
            backdrop: null,
            rating: null,
            source: 'imdb'
          });
        }
      }
    } catch (e) {
      console.error('IMDb suggest search error:', e.message);
    }
  }

  res.json({ data: results });
});

export default router;
