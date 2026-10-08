import express from 'express';
import fs from 'fs';
import path from 'path';
import { ZipArchive } from 'archiver';
import db from '../db.js';
import { requireAuth } from '../services/auth.js';

const router = express.Router();

// All download endpoints require authentication
router.use(requireAuth);

// Check download permission middleware
router.use((req, res, next) => {
  // Admin always has full permission
  if (req.user?.role === 'admin') return next();

  // Check can_download flag
  if (req.user.can_download === false || req.user.can_download === 0) {
    return res.status(403).json({
      error: { code: 'FORBIDDEN', message: 'ليس لديك صلاحية تنزيل الملفات من الخادم.' }
    });
  }

  next();
});

/**
 * Clean string for safe cross-platform filenames while preserving Arabic unicode
 */
function cleanFilename(name) {
  if (!name) return 'media';
  return String(name).replace(/[\\/:*?"<>|]/g, '_').trim();
}

/**
 * Set RFC 5987 / RFC 6266 standard headers for proper Arabic filename downloads
 */
function setAttachmentHeaders(res, filename, contentType = 'application/octet-stream') {
  const safe = cleanFilename(filename);
  const encoded = encodeURIComponent(safe);
  res.setHeader('Content-Type', contentType);
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${encoded}"; filename*=UTF-8''${encoded}`
  );
}

/**
 * Directly stream a single file with attachment disposition
 */
async function sendSingleFile(res, filePath, preferredName) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Media file not found on disk' } });
  }

  const ext = path.extname(filePath);
  const finalName = preferredName.toLowerCase().endsWith(ext.toLowerCase()) ? preferredName : `${preferredName}${ext}`;
  setAttachmentHeaders(res, finalName);

  const fileStream = fs.createReadStream(filePath);
  const cleanup = () => {
    if (fileStream && !fileStream.destroyed) fileStream.destroy();
  };

  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);

  fileStream.on('end', cleanup);
  fileStream.on('close', cleanup);
  fileStream.on('error', (err) => {
    cleanup();
    console.error(`[Download Error] Streaming ${filePath}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_ERROR', message: 'Error streaming file' } });
    } else {
      res.end();
    }
  });

  fileStream.pipe(res);
}

/**
 * Stream a ZIP archive on the fly without storing anything on disk or overloading memory
 */
function streamZip(res, zipName, entries, req) {
  const validEntries = entries.filter(e => e.path && fs.existsSync(e.path));
  if (!validEntries.length) {
    return res.status(404).json({ error: { code: 'NO_FILES_FOUND', message: 'No media files were found on disk to archive' } });
  }

  const finalZipName = zipName.toLowerCase().endsWith('.zip') ? zipName : `${zipName}.zip`;
  setAttachmentHeaders(res, finalZipName, 'application/zip');

  // store: true disables re-compression (fast line-rate disk read, near zero CPU usage)
  const archive = new ZipArchive({ store: true });

  const abortHandler = () => {
    console.log(`[Download ZIP] Client cancelled download for: ${finalZipName}`);
    try {
      archive.abort();
    } catch {}
  };

  req.on('close', abortHandler);

  archive.on('error', (err) => {
    console.error(`[Download ZIP Error] ${finalZipName}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'ZIP_ERROR', message: err.message } });
    } else {
      res.end();
    }
  });

  archive.pipe(res);

  // Avoid duplicate names inside the ZIP
  const usedNames = new Set();

  for (const entry of validEntries) {
    let entryName = entry.name;
    if (usedNames.has(entryName)) {
      const ext = path.extname(entryName);
      const base = entryName.slice(0, -ext.length);
      let count = 2;
      while (usedNames.has(`${base} (${count})${ext}`)) {
        count++;
      }
      entryName = `${base} (${count})${ext}`;
    }
    usedNames.add(entryName);

    archive.file(entry.path, { name: entryName });
  }

  archive.finalize();
}

/**
 * 1. Single Movie Download
 * GET /api/download/movie/:id
 */
router.get('/movie/:id', async (req, res) => {
  const movie = db.prepare(`SELECT * FROM movies WHERE id = ?`).get(req.params.id);
  if (!movie) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });

  const name = movie.year ? `${movie.title} (${movie.year})` : movie.title;
  await sendSingleFile(res, movie.path, name);
});

/**
 * 2. Single Episode Download
 * GET /api/download/episode/:id
 */
router.get('/episode/:id', async (req, res) => {
  const ep = db.prepare(`
    SELECT episodes.*, seasons.season_number, series.title as series_title
    FROM episodes
    JOIN seasons ON seasons.id = episodes.season_id
    JOIN series ON series.id = seasons.series_id
    WHERE episodes.id = ?
  `).get(req.params.id);
  if (!ep) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Episode not found' } });

  const sNum = String(ep.season_number).padStart(2, '0');
  const eNum = String(ep.episode_number).padStart(2, '0');
  const epTitle = ep.title ? ` - ${ep.title}` : '';
  const name = `${ep.series_title} - S${sNum}E${eNum}${epTitle}`;
  await sendSingleFile(res, ep.path, name);
});

/**
 * 3. Single Track Download (Music / Quran Surah)
 * GET /api/download/track/:id
 */
router.get('/track/:id', async (req, res) => {
  const track = db.prepare(`
    SELECT tracks.*, albums.title as album_title, artists.name as artist_name
    FROM tracks
    JOIN albums ON albums.id = tracks.album_id
    JOIN artists ON artists.id = albums.artist_id
    WHERE tracks.id = ?
  `).get(req.params.id);
  if (!track) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });

  const tNum = track.track_number ? `${String(track.track_number).padStart(2, '0')} - ` : '';
  const artist = track.artist_name ? `${track.artist_name} - ` : '';
  const name = `${artist}${tNum}${track.title}`;
  await sendSingleFile(res, track.path, name);
});

/**
 * 4. Full Series Download (ZIP)
 * GET /api/download/series/:id
 */
router.get('/series/:id', (req, res) => {
  const s = db.prepare(`SELECT * FROM series WHERE id = ?`).get(req.params.id);
  if (!s) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Series not found' } });

  const episodes = db.prepare(`
    SELECT episodes.*, seasons.season_number
    FROM episodes
    JOIN seasons ON seasons.id = episodes.season_id
    WHERE seasons.series_id = ?
    ORDER BY seasons.season_number, episodes.episode_number
  `).all(s.id);

  if (!episodes.length) {
    return res.status(404).json({ error: { code: 'NO_EPISODES', message: 'No episodes found for this series' } });
  }

  const entries = episodes.map(ep => {
    const sNum = String(ep.season_number).padStart(2, '0');
    const eNum = String(ep.episode_number).padStart(2, '0');
    const epTitle = ep.title ? ` - ${cleanFilename(ep.title)}` : '';
    const ext = path.extname(ep.path);
    const fileName = `S${sNum}E${eNum}${epTitle}${ext}`;
    return {
      path: ep.path,
      name: `الموسم ${sNum}/${fileName}`
    };
  });

  const zipName = s.year ? `${s.title} (${s.year})` : s.title;
  streamZip(res, zipName, entries, req);
});

/**
 * 5. Full Season Download (ZIP)
 * GET /api/download/season/:id
 */
router.get('/season/:id', (req, res) => {
  const season = db.prepare(`
    SELECT seasons.*, series.title as series_title
    FROM seasons
    JOIN series ON series.id = seasons.series_id
    WHERE seasons.id = ?
  `).get(req.params.id);
  if (!season) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Season not found' } });

  const episodes = db.prepare(`
    SELECT * FROM episodes WHERE season_id = ? ORDER BY episode_number
  `).all(season.id);

  if (!episodes.length) {
    return res.status(404).json({ error: { code: 'NO_EPISODES', message: 'No episodes found for this season' } });
  }

  const sNum = String(season.season_number).padStart(2, '0');
  const entries = episodes.map(ep => {
    const eNum = String(ep.episode_number).padStart(2, '0');
    const epTitle = ep.title ? ` - ${cleanFilename(ep.title)}` : '';
    const ext = path.extname(ep.path);
    return {
      path: ep.path,
      name: `S${sNum}E${eNum}${epTitle}${ext}`
    };
  });

  const zipName = `${season.series_title} - الموسم ${sNum}`;
  streamZip(res, zipName, entries, req);
});

/**
 * 6. Full Album / Quran Download (ZIP)
 * GET /api/download/album/:id
 */
router.get('/album/:id', (req, res) => {
  const album = db.prepare(`
    SELECT albums.*, artists.name as artist_name
    FROM albums
    JOIN artists ON artists.id = albums.artist_id
    WHERE albums.id = ?
  `).get(req.params.id);
  if (!album) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Album not found' } });

  const tracks = db.prepare(`
    SELECT * FROM tracks WHERE album_id = ? ORDER BY track_number, id
  `).all(album.id);

  if (!tracks.length) {
    return res.status(404).json({ error: { code: 'NO_TRACKS', message: 'No audio tracks found for this album' } });
  }

  const entries = tracks.map((t, idx) => {
    const num = t.track_number ? String(t.track_number).padStart(2, '0') : String(idx + 1).padStart(2, '0');
    const ext = path.extname(t.path);
    return {
      path: t.path,
      name: `${num} - ${cleanFilename(t.title)}${ext}`
    };
  });

  const zipName = album.artist_name ? `${album.artist_name} - ${album.title}` : album.title;
  streamZip(res, zipName, entries, req);
});

/**
 * 7. Full Artist / Reciter Collection Download (ZIP)
 * GET /api/download/artist/:id
 */
router.get('/artist/:id', (req, res) => {
  const artist = db.prepare(`SELECT * FROM artists WHERE id = ?`).get(req.params.id);
  if (!artist) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Artist not found' } });

  const tracks = db.prepare(`
    SELECT tracks.*, albums.title as album_title
    FROM tracks
    JOIN albums ON albums.id = tracks.album_id
    WHERE albums.artist_id = ?
    ORDER BY albums.year, albums.title, tracks.track_number, tracks.id
  `).all(artist.id);

  if (!tracks.length) {
    return res.status(404).json({ error: { code: 'NO_TRACKS', message: 'No tracks found for this artist' } });
  }

  const entries = tracks.map((t, idx) => {
    const num = t.track_number ? String(t.track_number).padStart(2, '0') : String(idx + 1).padStart(2, '0');
    const ext = path.extname(t.path);
    const folder = cleanFilename(t.album_title || 'Audio');
    return {
      path: t.path,
      name: `${folder}/${num} - ${cleanFilename(t.title)}${ext}`
    };
  });

  streamZip(res, artist.name, entries, req);
});

/**
 * 8. Custom Batch / Selected Items Download (ZIP)
 * GET /api/download/batch?type=episodes|tracks|movies|albums&ids=1,2,3&title=...
 */
router.get('/batch', (req, res) => {
  const { type, ids, title } = req.query;
  if (!type || !ids) {
    return res.status(400).json({ error: { code: 'INVALID_QUERY', message: 'Missing type or ids parameters' } });
  }

  const idList = ids.split(',').map(x => Number(x.trim())).filter(x => !isNaN(x) && x > 0);
  if (!idList.length) {
    return res.status(400).json({ error: { code: 'INVALID_IDS', message: 'No valid IDs provided' } });
  }

  const placeholders = idList.map(() => '?').join(',');

  if (type === 'episodes') {
    const episodes = db.prepare(`
      SELECT episodes.*, seasons.season_number, series.title as series_title
      FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      JOIN series ON series.id = seasons.series_id
      WHERE episodes.id IN (${placeholders})
      ORDER BY series.title, seasons.season_number, episodes.episode_number
    `).all(...idList);

    const entries = episodes.map(ep => {
      const sNum = String(ep.season_number).padStart(2, '0');
      const eNum = String(ep.episode_number).padStart(2, '0');
      const epTitle = ep.title ? ` - ${cleanFilename(ep.title)}` : '';
      const ext = path.extname(ep.path);
      return {
        path: ep.path,
        name: `${cleanFilename(ep.series_title)} - S${sNum}E${eNum}${epTitle}${ext}`
      };
    });

    const defaultTitle = episodes[0]?.series_title ? `${episodes[0].series_title} - حلقات مختارة` : 'حلقات مختارة';
    streamZip(res, title || defaultTitle, entries, req);
  } else if (type === 'tracks') {
    const tracks = db.prepare(`
      SELECT tracks.*, albums.title as album_title, artists.name as artist_name
      FROM tracks
      JOIN albums ON albums.id = tracks.album_id
      JOIN artists ON artists.id = albums.artist_id
      WHERE tracks.id IN (${placeholders})
      ORDER BY artists.name, albums.title, tracks.track_number, tracks.id
    `).all(...idList);

    const entries = tracks.map(t => {
      const num = t.track_number ? `${String(t.track_number).padStart(2, '0')} - ` : '';
      const artist = t.artist_name ? `${t.artist_name} - ` : '';
      const ext = path.extname(t.path);
      return {
        path: t.path,
        name: `${artist}${num}${cleanFilename(t.title)}${ext}`
      };
    });

    const defaultTitle = tracks[0]?.artist_name ? `${tracks[0].artist_name} - تلاوات مختارة` : 'تلاوات مختارة';
    streamZip(res, title || defaultTitle, entries, req);
  } else if (type === 'movies') {
    const movies = db.prepare(`
      SELECT * FROM movies WHERE id IN (${placeholders})
    `).all(...idList);

    const entries = movies.map(m => {
      const ext = path.extname(m.path);
      const y = m.year ? ` (${m.year})` : '';
      return {
        path: m.path,
        name: `${cleanFilename(m.title)}${y}${ext}`
      };
    });

    streamZip(res, title || 'أفلام مختارة', entries, req);
  } else if (type === 'series') {
    const episodes = db.prepare(`
      SELECT episodes.*, series.title as series_title, seasons.season_number
      FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      JOIN series ON series.id = seasons.series_id
      WHERE series.id IN (${placeholders})
      ORDER BY series.title, seasons.season_number, episodes.episode_number
    `).all(...idList);

    const entries = episodes.map(ep => {
      const sNum = String(ep.season_number || 1).padStart(2, '0');
      const eNum = String(ep.episode_number || 1).padStart(2, '0');
      const epTitle = ep.title ? ` - ${cleanFilename(ep.title)}` : '';
      const ext = path.extname(ep.path);
      const folder = `${cleanFilename(ep.series_title)}/الموسم ${sNum}`;
      return {
        path: ep.path,
        name: `${folder}/S${sNum}E${eNum}${epTitle}${ext}`
      };
    });

    streamZip(res, title || 'مسلسلات مختارة', entries, req);
  } else if (type === 'artists') {
    const tracks = db.prepare(`
      SELECT tracks.*, albums.title as album_title, artists.name as artist_name
      FROM tracks
      JOIN albums ON albums.id = tracks.album_id
      JOIN artists ON artists.id = albums.artist_id
      WHERE artists.id IN (${placeholders})
      ORDER BY artists.name, albums.title, tracks.track_number
    `).all(...idList);

    const entries = tracks.map(t => {
      const num = t.track_number ? `${String(t.track_number).padStart(2, '0')} - ` : '';
      const folder = `${cleanFilename(t.artist_name || 'Artist')}/${cleanFilename(t.album_title || 'Album')}`;
      const ext = path.extname(t.path);
      return {
        path: t.path,
        name: `${folder}/${num}${cleanFilename(t.title)}${ext}`
      };
    });

    streamZip(res, title || 'أعمال وتلاوات مختارة', entries, req);
  } else if (type === 'albums') {
    const tracks = db.prepare(`
      SELECT tracks.*, albums.title as album_title, artists.name as artist_name
      FROM tracks
      JOIN albums ON albums.id = tracks.album_id
      JOIN artists ON artists.id = albums.artist_id
      WHERE albums.id IN (${placeholders})
      ORDER BY artists.name, albums.title, tracks.track_number
    `).all(...idList);

    const entries = tracks.map(t => {
      const num = t.track_number ? String(t.track_number).padStart(2, '0') : '';
      const folder = `${cleanFilename(t.artist_name || 'Artist')} - ${cleanFilename(t.album_title || 'Album')}`;
      const ext = path.extname(t.path);
      return {
        path: t.path,
        name: `${folder}/${num ? num + ' - ' : ''}${cleanFilename(t.title)}${ext}`
      };
    });

    streamZip(res, title || 'ألبومات ومصاحف مختارة', entries, req);
  } else {
    return res.status(400).json({ error: { code: 'UNSUPPORTED_TYPE', message: `Unsupported batch download type: ${type}` } });
  }
});

export default router;
