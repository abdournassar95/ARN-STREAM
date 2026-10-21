import express from 'express';
import db from '../db.js';
import { requireAdmin, requireAuth } from '../services/auth.js';
import { scanSingleArtist, scanSingleAlbum } from '../scanner/media-scanner.js';
import { deleteRecord } from '../services/database-manager.js';
import { lyricsService } from '../services/lyrics-service.js';

const router = express.Router();

// Require authentication for all music/audio endpoints only
router.use(['/artists', '/albums', '/tracks'], requireAuth);

// Artists
router.get('/artists', (req, res) => {
  const { q, sort = 'name', order = 'asc', limit = 500, offset = 0, library_id, tags } = req.query;
  let sql = `SELECT * FROM artists`;
  const params = [];
  const conds = [];
  // Ensure artist has tracks
  conds.push(`EXISTS (SELECT 1 FROM albums JOIN tracks ON tracks.album_id = albums.id WHERE albums.artist_id = artists.id)`);
  if (q) { conds.push(`name LIKE ?`); params.push(`%${q}%`); }
  if (library_id) { conds.push(`library_id = ?`); params.push(Number(library_id)); }
  if (tags) {
    const tagIds = tags.split(',').map(Number).filter(Boolean);
    if (tagIds.length > 0) {
      conds.push(`artists.id IN (SELECT media_id FROM media_tags WHERE media_type='artist' AND tag_id IN (${tagIds.map(() => '?').join(',')}) GROUP BY media_id HAVING COUNT(DISTINCT tag_id) = ?)`);
      params.push(...tagIds, tagIds.length);
    }
  }
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
  sql += ` ORDER BY name ASC`;
  const artists = db.prepare(sql).all(...params);

  const enriched = artists.map(a => {
    // Strictly select poster or avatar for the artist card thumbnail; never select wide backdrops
    const artistImg = db.prepare(`
      SELECT id FROM images 
      WHERE media_type='artist' AND media_id=? AND (image_type='poster' OR image_type='avatar') AND is_primary=1 LIMIT 1
    `).get(a.id) || db.prepare(`
      SELECT id FROM images 
      WHERE media_type='artist' AND media_id=? AND (image_type='poster' OR image_type='avatar')
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(a.id);

    const fallback = db.prepare(`
      SELECT images.id FROM images
      JOIN albums ON albums.id=images.media_id AND images.media_type='album'
      WHERE albums.artist_id=? AND images.image_type='album_cover'
      ORDER BY images.is_primary DESC, COALESCE(albums.year, 0) DESC, images.id DESC LIMIT 1
    `).get(a.id);
    const imgId = artistImg?.id || fallback?.id || null;
    const albumsCount = db.prepare(`SELECT COUNT(*) as c FROM albums WHERE artist_id=? AND EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id)`).get(a.id).c;
    const tracksCount = db.prepare(`SELECT COUNT(*) as c FROM tracks JOIN albums ON albums.id=tracks.album_id WHERE albums.artist_id=?`).get(a.id).c;

    // Check years from albums, extracting 4-digit years from album titles if year is not set
    const artistAlbums = db.prepare(`SELECT id, title, year FROM albums WHERE artist_id=? AND EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id)`).all(a.id);
    let minYear = null;
    let maxYear = null;
    for (const alb of artistAlbums) {
      let y = alb.year;
      if (!y && alb.title) {
        const m = alb.title.match(/\b(19\d\d|20\d\d)\b/);
        if (m) {
          y = parseInt(m[1], 10);
          try { db.prepare('UPDATE albums SET year=? WHERE id=?').run(y, alb.id); } catch {}
        }
      }
      if (y && y > 1900 && y < 2100) {
        if (!minYear || y < minYear) minYear = y;
        if (!maxYear || y > maxYear) maxYear = y;
      }
    }

    const year = maxYear || minYear || null;

    const tags = db.prepare(`SELECT tags.* FROM tags JOIN media_tags ON tags.id=media_tags.tag_id WHERE media_tags.media_type='artist' AND media_tags.media_id=?`).all(a.id);

    return {
      ...a,
      image: imgId ? `/api/image/${imgId}/thumb` : null,
      imageId: imgId,
      albumsCount,
      tracksCount,
      minYear,
      maxYear,
      year,
      tags
    };
  });

  // Sort enriched artists
  const isDesc = String(order).toLowerCase() === 'desc';
  enriched.sort((x, y) => {
    if (sort === 'year') {
      const yX = x.year || (isDesc ? -Infinity : Infinity);
      const yY = y.year || (isDesc ? -Infinity : Infinity);
      if (yX !== yY) return isDesc ? yY - yX : yX - yY;
      return x.name.localeCompare(y.name, 'ar');
    }
    if (sort === 'albums') {
      if (x.albumsCount !== y.albumsCount) return isDesc ? y.albumsCount - x.albumsCount : x.albumsCount - y.albumsCount;
      return x.name.localeCompare(y.name, 'ar');
    }
    if (sort === 'added_at') {
      const dX = new Date(x.added_at || 0).getTime();
      const dY = new Date(y.added_at || 0).getTime();
      return isDesc ? dY - dX : dX - dY;
    }
    // Default name sort
    const comp = x.name.localeCompare(y.name, 'ar', { sensitivity: 'base' });
    return isDesc ? -comp : comp;
  });

  const paged = enriched.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ data: paged, total: enriched.length });
});

router.get('/artists/:id', (req, res) => {
  const artist = db.prepare(`SELECT * FROM artists WHERE id=?`).get(req.params.id);
  if (!artist) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artist not found' } });
  const albums = db.prepare(`SELECT * FROM albums WHERE artist_id=? AND EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id) ORDER BY year DESC, title`).all(artist.id);
  const enrichedAlbums = albums.map(al => {
    let year = al.year;
    if (!year && al.title) {
      const m = al.title.match(/\b(19\d\d|20\d\d)\b/);
      if (m) {
        year = parseInt(m[1], 10);
        try { db.prepare('UPDATE albums SET year=? WHERE id=?').run(year, al.id); } catch {}
      }
    }
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(al.id);
    const tracksCount = db.prepare(`SELECT COUNT(*) as c FROM tracks WHERE album_id=?`).get(al.id).c;
    return { ...al, year, cover: img ? `/api/image/${img.id}/thumb` : null, coverId: img?.id || null, tracksCount };
  });
  const artistImg = db.prepare(`SELECT * FROM images WHERE media_type='artist' AND media_id=? ORDER BY is_primary DESC, id ASC`).all(artist.id);
  const primaryPoster = artistImg.find(i => (i.image_type === 'poster' || i.image_type === 'avatar') && i.is_primary) 
    || artistImg.find(i => i.image_type === 'poster' || i.image_type === 'avatar');
  const primaryBackdrop = artistImg.find(i => (i.image_type === 'backdrop' || i.image_type === 'fanart') && i.is_primary) 
    || artistImg.find(i => i.image_type === 'backdrop' || i.image_type === 'fanart');

  const fallback = db.prepare(`
    SELECT images.* FROM images JOIN albums ON albums.id=images.media_id AND images.media_type='album'
    WHERE albums.artist_id=? AND images.image_type='album_cover'
    ORDER BY images.is_primary DESC, COALESCE(albums.year, 0) DESC, images.id DESC LIMIT 1
  `).get(artist.id);

  const posterUrl = primaryPoster ? `/api/image/${primaryPoster.id}/full` : (fallback ? `/api/image/${fallback.id}/full` : null);
  const backdropUrl = primaryBackdrop ? `/api/image/${primaryBackdrop.id}/full` : null;

  res.json({
    data: {
      ...artist,
      albums: enrichedAlbums,
      poster: posterUrl,
      backdrop: backdropUrl,
      images: artistImg.map(i => ({
        id: i.id,
        image_type: i.image_type,
        is_primary: !!i.is_primary,
        url: `/api/image/${i.id}/full`,
        thumb: `/api/image/${i.id}/thumb`
      })),
      fallbackCover: fallback ? `/api/image/${fallback.id}/full` : null
    }
  });
});

router.post('/artists/:id/scan', requireAdmin, async (req, res) => {
  try {
    const { stats } = await scanSingleArtist(req.params.id);
    res.json({ data: { stats }, message: 'Artist scanned successfully' });
  } catch (e) {
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// Albums
router.get('/albums', (req, res) => {
  const { q, artist_id, library_id, sort = 'added_at', order = 'desc', limit = 500, offset = 0, tags } = req.query;
  let sql = `SELECT albums.*, artists.name as artistName FROM albums JOIN artists ON artists.id=albums.artist_id`;
  const params = [];
  const conds = [];
  conds.push(`EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id)`);
  if (q) { conds.push(`albums.title LIKE ?`); params.push(`%${q}%`); }
  if (artist_id) { conds.push(`albums.artist_id = ?`); params.push(artist_id); }
  if (library_id) { conds.push(`albums.library_id = ?`); params.push(Number(library_id)); }
  if (tags) {
    const tagIds = tags.split(',').map(Number).filter(Boolean);
    if (tagIds.length > 0) {
      conds.push(`albums.id IN (SELECT media_id FROM media_tags WHERE media_type='album' AND tag_id IN (${tagIds.map(() => '?').join(',')}) GROUP BY media_id HAVING COUNT(DISTINCT tag_id) = ?)`);
      params.push(...tagIds, tagIds.length);
    }
  }
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');

  const albums = db.prepare(sql).all(...params);
  const enriched = albums.map(al => {
    let year = al.year;
    if (!year && al.title) {
      const m = al.title.match(/\b(19\d\d|20\d\d)\b/);
      if (m) {
        year = parseInt(m[1], 10);
        try { db.prepare('UPDATE albums SET year=? WHERE id=?').run(year, al.id); } catch {}
      }
    }
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(al.id);
    const tracksCount = db.prepare(`SELECT COUNT(*) as c FROM tracks WHERE album_id=?`).get(al.id).c;
    return { ...al, year, cover: img ? `/api/image/${img.id}/thumb` : null, coverId: img?.id, tracksCount };
  });

  // Sort enriched albums
  const isDesc = String(order).toLowerCase() === 'desc';
  enriched.sort((x, y) => {
    if (sort === 'year') {
      const yX = x.year || (isDesc ? -Infinity : Infinity);
      const yY = y.year || (isDesc ? -Infinity : Infinity);
      if (yX !== yY) return isDesc ? yY - yX : yX - yY;
      return x.title.localeCompare(y.title, 'ar');
    }
    if (sort === 'title' || sort === 'name') {
      const comp = x.title.localeCompare(y.title, 'ar', { sensitivity: 'base' });
      return isDesc ? -comp : comp;
    }
    // added_at or default
    const dX = new Date(x.added_at || 0).getTime();
    const dY = new Date(y.added_at || 0).getTime();
    return isDesc ? dY - dX : dX - dY;
  });

  const paged = enriched.slice(Number(offset), Number(offset) + Number(limit));
  res.json({ data: paged, total: enriched.length });
});

router.get('/albums/:id', (req, res) => {
  const album = db.prepare(`SELECT albums.*, artists.name as artistName FROM albums JOIN artists ON artists.id=albums.artist_id WHERE albums.id=?`).get(req.params.id);
  if (!album) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Album not found' } });
  const tracks = db.prepare(`SELECT * FROM tracks WHERE album_id=? ORDER BY track_number, title`).all(album.id);
  const cover = db.prepare(`SELECT * FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' ORDER BY is_primary DESC`).all(album.id);
  const rating = db.prepare(`SELECT * FROM ratings WHERE media_type='album' AND media_id=?`).get(album.id);
  res.json({
    data: {
      ...album,
      tracks: tracks.map(t => ({ ...t, url: `/api/stream/track/${t.id}` })),
      covers: cover.map(c => ({ id: c.id, url: `/api/image/${c.id}/full`, thumb: `/api/image/${c.id}/thumb`, is_primary: !!c.is_primary })),
      rating: rating?.rating || null
    }
  });
});

router.post('/albums/:id/scan', requireAdmin, async (req, res) => {
  try {
    const { stats } = await scanSingleAlbum(req.params.id);
    res.json({ data: { stats }, message: 'Album scanned successfully' });
  } catch (e) {
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// DELETE /api/albums/:id - Delete album & its tracks from server & clean database (without deleting physical files)
router.delete('/albums/:id', requireAdmin, (req, res) => {
  try {
    const album = db.prepare('SELECT id, title FROM albums WHERE id = ?').get(req.params.id);
    if (!album) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Album not found' } });
    }
    deleteRecord('albums', album.id, false);
    res.json({
      data: { id: album.id, title: album.title },
      message: `تم حذف الألبوم "${album.title}" من الخادم وقاعدة البيانات بنجاح.`
    });
  } catch (err) {
    console.error('[Music API] Delete album error:', err.message);
    res.status(500).json({ error: { code: 'DELETE_ERROR', message: err.message } });
  }
});

// Tracks
router.get('/tracks', (req, res) => {
  const { q, album_id, artist_id, library_id, limit=50, offset=0, tags } = req.query;
  let sql = `SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId FROM tracks JOIN albums ON albums.id=tracks.album_id JOIN artists ON artists.id=albums.artist_id`;
  const params = [];
  const conds = [];
  if (q) { conds.push(`tracks.title LIKE ?`); params.push(`%${q}%`); }
  if (album_id) { conds.push(`tracks.album_id = ?`); params.push(album_id); }
  if (artist_id) { conds.push(`albums.artist_id = ?`); params.push(artist_id); }
  if (library_id) { conds.push(`tracks.library_id = ?`); params.push(Number(library_id)); }
  if (tags) {
    const tagIds = tags.split(',').map(Number).filter(Boolean);
    if (tagIds.length > 0) {
      conds.push(`tracks.id IN (SELECT media_id FROM media_tags WHERE media_type='track' AND tag_id IN (${tagIds.map(() => '?').join(',')}) GROUP BY media_id HAVING COUNT(DISTINCT tag_id) = ?)`);
      params.push(...tagIds, tagIds.length);
    }
  }
  if (conds.length) sql += ` WHERE ` + conds.join(' AND ');
  sql += ` ORDER BY tracks.track_number LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));
  const tracks = db.prepare(sql).all(...params);
  // Enrich with album cover
  const enriched = tracks.map(t => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  });
  res.json({ data: { items: enriched, total: enriched.length } });
});

// ═══════════════════════════════════════════
// Favorites
// ═══════════════════════════════════════════
router.get('/tracks/favorites', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const tracks = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks 
    JOIN albums ON albums.id=tracks.album_id 
    JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.is_favorite = 1
    ORDER BY tracks.last_played_at DESC
    LIMIT ? OFFSET ?
  `).all(Number(limit), Number(offset));
  const total = db.prepare(`SELECT COUNT(*) as c FROM tracks WHERE is_favorite = 1`).get().c;
  const enriched = tracks.map(t => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  });
  res.json({ data: { items: enriched, total } });
});

router.post('/tracks/:id/favorite', (req, res) => {
  const track = db.prepare(`SELECT * FROM tracks WHERE id=?`).get(req.params.id);
  if (!track) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
  const newVal = track.is_favorite ? 0 : 1;
  db.prepare(`UPDATE tracks SET is_favorite=? WHERE id=?`).run(newVal, req.params.id);
  res.json({ data: { id: track.id, is_favorite: newVal } });
});

// ═══════════════════════════════════════════
// Rating
// ═══════════════════════════════════════════
router.post('/tracks/:id/rate', (req, res) => {
  const { rating } = req.body;
  if (rating === undefined || rating < 0 || rating > 5) return res.status(400).json({ error: { code: 'INVALID_RATING', message: 'Rating must be 0-5' } });
  const track = db.prepare(`SELECT * FROM tracks WHERE id=?`).get(req.params.id);
  if (!track) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
  db.prepare(`UPDATE tracks SET rating=? WHERE id=?`).run(Number(rating), req.params.id);
  res.json({ data: { id: track.id, rating: Number(rating) } });
});

// ═══════════════════════════════════════════
// Lyrics & Quran Verses
// ═══════════════════════════════════════════
router.get('/tracks/:id/lyrics', async (req, res) => {
  try {
    const data = await lyricsService.getLyricsForTrack(req.params.id);
    if (!data) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
    }
    res.json({ data });
  } catch (err) {
    console.error('[MusicRoutes] Error getting lyrics:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

router.put('/tracks/:id/lyrics', (req, res) => {
  try {
    const { lyrics } = req.body;
    const track = db.prepare(`SELECT id FROM tracks WHERE id=?`).get(req.params.id);
    if (!track) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
    }
    const result = lyricsService.saveLyrics(req.params.id, lyrics);
    res.json({ data: result });
  } catch (err) {
    console.error('[MusicRoutes] Error saving lyrics:', err);
    res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: err.message } });
  }
});

// ═══════════════════════════════════════════
// Play Tracking
// ═══════════════════════════════════════════
router.post('/tracks/:id/play', (req, res) => {
  const track = db.prepare(`SELECT * FROM tracks WHERE id=?`).get(req.params.id);
  if (!track) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
  db.prepare(`UPDATE tracks SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id=?`).run(req.params.id);
  res.json({ data: { id: track.id, play_count: (track.play_count || 0) + 1 } });
});

// ═══════════════════════════════════════════
// Recently Played
// ═══════════════════════════════════════════
router.get('/tracks/recently-played', (req, res) => {
  const { limit = 50 } = req.query;
  const tracks = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks 
    JOIN albums ON albums.id=tracks.album_id 
    JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.last_played_at IS NOT NULL
    ORDER BY tracks.last_played_at DESC
    LIMIT ?
  `).all(Number(limit));
  const enriched = tracks.map(t => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  });
  res.json({ data: { items: enriched } });
});

// ═══════════════════════════════════════════
// Most Played
// ═══════════════════════════════════════════
router.get('/tracks/most-played', (req, res) => {
  const { limit = 50 } = req.query;
  const tracks = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks 
    JOIN albums ON albums.id=tracks.album_id 
    JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.play_count > 0
    ORDER BY tracks.play_count DESC
    LIMIT ?
  `).all(Number(limit));
  const enriched = tracks.map(t => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  });
  res.json({ data: { items: enriched } });
});

// ═══════════════════════════════════════════
// Smart Playlists (auto-generated)
// ═══════════════════════════════════════════
router.get('/tracks/smart-playlists', (req, res) => {
  const enrichTrack = (t) => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  };

  // 1. Not listened in a while (>30 days or never)
  const forgotten = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks JOIN albums ON albums.id=tracks.album_id JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.last_played_at < datetime('now', '-30 days') OR (tracks.last_played_at IS NULL AND tracks.play_count = 0)
    ORDER BY RANDOM() LIMIT 30
  `).all().map(enrichTrack);

  // 2. Most played this month
  const hotThisMonth = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks JOIN albums ON albums.id=tracks.album_id JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.last_played_at > datetime('now', '-30 days')
    ORDER BY tracks.play_count DESC LIMIT 30
  `).all().map(enrichTrack);

  // 3. Same genre as last played
  const lastPlayed = db.prepare(`SELECT genre FROM tracks WHERE last_played_at IS NOT NULL AND genre IS NOT NULL ORDER BY last_played_at DESC LIMIT 1`).get();
  let sameGenre = [];
  if (lastPlayed?.genre) {
    sameGenre = db.prepare(`
      SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
      FROM tracks JOIN albums ON albums.id=tracks.album_id JOIN artists ON artists.id=albums.artist_id
      WHERE tracks.genre = ?
      ORDER BY RANDOM() LIMIT 30
    `).all(lastPlayed.genre).map(enrichTrack);
  }

  // 4. Incomplete albums (albums where some tracks have play_count=0)
  const incompleteAlbums = db.prepare(`
    SELECT albums.id, albums.title, artists.name as artistName, 
      COUNT(*) as totalTracks,
      SUM(CASE WHEN tracks.play_count = 0 THEN 1 ELSE 0 END) as unplayed
    FROM albums
    JOIN tracks ON tracks.album_id = albums.id
    JOIN artists ON artists.id = albums.artist_id
    GROUP BY albums.id
    HAVING unplayed > 0 AND unplayed < totalTracks
    ORDER BY RANDOM() LIMIT 10
  `).all().map(al => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(al.id);
    return { ...al, cover: img ? `/api/image/${img.id}/thumb` : null };
  });

  // 5. All available genres (for browsing by genre)
  const genres = db.prepare(`
    SELECT genre, COUNT(*) as count FROM tracks WHERE genre IS NOT NULL AND genre != '' GROUP BY genre ORDER BY count DESC
  `).all();

  res.json({
    data: {
      forgotten: { title: 'أغاني لم تُسمع منذ فترة', titleEn: 'Forgotten Tracks', items: forgotten },
      hotThisMonth: { title: 'الأكثر تشغيلاً هذا الشهر', titleEn: 'Hot This Month', items: hotThisMonth },
      sameGenre: { title: lastPlayed?.genre ? `أغاني ${lastPlayed.genre}` : 'أغاني من نفس النوع', titleEn: `${lastPlayed?.genre || 'Same Genre'} Tracks`, items: sameGenre, genre: lastPlayed?.genre || null },
      incompleteAlbums: { title: 'ألبومات غير مكتملة', titleEn: 'Incomplete Albums', items: incompleteAlbums },
      genres
    }
  });
});

// ═══════════════════════════════════════════
// Browse by Genre
// ═══════════════════════════════════════════
router.get('/tracks/genre/:genre', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const tracks = db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
    FROM tracks JOIN albums ON albums.id=tracks.album_id JOIN artists ON artists.id=albums.artist_id
    WHERE tracks.genre = ?
    ORDER BY tracks.play_count DESC, tracks.title
    LIMIT ? OFFSET ?
  `).all(req.params.genre, Number(limit), Number(offset));
  const total = db.prepare(`SELECT COUNT(*) as c FROM tracks WHERE genre = ?`).get(req.params.genre).c;
  const enriched = tracks.map(t => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(t.album_id);
    return { ...t, url: `/api/stream/track/${t.id}`, cover: img ? `/api/image/${img.id}/thumb` : null };
  });
  res.json({ data: { items: enriched, total, genre: req.params.genre } });
});

export default router;
