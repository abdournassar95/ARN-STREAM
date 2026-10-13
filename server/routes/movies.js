import express from 'express';
import db from '../db.js';
import { probeMedia } from '../services/ffmpeg-manager.js';
import { requireAdmin, requireAuth } from '../services/auth.js';
import { deleteRecord } from '../services/database-manager.js';

const router = express.Router();

// Require authentication for all movie endpoints
router.use(requireAuth);

function attachImages(movies) {
  return movies.map(m => {
    const poster = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC LIMIT 1`).get(m.id);
    const backdrop = db.prepare(`SELECT id FROM images WHERE media_type='movie' AND media_id=? AND (image_type='backdrop' OR image_type='fanart') ORDER BY is_primary DESC, id DESC LIMIT 1`).get(m.id);
    const rating = db.prepare(`SELECT rating FROM ratings WHERE media_type='movie' AND media_id=?`).get(m.id);
    const tags = db.prepare(`
      SELECT tags.* FROM tags JOIN media_tags ON tags.id = media_tags.tag_id
      WHERE media_tags.media_type='movie' AND media_tags.media_id=?
    `).all(m.id);
    return {
      ...m,
      poster: poster ? `/api/image/${poster.id}/thumb` : null,
      posterId: poster?.id || null,
      backdrop: backdrop ? `/api/image/${backdrop.id}/full` : null,
      backdropId: backdrop?.id || null,
      rating: rating?.rating || null,
      tags
    };
  });
}

router.get('/', (req, res) => {
  const { q, year, library_id, sort = 'added_at', order = 'DESC', limit = 50, offset = 0, tags } = req.query;
  let sql = `SELECT * FROM movies`;
  const params = [];
  const conditions = [];
  if (q) { conditions.push(`title LIKE ?`); params.push(`%${q}%`); }
  if (year) { conditions.push(`year = ?`); params.push(year); }
  if (library_id) { conditions.push(`library_id = ?`); params.push(Number(library_id)); }
  if (tags) {
    const tagIds = tags.split(',').map(Number).filter(Boolean);
    if (tagIds.length > 0) {
      conditions.push(`movies.id IN (SELECT media_id FROM media_tags WHERE media_type='movie' AND tag_id IN (${tagIds.map(() => '?').join(',')}) GROUP BY media_id HAVING COUNT(DISTINCT tag_id) = ?)`);
      params.push(...tagIds, tagIds.length);
    }
  }
  
  if (conditions.length) sql += ` WHERE ` + conditions.join(' AND ');
  const allowedSort = ['title','year','added_at','duration'];
  const s = allowedSort.includes(sort) ? sort : 'added_at';
  const o = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
  sql += ` ORDER BY ${s} ${o} LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  const movies = db.prepare(sql).all(...params);
  const total = db.prepare(`SELECT COUNT(*) as c FROM movies ${conditions.length ? 'WHERE '+conditions.join(' AND ') : ''}`).get(...params.slice(0, conditions.length)).c;
  res.json({ data: attachImages(movies), meta: { total, limit: Number(limit), offset: Number(offset) } });
});

router.get('/:id', async (req, res) => {
  try {
    let movie = db.prepare(`SELECT * FROM movies WHERE id = ?`).get(req.params.id);
    if (!movie) {
      // Check if it's an episode ID
      const ep = db.prepare(`
        SELECT episodes.*, seasons.season_number, seasons.series_id, series.title as series_title
        FROM episodes
        JOIN seasons ON seasons.id = episodes.season_id
        JOIN series ON series.id = seasons.series_id
        WHERE episodes.id = ?
      `).get(req.params.id);
      if (ep) {
        const poster = db.prepare(`SELECT * FROM images WHERE media_type='series' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC`).all(ep.series_id);
        const backdrop = db.prepare(`SELECT * FROM images WHERE media_type='series' AND media_id=? AND (image_type='backdrop' OR image_type='fanart') ORDER BY is_primary DESC, id DESC`).all(ep.series_id);
        return res.json({
          data: {
            ...ep,
            title: ep.title || `Episode ${ep.episode_number}`,
            type: 'episode',
            media_type: 'episode',
            poster: poster?.[0] ? `/api/image/${poster[0].id}/thumb` : null,
            posters: poster.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
            backdrops: backdrop.map(b => ({ id: b.id, url: `/api/image/${b.id}/full`, thumb: `/api/image/${b.id}/thumb`, is_primary: !!b.is_primary }))
          }
        });
      }
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    }

    if (!movie.duration && movie.path) {
      try {
        const probed = await probeMedia(movie.path);
        if (probed?.duration) {
          movie.duration = probed.duration;
          db.prepare(`UPDATE movies SET duration = ? WHERE id = ?`).run(probed.duration, movie.id);
        }
      } catch (e) {
        console.warn(`[Movies API] Failed to probe duration for ${movie.path}:`, e.message);
      }
    }

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

    const rawPosters = db.prepare(`SELECT * FROM images WHERE media_type='movie' AND media_id=? AND (image_type='poster' OR image_type='season_poster') ORDER BY is_primary DESC, id DESC`).all(movie.id);
    const rawBackdrops = db.prepare(`SELECT * FROM images WHERE media_type='movie' AND media_id=? AND (image_type='backdrop' OR image_type='fanart') ORDER BY is_primary DESC, id DESC`).all(movie.id);
    const poster = deduplicateImages(rawPosters);
    const backdrop = deduplicateImages(rawBackdrops);
    const rating = db.prepare(`SELECT * FROM ratings WHERE media_type='movie' AND media_id=?`).get(movie.id);
    const tags = db.prepare(`SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id WHERE media_tags.media_type='movie' AND media_tags.media_id=?`).all(movie.id);
    const playback = db.prepare(`SELECT * FROM playback_state WHERE media_type='movie' AND media_id=?`).get(movie.id);
    res.json({
      data: {
        ...movie,
        posters: poster.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
        backdrops: backdrop.map(p => ({ id: p.id, url: `/api/image/${p.id}/full`, thumb: `/api/image/${p.id}/thumb`, is_primary: !!p.is_primary })),
        rating: rating?.rating || null,
        review: rating?.review || null,
        tags,
        playback
      }
    });
  } catch (err) {
    console.error(`[Movie Details Error ${req.params.id}]:`, err.message);
    res.status(500).json({ error: { code: 'MOVIE_DETAILS_FAILED', message: err.message } });
  }
});

// GET /api/movies/:id/similar (Smart recommendations: matched by shared tags or randomized from same library)
router.get('/:id/similar', (req, res) => {
  try {
    const movieId = Number(req.params.id);
    const current = db.prepare(`SELECT * FROM movies WHERE id = ?`).get(movieId);
    if (!current) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });

    // 1. Get current movie tags
    const currentTags = db.prepare(`
      SELECT tag_id FROM media_tags WHERE media_type='movie' AND media_id = ?
    `).all(movieId).map(t => t.tag_id);

    let similar = [];

    // Priority 1: Match movies in the same library sharing the most tags
    if (currentTags.length > 0) {
      const placeholders = currentTags.map(() => '?').join(',');
      similar = db.prepare(`
        SELECT movies.*, COUNT(media_tags.tag_id) as common_tags
        FROM movies
        JOIN media_tags ON media_tags.media_id = movies.id AND media_tags.media_type = 'movie'
        WHERE movies.id != ? AND movies.library_id = ? AND media_tags.tag_id IN (${placeholders})
        GROUP BY movies.id
        ORDER BY common_tags DESC, RANDOM()
        LIMIT 12
      `).all(movieId, current.library_id, ...currentTags);
    }

    // Priority 2: If fewer than 12 movies found, backfill with random/recent movies from the same library
    if (similar.length < 12) {
      const existingIds = [movieId, ...similar.map(m => m.id)];
      const needed = 12 - similar.length;
      const placeholders = existingIds.map(() => '?').join(',');
      const additional = db.prepare(`
        SELECT movies.*, 0 as common_tags
        FROM movies
        WHERE movies.id NOT IN (${placeholders}) AND movies.library_id = ?
        ORDER BY RANDOM()
        LIMIT ?
      `).all(...existingIds, current.library_id, needed);

      similar = [...similar, ...additional];
    }

    const enriched = attachImages(similar);
    res.json({ data: enriched });
  } catch (err) {
    console.error(`[Movie Similar Error ${req.params.id}]:`, err.message);
    res.status(500).json({ error: { code: 'SIMILAR_ERROR', message: err.message } });
  }
});

// DELETE /api/movies/:id - Delete movie from server & clean database (without deleting physical file from disk)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const movie = db.prepare('SELECT id, title FROM movies WHERE id = ?').get(req.params.id);
    if (!movie) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    }
    deleteRecord('movies', movie.id, false);
    res.json({
      data: { id: movie.id, title: movie.title },
      message: `تم حذف الفيلم "${movie.title}" من الخادم وقاعدة البيانات بنجاح.`
    });
  } catch (err) {
    console.error('[Movies API] Delete error:', err.message);
    res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
  }
});

export default router;
