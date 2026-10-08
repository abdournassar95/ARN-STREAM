import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';
import db, {
  getDataDir,
  getAllLibraries,
  getLibraryById,
  createLibrary,
  updateLibrary,
  deleteLibrary
} from '../db.js';
import { scanLibrary } from '../scanner/media-scanner.js';
import { requireAdmin } from '../services/auth.js';
import { processAndCacheImage } from '../services/image-cache.js';

const upload = multer({ dest: path.join(getDataDir(), 'tmp_uploads') });
const router = express.Router();

// GET all libraries (optionally filter non-empty and by user allowed_libraries)
router.get('/', (req, res) => {
  const onlyNonEmpty = req.query.non_empty === 'true';
  let libs = getAllLibraries(onlyNonEmpty);

  // Filter libraries if user is restricted
  if (req.user && req.user.role !== 'admin' && Array.isArray(req.user.allowed_libraries)) {
    libs = libs.filter(l => req.user.allowed_libraries.includes(l.id));
  }

  res.json({ data: libs });
});

// GET single library with items and sorting
router.get('/:id', (req, res) => {
  const id = Number(req.params.id);

  // Check user permission
  if (req.user && req.user.role !== 'admin' && Array.isArray(req.user.allowed_libraries)) {
    if (!req.user.allowed_libraries.includes(id)) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You do not have access to this library.' } });
    }
  }

  const lib = getLibraryById(id);
  if (!lib) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library not found' } });
  }

  const {
    sort = 'added_at',
    order = 'desc',
    q = '',
    limit = 10000,
    offset = 0
  } = req.query;

  const validSortCols = {
    year: 'year',
    added_at: 'added_at',
    title: 'title',
    rating: 'rating'
  };

  const sortCol = validSortCols[sort] || 'added_at';
  const sortDir = order?.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

  let items = [];

  if (lib.type === 'movies') {
    let sql = `
      SELECT movies.*, 
        (SELECT rating FROM ratings WHERE media_type = 'movie' AND media_id = movies.id) as rating
      FROM movies
      WHERE library_id = ?
    `;
    const params = [lib.id];

    if (q) {
      sql += ` AND title LIKE ?`;
      params.push(`%${q}%`);
    }

    const orderClause = sortCol === 'year' ? 'COALESCE(movies.year, 0)' : (sortCol === 'rating' ? 'COALESCE(rating, 0)' : (sortCol === 'title' ? 'movies.title' : 'movies.added_at'));
    sql += ` ORDER BY ${orderClause} ${sortDir}, movies.title ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(sql).all(...params);
    items = rows.map(m => {
      const poster = db.prepare(`SELECT id FROM images WHERE media_type = 'movie' AND media_id = ? AND image_type = 'poster' AND is_primary = 1`).get(m.id);
      const backdrop = db.prepare(`SELECT id FROM images WHERE media_type = 'movie' AND media_id = ? AND image_type = 'backdrop' AND is_primary = 1`).get(m.id);
      return {
        ...m,
        poster: poster ? `/api/image/${poster.id}/thumb` : null,
        backdrop: backdrop ? `/api/image/${backdrop.id}/full` : null
      };
    });
  } else if (lib.type === 'shows') {
    let sql = `
      SELECT series.*,
        (SELECT rating FROM ratings WHERE media_type = 'series' AND media_id = series.id) as rating,
        (SELECT COUNT(*) FROM seasons WHERE series_id = series.id) as seasonsCount,
        (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) as episodesCount
      FROM series
      WHERE library_id = ?
        AND EXISTS (SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id)
    `;
    const params = [lib.id];

    if (q) {
      sql += ` AND title LIKE ?`;
      params.push(`%${q}%`);
    }

    const orderClause = sortCol === 'year' ? 'COALESCE(series.year, 0)' : (sortCol === 'rating' ? 'COALESCE(rating, 0)' : (sortCol === 'title' ? 'series.title' : 'series.added_at'));
    sql += ` ORDER BY ${orderClause} ${sortDir}, series.title ASC LIMIT ? OFFSET ?`;
    params.push(Number(limit), Number(offset));

    const rows = db.prepare(sql).all(...params);
    items = rows.map(s => {
      const poster = db.prepare(`SELECT id FROM images WHERE media_type = 'series' AND media_id = ? AND image_type = 'poster' AND is_primary = 1`).get(s.id);
      const backdrop = db.prepare(`SELECT id FROM images WHERE media_type = 'series' AND media_id = ? AND image_type = 'backdrop' AND is_primary = 1`).get(s.id);
      return {
        ...s,
        poster: poster ? `/api/image/${poster.id}/thumb` : null,
        backdrop: backdrop ? `/api/image/${backdrop.id}/full` : null
      };
    });
  } else if (lib.type === 'music') {
    const view = req.query.view || 'artists';
    if (view === 'albums') {
      let sql = `
        SELECT albums.*, artists.name as artistName,
          (SELECT COUNT(*) FROM tracks WHERE album_id = albums.id) as tracksCount
        FROM albums
        JOIN artists ON artists.id = albums.artist_id
        WHERE albums.library_id = ?
      `;
      const params = [lib.id];
      if (q) {
        sql += ` AND (albums.title LIKE ? OR artists.name LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`);
      }
      const orderClause = sortCol === 'year' ? 'COALESCE(albums.year, 0)' : (sortCol === 'title' ? 'albums.title' : 'albums.added_at');
      sql += ` ORDER BY ${orderClause} ${sortDir}, albums.title ASC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const rows = db.prepare(sql).all(...params);
      items = rows.map(al => {
        const img = db.prepare(`SELECT id FROM images WHERE media_type = 'album' AND media_id = ? AND image_type = 'album_cover' AND is_primary = 1`).get(al.id);
        return {
          ...al,
          item_type: 'album',
          cover: img ? `/api/image/${img.id}/thumb` : null
        };
      });
    } else if (view === 'tracks') {
      let sql = `
        SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, artists.id as artistId
        FROM tracks
        JOIN albums ON albums.id = tracks.album_id
        JOIN artists ON artists.id = albums.artist_id
        WHERE tracks.library_id = ?
      `;
      const params = [lib.id];
      if (q) {
        sql += ` AND (tracks.title LIKE ? OR artists.name LIKE ? OR albums.title LIKE ?)`;
        params.push(`%${q}%`, `%${q}%`, `%${q}%`);
      }
      const orderClause = sortCol === 'year' ? '(SELECT COALESCE(year, 0) FROM albums WHERE albums.id = tracks.album_id)' : (sortCol === 'title' ? 'tracks.title' : 'tracks.added_at');
      sql += ` ORDER BY ${orderClause} ${sortDir}, tracks.title ASC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const rows = db.prepare(sql).all(...params);
      items = rows.map(t => {
        const img = db.prepare(`SELECT id FROM images WHERE media_type = 'album' AND media_id = ? AND image_type = 'album_cover' AND is_primary = 1`).get(t.album_id);
        return {
          ...t,
          item_type: 'track',
          url: `/api/stream/track/${t.id}`,
          cover: img ? `/api/image/${img.id}/thumb` : null
        };
      });
    } else {
      // Default: artists
      let sql = `
        SELECT artists.*,
          (SELECT COUNT(*) FROM albums WHERE artist_id = artists.id AND albums.library_id = ?) as albumsCount,
          (SELECT COUNT(*) FROM tracks JOIN albums ON albums.id = tracks.album_id WHERE albums.artist_id = artists.id AND tracks.library_id = ?) as tracksCount
        FROM artists
        WHERE artists.library_id = ?
      `;
      const params = [lib.id, lib.id, lib.id];
      if (q) {
        sql += ` AND artists.name LIKE ?`;
        params.push(`%${q}%`);
      }
      const orderClause = sortCol === 'year' ? '(SELECT COALESCE(MAX(year), 0) FROM albums WHERE artist_id = artists.id)' : (sortCol === 'title' ? 'artists.name' : 'artists.added_at');
      sql += ` ORDER BY ${orderClause} ${sortDir}, artists.name ASC LIMIT ? OFFSET ?`;
      params.push(Number(limit), Number(offset));

      const rows = db.prepare(sql).all(...params);
      items = rows.map(a => {
        // Strictly select poster or avatar for artist thumbnail; never select wide backdrops
        const artistImg = db.prepare(`
          SELECT id FROM images 
          WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'poster' OR image_type = 'avatar') AND is_primary = 1
        `).get(a.id) || db.prepare(`
          SELECT id FROM images 
          WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'poster' OR image_type = 'avatar')
          ORDER BY is_primary DESC, id DESC LIMIT 1
        `).get(a.id);
        const fallback = db.prepare(`
          SELECT images.id FROM images 
          JOIN albums ON albums.id = images.media_id AND images.media_type = 'album' 
          WHERE albums.artist_id = ? AND images.image_type = 'album_cover' 
          ORDER BY images.is_primary DESC, COALESCE(albums.year, 0) DESC, albums.id DESC LIMIT 1
        `).get(a.id);
        const imgId = artistImg?.id || fallback?.id || null;
        return {
          ...a,
          item_type: 'artist',
          title: a.name,
          image: imgId ? `/api/image/${imgId}/thumb` : null,
          poster: imgId ? `/api/image/${imgId}/thumb` : null
        };
      });
    }
  }

  let counts = null;
  if (lib.type === 'music') {
    const artistCount = db.prepare('SELECT COUNT(*) as c FROM artists WHERE library_id = ?').get(lib.id)?.c || 0;
    const albumCount = db.prepare('SELECT COUNT(*) as c FROM albums WHERE library_id = ?').get(lib.id)?.c || 0;
    const trackCount = db.prepare('SELECT COUNT(*) as c FROM tracks WHERE library_id = ?').get(lib.id)?.c || 0;
    counts = { artists: artistCount, albums: albumCount, tracks: trackCount };
  }

  res.json({
    data: {
      ...lib,
      items,
      counts
    }
  });
});

// POST create library
router.post('/', requireAdmin, (req, res) => {
  const { name, type, paths = [], icon = 'folder' } = req.body || {};
  if (!name || !name.trim()) {
    return res.status(400).json({ error: { code: 'INVALID_NAME', message: 'Library name is required' } });
  }
  if (!['movies', 'shows', 'music'].includes(type)) {
    return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Valid type is movies, shows, or music' } });
  }

  const cleanPaths = Array.isArray(paths)
    ? paths.filter(p => typeof p === 'string' && p.trim().length > 0)
    : [];

  const created = createLibrary(name, type, cleanPaths, icon);
  res.json({ data: created, message: 'Library created successfully' });
});

// PUT update library
router.put('/:id', requireAdmin, (req, res) => {
  const updated = updateLibrary(req.params.id, req.body || {});
  if (!updated) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library not found' } });
  }
  res.json({ data: updated, message: 'Library updated successfully' });
});

// DELETE library
router.delete('/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  deleteLibrary(id);
  res.json({ data: { success: true } });
});

// POST /api/libraries/:id/scan -> Scans this specific library instantly
router.post('/:id/scan', requireAdmin, async (req, res) => {
  try {
    const stats = await scanLibrary(req.params.id);
    res.json({ data: { stats }, message: 'Library scanned successfully' });
  } catch (e) {
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// POST /api/libraries/:id/upload-cover -> Upload custom cover image from computer
router.post('/:id/upload-cover', requireAdmin, upload.single('image'), async (req, res) => {
  const lib = getLibraryById(req.params.id);
  if (!lib) {
    if (req.file) { try { fs.unlinkSync(req.file.path); } catch {} }
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library not found' } });
  }

  if (!req.file) {
    return res.status(400).json({ error: { code: 'NO_FILE', message: 'No image file uploaded' } });
  }

  try {
    const result = await processAndCacheImage(req.file.path, 'library', Number(lib.id), 'library_cover', 'manual');
    try { fs.unlinkSync(req.file.path); } catch {}

    if (!result) {
      return res.status(500).json({ error: { code: 'PROCESS_FAILED', message: 'Failed to process image' } });
    }

    const coverUrl = `/api/image/${result.id}/thumb`;
    res.json({
      success: true,
      data: {
        id: result.id,
        title: req.file.originalname || 'صورة مخصصة',
        url: coverUrl,
        type: 'upload'
      }
    });
  } catch (err) {
    try { if (req.file) fs.unlinkSync(req.file.path); } catch {}
    res.status(500).json({ error: { code: 'UPLOAD_FAILED', message: err.message } });
  }
});

// GET /api/libraries/:id/available-covers -> Returns posters/covers from this library
router.get('/:id/available-covers', (req, res) => {
  const lib = getLibraryById(req.params.id);
  if (!lib) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library not found' } });
  }

  // 1. Always load custom uploads for this library first
  const customUploads = db.prepare(`
    SELECT id, 'صورة مخصصة' as title
    FROM images
    WHERE media_type = 'library' AND media_id = ?
    ORDER BY id DESC
  `).all(lib.id).map(r => ({
    id: r.id,
    title: r.title,
    url: `/api/image/${r.id}/thumb`,
    type: 'upload'
  }));

  let covers = [];
  if (lib.type === 'movies') {
    const rows = db.prepare(`
      SELECT images.id, movies.title
      FROM images
      JOIN movies ON movies.id = images.media_id AND images.media_type = 'movie'
      WHERE (movies.library_id = ? OR movies.library_id IS NULL)
        AND images.image_type = 'poster'
      ORDER BY movies.added_at DESC
      LIMIT 500
    `).all(lib.id);
    covers = [
      ...customUploads,
      ...rows.map(r => ({
        id: r.id,
        title: r.title,
        url: `/api/image/${r.id}/thumb`,
        type: 'movie'
      }))
    ];
  } else if (lib.type === 'shows') {
    const rows = db.prepare(`
      SELECT images.id, series.title
      FROM images
      JOIN series ON series.id = images.media_id AND images.media_type = 'series'
      WHERE (series.library_id = ? OR series.library_id IS NULL)
        AND images.image_type = 'poster'
      ORDER BY series.added_at DESC
      LIMIT 500
    `).all(lib.id);
    covers = [
      ...customUploads,
      ...rows.map(r => ({
        id: r.id,
        title: r.title,
        url: `/api/image/${r.id}/thumb`,
        type: 'show'
      }))
    ];
  } else if (lib.type === 'music') {
    // 1. Artists: Fetch every artist in this library
    const artists = db.prepare(`
      SELECT DISTINCT artists.id, artists.name
      FROM artists
      WHERE (artists.library_id = ? OR artists.library_id IS NULL)
      ORDER BY artists.name ASC
    `).all(lib.id);

    const artistCovers = [];
    const seenImageIds = new Set();

    for (const a of artists) {
      // 1. Check if artist has a direct image (strictly poster or avatar, never backdrop)
      let img = db.prepare(`
        SELECT id FROM images 
        WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'poster' OR image_type = 'avatar') AND is_primary = 1 
        LIMIT 1
      `).get(a.id)
        || db.prepare(`
        SELECT id FROM images 
        WHERE media_type = 'artist' AND media_id = ? AND (image_type = 'poster' OR image_type = 'avatar') 
        ORDER BY is_primary DESC, id DESC LIMIT 1
      `).get(a.id);
      
      // 2. If no direct artist image, fallback to artist's primary album cover (latest album first)
      if (!img) {
        img = db.prepare(`
          SELECT images.id
          FROM images
          JOIN albums ON albums.id = images.media_id AND images.media_type = 'album'
          WHERE albums.artist_id = ? AND images.image_type = 'album_cover'
          ORDER BY images.is_primary DESC, COALESCE(albums.year, 0) DESC, images.id DESC
          LIMIT 1
        `).get(a.id);
      }

      if (img) {
        seenImageIds.add(img.id);
        artistCovers.push({
          id: `artist_${a.id}_${img.id}`,
          imageId: img.id,
          title: a.name,
          url: `/api/image/${img.id}/thumb`,
          type: 'artist'
        });
      }
    }

    // 2. Albums: Fetch all album covers for this library
    const albumRows = db.prepare(`
      SELECT images.id, albums.title, albums.artist_id
      FROM images
      JOIN albums ON albums.id = images.media_id AND images.media_type = 'album'
      WHERE (albums.library_id = ? OR albums.library_id IS NULL)
        AND images.image_type = 'album_cover'
      ORDER BY albums.added_at DESC
      LIMIT 500
    `).all(lib.id).map(r => ({
      id: r.id,
      title: r.title,
      url: `/api/image/${r.id}/thumb`,
      type: 'album'
    }));

    covers = [
      ...customUploads,
      ...artistCovers,
      ...albumRows
    ];
  }

  let customParsed = null;
  if (lib.custom_covers) {
    try { customParsed = JSON.parse(lib.custom_covers); } catch {}
  }

  res.json({
    data: {
      libraryId: lib.id,
      libraryName: lib.name,
      currentCovers: lib.covers || [],
      customCovers: customParsed,
      availableCovers: covers
    }
  });
});

// PUT /api/libraries/:id/custom-covers -> Saves custom covers or resets
router.put('/:id/custom-covers', requireAdmin, (req, res) => {
  const lib = getLibraryById(req.params.id);
  if (!lib) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Library not found' } });
  }

  const { covers } = req.body || {};
  let val = null;
  if (Array.isArray(covers) && covers.length > 0) {
    // Filter to strings and limit to 5
    val = JSON.stringify(covers.filter(c => typeof c === 'string').slice(0, 5));
  }

  db.prepare('UPDATE libraries SET custom_covers = ? WHERE id = ?').run(val, lib.id);
  const updatedLib = getLibraryById(lib.id);

  res.json({
    data: updatedLib,
    message: val ? 'Custom covers updated successfully' : 'Custom covers reset to default'
  });
});

export default router;
