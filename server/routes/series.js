import express from 'express';
import db from '../db.js';
import { probeMedia } from '../services/ffmpeg-manager.js';
import { scanSingleSeries, scanSingleSeason } from '../scanner/media-scanner.js';
import { requireAdmin } from '../services/auth.js';
import { deleteRecord } from '../services/database-manager.js';

const router = express.Router();

router.get('/', (req, res) => {
  const { q, library_id, limit = 200, offset = 0, tags } = req.query;
  let sql = `
    SELECT series.*,
      (SELECT COUNT(*) FROM seasons WHERE seasons.series_id = series.id) as seasonsCount,
      (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) as episodesCount
    FROM series
    WHERE EXISTS (SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id)
  `;
  const params = [];
  if (library_id) {
    sql += ` AND series.library_id = ?`;
    params.push(Number(library_id));
  }
  if (q) {
    sql += ` AND series.title LIKE ?`;
    params.push(`%${q}%`);
  }
  if (tags) {
    const tagIds = tags.split(',').map(Number).filter(Boolean);
    if (tagIds.length > 0) {
      sql += ` AND series.id IN (SELECT media_id FROM media_tags WHERE media_type='series' AND tag_id IN (${tagIds.map(() => '?').join(',')}) GROUP BY media_id HAVING COUNT(DISTINCT tag_id) = ?)`;
      params.push(...tagIds, tagIds.length);
    }
  }
  sql += ` ORDER BY series.title COLLATE NOCASE ASC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  const series = db.prepare(sql).all(...params);
  const enriched = series.map(s => {
    const poster = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC LIMIT 1`).get(s.id);
    const tags = db.prepare(`SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id WHERE media_tags.media_type='series' AND media_tags.media_id=?`).all(s.id);
    return { ...s, poster: poster ? `/api/image/${poster.id}/thumb` : null, tags };
  });
  res.json({ data: enriched });
});

router.get('/:id', (req, res) => {
  try {
    const s = db.prepare(`
      SELECT series.*, libraries.name as library_name, libraries.type as library_type
      FROM series
      LEFT JOIN libraries ON libraries.id = series.library_id
      WHERE series.id=?
    `).get(req.params.id);
    if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Series not found' } });
function deduplicateImages(list) {
  if (!Array.isArray(list)) return [];
  const seen = new Set();
  const result = [];
  for (const img of list) {
    const key = img.hash || (img.local_path ? img.local_path.toLowerCase() : null) || (img.cached_path ? img.cached_path.toLowerCase() : null) || `id:${img.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(img);
    }
  }
  return result;
}

    const rawPosters = db.prepare(`SELECT * FROM images WHERE media_type='series' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC`).all(s.id);
    const rawBackdrops = db.prepare(`SELECT * FROM images WHERE media_type='series' AND media_id=? AND (image_type='backdrop' OR image_type='fanart') ORDER BY is_primary DESC, id DESC`).all(s.id);
    const poster = deduplicateImages(rawPosters);
    const backdrop = deduplicateImages(rawBackdrops);
    const seasons = db.prepare(`SELECT * FROM seasons WHERE series_id=? ORDER BY season_number`).all(s.id);
    const rating = db.prepare(`SELECT * FROM ratings WHERE media_type='series' AND media_id=?`).get(s.id);
    const tags = db.prepare(`SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id WHERE media_tags.media_type='series' AND media_tags.media_id=?`).all(s.id);

    const seasonsWithEpisodes = seasons.map(season => {
      const episodes = db.prepare(`SELECT * FROM episodes WHERE season_id=? ORDER BY episode_number`).all(season.id);
      const rawSeasonPosters = db.prepare(`SELECT * FROM images WHERE media_type='season' AND media_id=? AND (image_type='season_poster' OR image_type='poster') ORDER BY is_primary DESC, id DESC`).all(season.id);
      const rawSeasonBackdrops = db.prepare(`SELECT * FROM images WHERE media_type='season' AND media_id=? AND image_type='backdrop' ORDER BY is_primary DESC, id DESC`).all(season.id);
      const seasonPoster = deduplicateImages(rawSeasonPosters);
      const seasonBackdrop = deduplicateImages(rawSeasonBackdrops);
      return {
        ...season,
        episodes: episodes.map(ep => {
          const playback = db.prepare(`SELECT * FROM playback_state WHERE media_type='episode' AND media_id=?`).get(ep.id);
          return { ...ep, playback };
        }),
        posters: seasonPoster.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
        backdrops: seasonBackdrop.map(b => ({ id: b.id, url: `/api/image/${b.id}/full`, thumb: `/api/image/${b.id}/thumb`, is_primary: !!b.is_primary }))
      };
    });

    res.json({
      data: {
        ...s,
        posters: poster.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
        backdrops: backdrop.map(p => ({ id: p.id, url: `/api/image/${p.id}/full` })),
        seasons: seasonsWithEpisodes,
        rating: rating?.rating || null,
        tags
      }
    });
  } catch (err) {
    console.error(`[Series Details Error ${req.params.id}]:`, err.message);
    res.status(500).json({ error: { code: 'SERIES_DETAILS_FAILED', message: err.message } });
  }
});

router.get('/seasons/:seasonId', (req, res) => {
  const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(req.params.seasonId);
  if (!season) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found' } });
  const series = db.prepare('SELECT id, title FROM series WHERE id = ?').get(season.series_id);
  const posters = db.prepare("SELECT * FROM images WHERE media_type='season' AND media_id=? AND (image_type='season_poster' OR image_type='poster') ORDER BY is_primary DESC, id DESC").all(season.id);
  const backdrops = db.prepare("SELECT * FROM images WHERE media_type='season' AND media_id=? AND image_type='backdrop' ORDER BY is_primary DESC, id DESC").all(season.id);
  res.json({
    data: {
      ...season,
      seriesTitle: series?.title || '',
      posters: posters.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
      backdrops: backdrops.map(b => ({ id: b.id, url: `/api/image/${b.id}/full`, thumb: `/api/image/${b.id}/thumb`, is_primary: !!b.is_primary }))
    }
  });
});

router.get('/:id/seasons', (req, res) => {
  const seasons = db.prepare(`SELECT * FROM seasons WHERE series_id=? ORDER BY season_number`).all(req.params.id);
  res.json({ data: seasons });
});

// POST /api/series/:id/scan -> Scans this specific series, detects new files, and prunes deleted files
router.post('/:id/scan', requireAdmin, async (req, res) => {
  try {
    const stats = await scanSingleSeries(Number(req.params.id));
    res.json({ data: { stats }, message: 'تم فحص وتحديث المسلسل بنجاح' });
  } catch (e) {
    console.error(`[Series API] Scan failed for series ${req.params.id}:`, e.message);
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// POST /api/series/seasons/:seasonId/scan or /api/series/:id/seasons/:seasonId/scan
router.post(['/seasons/:seasonId/scan', '/:id/seasons/:seasonId/scan'], requireAdmin, async (req, res) => {
  try {
    const result = await scanSingleSeason(Number(req.params.seasonId));
    res.json({ data: result, message: 'تم فحص وتحديث الموسم بنجاح' });
  } catch (e) {
    console.error(`[Series API] Scan failed for season ${req.params.seasonId}:`, e.message);
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// Episode details
router.get('/episodes/:id', async (req, res) => {
  let ep = db.prepare(`
    SELECT episodes.*, seasons.season_number, seasons.series_id, series.title as series_title
    FROM episodes
    JOIN seasons ON seasons.id = episodes.season_id
    JOIN series ON series.id = seasons.series_id
    WHERE episodes.id = ?
  `).get(req.params.id);

  if (!ep) {
    const movie = db.prepare(`SELECT * FROM movies WHERE id = ?`).get(req.params.id);
    if (movie) {
      const poster = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND image_type='poster' AND is_primary=1`).get(movie.id);
      return res.json({
        data: {
          ...movie,
          type: 'movie',
          media_type: 'movie',
          poster: poster ? `/api/image/${poster.id}/thumb` : null
        }
      });
    }
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Episode not found' } });
  }
  
  if (!ep.duration && ep.path) {
    try {
      const probed = await probeMedia(ep.path);
      if (probed?.duration) {
        ep.duration = probed.duration;
        db.prepare(`UPDATE episodes SET duration = ? WHERE id = ?`).run(probed.duration, ep.id);
      }
    } catch (e) {
      console.warn(`[Episodes API] Failed to probe duration for ${ep.path}:`, e.message);
    }
  }

  const poster = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND image_type='poster' AND is_primary=1`).get(ep.series_id);
  ep.poster = poster ? `/api/image/${poster.id}/thumb` : null;
  
  res.json({ data: ep });
});

// Next-up for episode
router.get('/episodes/:id/next-up', (req, res) => {
  const ep = db.prepare(`SELECT episodes.*, seasons.series_id, seasons.season_number FROM episodes JOIN seasons ON seasons.id=episodes.season_id WHERE episodes.id=?`).get(req.params.id);
  if (!ep) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Episode not found' } });
  // Find next episode
  let next = db.prepare(`
    SELECT episodes.* FROM episodes
    JOIN seasons ON seasons.id=episodes.season_id
    WHERE seasons.series_id=? AND (seasons.season_number > ? OR (seasons.season_number = ? AND episodes.episode_number > ?))
    ORDER BY seasons.season_number, episodes.episode_number LIMIT 1
  `).get(ep.series_id, ep.season_number, ep.season_number, ep.episode_number);
  if (!next) {
    return res.json({ data: null });
  }
  res.json({ data: next });
});

// GET /api/series/:id/similar (Smart recommendations: matched by shared tags or randomized from same library)
router.get('/:id/similar', (req, res) => {
  try {
    const seriesId = Number(req.params.id);
    const current = db.prepare(`SELECT * FROM series WHERE id = ?`).get(seriesId);
    if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Series not found' } });

    // 1. Get current series tags
    const currentTags = db.prepare(`
      SELECT tag_id FROM media_tags WHERE media_type='series' AND media_id = ?
    `).all(seriesId).map(t => t.tag_id);

    let similar = [];

    // Priority 1: Match series in the same library sharing the most tags
    if (currentTags.length > 0) {
      const placeholders = currentTags.map(() => '?').join(',');
      similar = db.prepare(`
        SELECT series.*, COUNT(media_tags.tag_id) as common_tags
        FROM series
        JOIN media_tags ON media_tags.media_id = series.id AND media_tags.media_type = 'series'
        WHERE series.id != ? AND series.library_id = ? AND media_tags.tag_id IN (${placeholders})
          AND EXISTS (SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id)
        GROUP BY series.id
        ORDER BY common_tags DESC, RANDOM()
        LIMIT 12
      `).all(seriesId, current.library_id, ...currentTags);
    }

    // Priority 2: If fewer than 12 series found, backfill with random/recent series from the same library
    if (similar.length < 12) {
      const existingIds = [seriesId, ...similar.map(s => s.id)];
      const needed = 12 - similar.length;
      const placeholders = existingIds.map(() => '?').join(',');
      const additional = db.prepare(`
        SELECT series.*, 0 as common_tags
        FROM series
        WHERE series.id NOT IN (${placeholders}) AND series.library_id = ?
          AND EXISTS (SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id)
        ORDER BY RANDOM()
        LIMIT ?
      `).all(...existingIds, current.library_id, needed);

      similar = [...similar, ...additional];
    }

    // Attach posters and tags
    const enriched = similar.map(s => {
      const poster = db.prepare(`SELECT id FROM images WHERE media_type='series' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC LIMIT 1`).get(s.id);
      const tags = db.prepare(`SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id WHERE media_tags.media_type='series' AND media_tags.media_id=?`).all(s.id);
      return {
        ...s,
        poster: poster ? `/api/image/${poster.id}/thumb` : null,
        tags
      };
    });

    res.json({ data: enriched });
  } catch (err) {
    console.error(`[Series Similar Error ${req.params.id}]:`, err.message);
    res.status(500).json({ error: { code: 'SIMILAR_ERROR', message: err.message } });
  }
});

// DELETE /api/series/:id - Delete series & all seasons/episodes from server & clean database (without deleting physical files)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const ser = db.prepare('SELECT id, title FROM series WHERE id = ?').get(req.params.id);
    if (!ser) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Series not found' } });
    }
    deleteRecord('series', ser.id, false);
    res.json({
      data: { id: ser.id, title: ser.title },
      message: `تم حذف المسلسل "${ser.title}" من الخادم وقاعدة البيانات بنجاح.`
    });
  } catch (err) {
    console.error('[Series API] Delete error:', err.message);
    res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
  }
});

export default router;
