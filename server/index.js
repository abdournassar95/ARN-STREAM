import express from 'express';
import cors from 'cors';
import compression from 'compression';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import db, { getDataDir, getSetting, setSetting } from './db.js';

// Global process-level safety handlers to prevent unhandled crashes
process.on('uncaughtException', (err) => {
  console.error('[CRITICAL UNCAUGHT EXCEPTION]:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('[UNHANDLED PROMISE REJECTION]:', reason);
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8096; // ARN Stream Server

// Track active streams globally for the dashboard
global.activeStreams = {};

app.use(cors());

// HTTP Compression — يقلل حجم استجابات JSON/HTML بنسبة 70-80%
app.use(compression({
  level: 6,           // 0-9, 6 = توازن مثالي بين السرعة والضغط
  threshold: 1024,    // لا تضغط الاستجابات أقل من 1KB
  filter: (req, res) => {
    if (req.headers['x-no-compression']) return false;
    // Disable compression for Server-Sent Events to prevent buffering
    if (req.headers['accept'] === 'text/event-stream' || req.path.includes('/events')) return false;
    return compression.filter(req, res);
  }
}));

// Standard OWASP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Logging
app.use((req, res, next) => {
  console.log(`[API] ${req.method} ${req.url}`);
  next();
});

// Import routes
import libraryRouter from './routes/library.js';
import moviesRouter from './routes/movies.js';
import seriesRouter from './routes/series.js';
import musicRouter from './routes/music.js';
import imagesRouter from './routes/images.js';
import streamRouter from './routes/stream.js';
import playbackRouter from './routes/playback.js';
import ratingsRouter from './routes/ratings.js';
import tagsRouter from './routes/tags.js';
import collectionsRouter from './routes/collections.js';
import playlistsRouter from './routes/playlists.js';
import settingsRouter from './routes/settings.js';
import librariesRouter from './routes/libraries.js';
import metadataRouter from './routes/metadata.js';
import dashboardRouter from './routes/dashboard.js';
import authRouter from './routes/auth.js';
import handoffRouter, { broadcastToAll } from './routes/handoff.js';
import downloadRouter from './routes/download.js';
import databaseRouter from './routes/database.js';
import liveRouter from './routes/live.js';
import subtitlesRouter from './routes/subtitles.js';
import watchPartyRouter from './routes/watch-party.js';
import syncplayRouter from './routes/syncplay.js';
import { syncplayManager } from './services/syncplay-manager.js';
import jellyfinRouter from './routes/jellyfin/router.js';
import { handleJellyfinSocketConnection } from './routes/jellyfin/socket.js';
import { optionalAuth, requireAuth, requireAdmin, getInternalKey } from './services/auth.js';
import { responseCacheMiddleware, invalidateCache } from './middleware/response-cache.js';
import {
  startDlna,
  stopDlna,
  getDeviceXml,
  getContentDirectoryXml,
  getConnectionManagerXml,
  handleBrowse,
  getLocalIpAddress
} from './services/dlna.js';
import { WebSocketServer } from 'ws';
import sessionManager from './services/session-manager.js';
import dlnaController from './services/dlna-controller.js';
import { scheduleBackups } from './services/db-backup.js';
import { scheduleLogRotation } from './services/log-rotation.js';

// Jellyfin-compatible API (served at the server root for jellyfin-web clients)
const jellyfinApiPrefixes = [
  '/System',
  '/Users',
  '/UserViews',
  '/Items',
  '/Shows',
  '/Artists',
  '/Playlists',
  '/Collections',
  '/Search',
  '/Genres',
  '/MusicGenres',
  '/Persons',
  '/Studios',
  '/Movies',
  '/Trailers',
  '/Plugins',
  '/Devices',
  '/Channels',
  '/Sessions',
  '/DisplayPreferences',
  '/UserSettings',
  '/Library',
  '/Branding',
  '/QuickConnect',
  '/Localization',
  '/Startup',
  '/Videos',
  '/Audio',
  '/UserFavoriteItems',
  '/UserPlayedItems',
  '/Tasks'
];
app.use((req, res, next) => {
  const requestPath = req.path.toLowerCase();
  const isJellyfinRequest = jellyfinApiPrefixes.some(
    (prefix) => requestPath === prefix.toLowerCase() || requestPath.startsWith(`${prefix.toLowerCase()}/`)
  );
  if (!isJellyfinRequest) return next();
  return jellyfinRouter(req, res, next);
});

// Apply optional auth to attach req.user if token present
app.use(optionalAuth);

// In-memory response cache for GET endpoints (skips user-specific/stream routes)
app.use(responseCacheMiddleware);

app.use('/api/auth', authRouter);
app.use('/api/download', downloadRouter);
app.use('/api/database', databaseRouter);
app.use('/api/live', liveRouter);
app.use('/api/subtitles', subtitlesRouter);
app.use('/api/watch-party', watchPartyRouter);
app.use('/api/syncplay', syncplayRouter);
app.use('/api/library', libraryRouter);
app.use('/api/libraries', librariesRouter);
app.use('/api/movies', moviesRouter);
app.use('/api/series', seriesRouter);
app.use('/api', musicRouter); // handles /api/artists, /api/albums, /api/tracks
app.use('/api/images', imagesRouter);
app.use('/api/metadata', metadataRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/handoff', handoffRouter);

// Serve user uploaded avatars
const avatarsDir = path.join(getDataDir(), 'avatars');
if (!fs.existsSync(avatarsDir)) {
  fs.mkdirSync(avatarsDir, { recursive: true });
}
app.use('/api/avatars', express.static(avatarsDir));

// DLNA / UPnP endpoints for Smart TVs & VLC
app.get('/dlna/device.xml', (req, res) => {
  const host = getLocalIpAddress();
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(getDeviceXml(host, PORT));
});

app.get('/dlna/ContentDirectory.xml', (req, res) => {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(getContentDirectoryXml());
});

app.get('/dlna/ConnectionManager.xml', (req, res) => {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(getConnectionManagerXml());
});

app.all('/dlna/control/ContentDirectory', express.text({ type: '*/*' }), (req, res) => {
  const host = getLocalIpAddress();
  const body = req.body || '';
  const match = body.match(/<ObjectID>([^<]+)<\/ObjectID>/i);
  const objectId = match ? match[1] : (req.query.ObjectID || '0');
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(handleBrowse(objectId, host, PORT));
});

app.all('/dlna/control/ConnectionManager', express.text({ type: '*/*' }), (req, res) => {
  res.setHeader('Content-Type', 'text/xml; charset=utf-8');
  res.send(`<?xml version="1.0" encoding="utf-8"?><s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body><u:GetProtocolInfoResponse xmlns:u="urn:schemas-upnp-org:service:ConnectionManager:1"><Source>http-get:*:video/mp4:*,http-get:*:video/x-matroska:*,http-get:*:audio/mpeg:*</Source><Sink></Sink></u:GetProtocolInfoResponse></s:Body></s:Envelope>`);
});

// Image binary handlers
app.get('/api/image/:id/full', (req, res) => {
  const img = db.prepare(`SELECT * FROM images WHERE id=?`).get(req.params.id);
  if (!img) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });
  
  let fileToServe = img.cached_path && fs.existsSync(img.cached_path) ? img.cached_path : null;
  if (!fileToServe && img.local_path && img.source !== 'embedded' && fs.existsSync(img.local_path)) {
    fileToServe = img.local_path;
  }
  if (!fileToServe && img.thumbnail_path && fs.existsSync(img.thumbnail_path)) {
    fileToServe = img.thumbnail_path;
  }

  if (img.source === 'placeholder' || !fileToServe) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1A1A1A"/><stop offset="100%" stop-color="#2A2A2A"/></linearGradient></defs><rect width="500" height="750" fill="url(#g)"/><text x="250" y="360" text-anchor="middle" fill="#FFF" font-family="Inter,sans-serif" font-size="22" font-weight="600">${img.media_type}</text><text x="250" y="390" text-anchor="middle" fill="#A1A1A1" font-family="Inter,sans-serif" font-size="14">${img.image_type}</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  }
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.sendFile(path.resolve(fileToServe), (err) => {
    if (err && !res.headersSent) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="750" viewBox="0 0 500 750"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#1A1A1A"/><stop offset="100%" stop-color="#2A2A2A"/></linearGradient></defs><rect width="500" height="750" fill="url(#g)"/><text x="250" y="360" text-anchor="middle" fill="#FFF" font-family="Inter,sans-serif" font-size="22" font-weight="600">${img.media_type}</text><text x="250" y="390" text-anchor="middle" fill="#A1A1A1" font-family="Inter,sans-serif" font-size="14">${img.image_type}</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    }
  });
});

app.get('/api/image/:id/thumb', (req, res) => {
  const img = db.prepare(`SELECT * FROM images WHERE id=?`).get(req.params.id);
  if (!img) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found' } });
  
  let fileToServe = img.thumbnail_path && fs.existsSync(img.thumbnail_path) ? img.thumbnail_path : null;
  if (!fileToServe && img.cached_path && fs.existsSync(img.cached_path)) {
    fileToServe = img.cached_path;
  }
  if (!fileToServe && img.local_path && img.source !== 'embedded' && fs.existsSync(img.local_path)) {
    fileToServe = img.local_path;
  }

  if (img.source === 'placeholder' || !fileToServe) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="#1A1A1A"/><text x="150" y="220" text-anchor="middle" fill="#A1A1A1" font-family="sans-serif" font-size="14">${img.media_type}</text></svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(svg);
  }
  res.setHeader('Cache-Control', 'public, max-age=3600, must-revalidate');
  res.sendFile(path.resolve(fileToServe), (err) => {
    if (err && !res.headersSent) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450" viewBox="0 0 300 450"><rect width="300" height="450" fill="#1A1A1A"/><text x="150" y="220" text-anchor="middle" fill="#A1A1A1" font-family="sans-serif" font-size="14">${img.media_type}</text></svg>`;
      res.setHeader('Content-Type', 'image/svg+xml');
      res.send(svg);
    }
  });
});

app.use('/api/stream', streamRouter);
app.use('/api/playback', playbackRouter);
app.use('/api/ratings', ratingsRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/collections', collectionsRouter);
app.use('/api/playlists', playlistsRouter);

// Smart Predictive Search with Arabic normalization, ranked relevance, and rich thumbnails
import { normalizeArabic } from './db.js';

app.get('/api/search', requireAuth, (req, res) => {
  const { q, type = 'all', limit = 20 } = req.query;
  if (!q || !q.trim()) return res.json({ data: [], prediction: null });

  const rawQ = q.trim();
  const normQ = normalizeArabic(rawQ);
  if (!normQ) return res.json({ data: [], prediction: null });

  const numLimit = Math.min(100, Math.max(1, Number(limit) || 20));

  // Generate normalized query variations
  const noAl = normQ.startsWith('al') ? normQ.slice(2) : (normQ.startsWith('ال') ? normQ.slice(2) : normQ);
  const withAl = normQ.startsWith('ال') ? normQ : 'ال' + normQ;

  const exactStartPattern = `${normQ}%`;
  const containsPattern = `%${normQ}%`;
  const noAlPattern = `%${noAl}%`;
  const withAlPattern = `%${withAl}%`;

  let results = [];

  // Batch-fetch all library names once (avoids per-result queries)
  const allLibs = db.prepare(`SELECT id, name FROM libraries`).all();
  const libMap = new Map(allLibs.map(l => [l.id, l.name]));
  const getLibName = (libId) => libMap.get(libId) || null;

  // ─── Reusable image subquery ──────────────────────────────────────────────
  // Picks the best image per media item in a single scan:
  //   1. is_primary=1 poster  →  2. any poster  →  3. any image
  const imageSubquery = (mediaType) => `
    SELECT media_id, id
    FROM images
    WHERE media_type = '${mediaType}'
    ORDER BY
      CASE WHEN image_type = 'poster' AND is_primary = 1 THEN 0
           WHEN image_type = 'poster' THEN 1
           WHEN image_type = 'backdrop' AND is_primary = 1 THEN 2
           ELSE 3
      END
  `;

  // 1. Movies — single JOIN query (replaces N+1)
  if (type === 'all' || type === 'movie') {
    const movies = db.prepare(`
      SELECT m.id, m.title, m.year, m.library_id, 'movie' as type,
        CASE
          WHEN norm_ar(m.title) LIKE ? THEN 1
          WHEN norm_ar(m.title) LIKE ? THEN 2
          WHEN norm_ar(m.title) LIKE ? THEN 3
          ELSE 4
        END as rank,
        img.id as image_id
      FROM movies m
      LEFT JOIN (${imageSubquery('movie')}) img ON img.media_id = m.id
      WHERE norm_ar(m.title) LIKE ? OR norm_ar(m.title) LIKE ? OR norm_ar(m.title) LIKE ?
      GROUP BY m.id
      ORDER BY rank ASC, m.year DESC, m.title ASC
      LIMIT ?
    `).all(exactStartPattern, containsPattern, noAlPattern, containsPattern, noAlPattern, withAlPattern, numLimit);

    for (const m of movies) {
      results.push({
        id: m.id,
        title: m.title,
        year: m.year,
        type: 'movie',
        libraryName: getLibName(m.library_id),
        poster: m.image_id ? `/api/image/${m.image_id}/thumb` : null,
        rank: m.rank
      });
    }
  }

  // 2. Series — single JOIN query
  if (type === 'all' || type === 'series') {
    const series = db.prepare(`
      SELECT s.id, s.title, s.year, s.library_id, 'series' as type,
        CASE
          WHEN norm_ar(s.title) LIKE ? THEN 1
          WHEN norm_ar(s.title) LIKE ? THEN 2
          WHEN norm_ar(s.title) LIKE ? THEN 3
          ELSE 4
        END as rank,
        img.id as image_id
      FROM series s
      LEFT JOIN (${imageSubquery('series')}) img ON img.media_id = s.id
      WHERE norm_ar(s.title) LIKE ? OR norm_ar(s.title) LIKE ? OR norm_ar(s.title) LIKE ?
      GROUP BY s.id
      ORDER BY rank ASC, s.title ASC
      LIMIT ?
    `).all(exactStartPattern, containsPattern, noAlPattern, containsPattern, noAlPattern, withAlPattern, numLimit);

    for (const s of series) {
      results.push({
        id: s.id,
        title: s.title,
        year: s.year,
        type: 'series',
        libraryName: getLibName(s.library_id),
        poster: s.image_id ? `/api/image/${s.image_id}/thumb` : null,
        rank: s.rank
      });
    }
  }

  // 3. Tracks — single JOIN query (album cover)
  if (type === 'all' || type === 'track') {
    const tracks = db.prepare(`
      SELECT tracks.id, tracks.title, tracks.album_id, artists.name as artistName, albums.title as albumTitle, 'track' as type,
        CASE
          WHEN norm_ar(tracks.title) LIKE ? THEN 1
          WHEN norm_ar(tracks.title) LIKE ? THEN 2
          ELSE 3
        END as rank,
        img.id as image_id
      FROM tracks
      JOIN albums ON albums.id = tracks.album_id
      JOIN artists ON artists.id = albums.artist_id
      LEFT JOIN (${imageSubquery('album')}) img ON img.media_id = tracks.album_id
      WHERE norm_ar(tracks.title) LIKE ? OR norm_ar(tracks.title) LIKE ? OR norm_ar(artists.name) LIKE ?
      GROUP BY tracks.id
      ORDER BY rank ASC, tracks.title ASC
      LIMIT ?
    `).all(exactStartPattern, containsPattern, containsPattern, noAlPattern, containsPattern, numLimit);

    for (const t of tracks) {
      results.push({
        id: t.id,
        title: t.title,
        album_id: t.album_id,
        artistName: t.artistName,
        albumTitle: t.albumTitle,
        type: 'track',
        poster: t.image_id ? `/api/image/${t.image_id}/thumb` : null,
        rank: t.rank + 1
      });
    }
  }

  // 4. Artists — single JOIN query
  if (type === 'all' || type === 'artist') {
    const artists = db.prepare(`
      SELECT a.id, a.name as title, 'artist' as type,
        CASE
          WHEN norm_ar(a.name) LIKE ? THEN 1
          WHEN norm_ar(a.name) LIKE ? THEN 2
          ELSE 3
        END as rank,
        img.id as image_id
      FROM artists a
      LEFT JOIN (${imageSubquery('artist')}) img ON img.media_id = a.id
      WHERE norm_ar(a.name) LIKE ? OR norm_ar(a.name) LIKE ?
      GROUP BY a.id
      ORDER BY rank ASC, a.name ASC
      LIMIT ?
    `).all(exactStartPattern, containsPattern, containsPattern, noAlPattern, numLimit);

    for (const a of artists) {
      results.push({
        id: a.id,
        title: a.title,
        type: 'artist',
        poster: a.image_id ? `/api/image/${a.image_id}/thumb` : null,
        rank: a.rank
      });
    }
  }

  // Sort combined results by rank, poster presence, then title length
  results.sort((a, b) => {
    if (a.rank !== b.rank) return a.rank - b.rank;
    if (!!a.poster !== !!b.poster) return a.poster ? -1 : 1;
    return a.title.length - b.title.length;
  });

  // Deduplicate results by title and type (keeping the higher ranked / poster item)
  const seen = new Set();
  const deduped = [];
  for (const item of results) {
    const key = `${item.type}:${item.title.trim().toLowerCase()}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(item);
    }
  }

  const finalResults = deduped.slice(0, numLimit);
  const topPrediction = finalResults[0]?.title || null;

  res.json({
    data: finalResults,
    prediction: topPrediction
  });
});

// Scan & System control endpoints
import { scanAll } from './scanner/media-scanner.js';
import { scanImages } from './scanner/image-scanner.js';
import { cleanMissingFiles, cleanOrphanedData } from './services/database-manager.js';

let currentScanState = {
  isScanning: false,
  progress: 0,
  current: 0,
  total: 0,
  currentFile: '',
  libraryName: '',
  phase: 'idle',
  newItems: [],
  lastScanTime: null,
  lastScanStats: null
};

let lastBroadcastTime = 0;
function notifyScanProgress(info) {
  const now = Date.now();
  currentScanState = {
    ...currentScanState,
    isScanning: true,
    progress: info.progress,
    current: info.current,
    total: info.total,
    currentFile: info.currentFile || '',
    libraryName: info.libraryName || '',
    phase: info.phase || 'scanning',
    newCount: info.newCount || 0
  };

  if (info.progress === 100 || info.progress <= 1 || now - lastBroadcastTime > 80) {
    lastBroadcastTime = now;
    broadcastToAll('scan_progress', {
      progress: info.progress,
      current: info.current,
      total: info.total,
      currentFile: info.currentFile,
      libraryName: info.libraryName,
      phase: info.phase,
      newCount: info.newCount || 0
    });
  }
}

async function executeFullScan(isPeriodic = false) {
  if (currentScanState.isScanning) {
    return currentScanState;
  }

  currentScanState.isScanning = true;
  currentScanState.progress = 1;
  currentScanState.phase = 'starting';
  currentScanState.currentFile = 'بدء فحص ومزامنة المكتبات...';
  notifyScanProgress({ progress: 1, current: 0, total: 1, currentFile: 'بدء فحص ومزامنة المكتبات...', libraryName: 'كافة المكتبات', phase: 'starting', newCount: 0 });

  try {
    const mediaStats = await scanAll({ onProgress: notifyScanProgress });

    // Heavy disk image scanning only on initial startup or when new media items were actually found
    const imageCount = db.prepare('SELECT COUNT(*) as count FROM images').get()?.count || 0;
    let imageStats = null;
    if (!isPeriodic || (mediaStats && mediaStats.newItems > 0) || imageCount === 0) {
      notifyScanProgress({ progress: 98, current: currentScanState.total, total: currentScanState.total, currentFile: 'فحص البوسترات والصور...', libraryName: 'الصور', phase: 'images', newCount: mediaStats?.newItems || 0 });
      imageStats = await scanImages();
    }

    notifyScanProgress({ progress: 99, current: currentScanState.total, total: currentScanState.total, currentFile: 'تنظيف السجلات المحذوفة...', libraryName: 'قاعدة البيانات', phase: 'cleaning', newCount: mediaStats?.newItems || 0 });
    const pruneResults = cleanMissingFiles(false);
    const orphanResults = cleanOrphanedData();

    // Invalidate cached library/movie/series/music responses
    invalidateCache('/api/library');
    invalidateCache('/api/movies');
    invalidateCache('/api/series');
    invalidateCache('/api/artists');
    invalidateCache('/api/albums');
    invalidateCache('/api/tracks');
    invalidateCache('/api/collections');
    invalidateCache('/api/playlists');
    invalidateCache('/api/libraries');

    currentScanState = {
      isScanning: false,
      progress: 100,
      current: currentScanState.total,
      total: currentScanState.total,
      currentFile: 'اكتمل الفحص بنجاح',
      libraryName: 'كافة المكتبات',
      phase: 'completed',
      newItems: mediaStats?.newItemsList || [],
      lastScanTime: new Date().toISOString(),
      lastScanStats: mediaStats
    };

    broadcastToAll('scan_completed', {
      stats: mediaStats,
      newItems: mediaStats?.newItemsList || [],
      count: (mediaStats?.newItemsList || []).length,
      pruned: pruneResults?.totalMissing || 0
    });

    if ((mediaStats && mediaStats.newItems > 0) || (pruneResults && pruneResults.totalMissing > 0)) {
      broadcastToAll('library_updated', {
        message: 'تم تحديث وتنظيف المكتبة تلقائياً',
        count: mediaStats?.newItems || 0,
        pruned: pruneResults?.totalMissing || 0,
        newItems: mediaStats?.newItemsList || []
      });
    }

    return { mediaStats, imageStats, pruneResults, orphanResults };
  } catch (err) {
    console.error('[Scanner] Full scan failed:', err);
    currentScanState.isScanning = false;
    currentScanState.phase = 'error';
    broadcastToAll('scan_completed', {
      error: err.message,
      stats: null,
      newItems: []
    });
    throw err;
  }
}

// GET /api/scan/status -> Current scan state
app.get('/api/scan/status', (req, res) => {
  res.json({ data: currentScanState });
});

app.post('/api/scan', (req, res, next) => {
  const clientIp = req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || '';
  const isLoopback = clientIp === '127.0.0.1' || clientIp === '::1' || clientIp === '::ffff:127.0.0.1' || req.hostname === 'localhost' || req.hostname === '127.0.0.1';
  const hasNoExternalOrigin = !req.headers.origin && !req.headers.referer;
  const internalKey = req.headers['x-arn-internal-key'];

  // Automatically authenticate if request is from local desktop system tray
  if (isLoopback && ((internalKey && internalKey === getInternalKey()) || hasNoExternalOrigin)) {
    req.user = { id: 1, username: 'admin', role: 'admin', is_active: 1, isInternal: true };
    return next();
  }
  requireAdmin(req, res, next);
}, async (req, res) => {
  const isAsync = req.query.async === 'true' || req.headers['x-async'] === 'true' || Boolean(req.user?.isInternal);

  if (isAsync) {
    res.json({
      data: {
        status: 'started',
        message: 'تم بدء فحص ومزامنة المكتبة في الخلفية...'
      }
    });

    executeFullScan(false).catch(err => {
      console.error('[Scan] Background scan error:', err.message);
    });
    return;
  }

  try {
    const results = await executeFullScan(false);
    res.json({ 
      data: { 
        media: results.mediaStats, 
        images: results.imageStats,
        pruned: results.pruneResults,
        orphans: results.orphanResults,
        newItems: results.mediaStats?.newItemsList || []
      },
      message: 'تم فحص المكتبات وتحديث وتنظيف قاعدة البيانات بنجاح.'
    });
  } catch (e) {
    res.status(500).json({ error: { code: 'SCAN_FAILED', message: e.message } });
  }
});

// POST /api/system/restart -> Graceful restart of ARN Stream
app.post('/api/system/restart', requireAdmin, (req, res) => {
  res.json({ success: true, message: 'جاري إعادة تشغيل الخادم الآن...' });
  setTimeout(() => {
    console.log('[System] Admin requested restart. Spawning child process and terminating current instance...');
    try {
      const child = spawn(process.argv[0], process.argv.slice(1), {
        cwd: process.cwd(),
        detached: true,
        stdio: 'inherit',
        env: process.env
      });
      child.unref();
    } catch (err) {
      console.error('[System] Error spawning restart process:', err.message);
    }
    process.exit(0);
  }, 600);
});

// Metadata TMDB / MusicBrainz (user-triggered)
import * as tmdb from './services/metadata-tmdb.js';
import * as mb from './services/metadata-musicbrainz.js';

app.get('/api/metadata/tmdb/search', requireAdmin, async (req, res) => {
  const { q, type } = req.query;
  if (!q) return res.status(400).json({ error: { code: 'MISSING_Q', message: 'q required' } });
  try {
    const results = await tmdb.searchTMDB(q, type);
    res.json({ data: results });
  } catch (e) {
    res.status(500).json({ error: { code: 'TMDB_ERROR', message: e.message } });
  }
});

app.post('/api/metadata/tmdb/apply', requireAdmin, async (req, res) => {
  const { media_type, media_id, tmdb_id } = req.body;
  if (!media_type || !media_id || !tmdb_id) return res.status(400).json({ error: { code: 'MISSING_FIELDS', message: 'media_type, media_id, tmdb_id required' } });
  try {
    if (media_type === 'movie') {
      const details = await tmdb.fetchMovieDetails(tmdb_id);
      db.prepare(`UPDATE movies SET title=?, plot=?, tmdb_id=? WHERE id=?`).run(details.title, details.overview, tmdb_id, media_id);
      res.json({ data: details, meta: { notice: 'Metadata provided by TMDB' } });
    } else if (media_type === 'series') {
      const details = await tmdb.fetchTVDetails(tmdb_id);
      db.prepare(`UPDATE series SET title=?, plot=?, tmdb_id=? WHERE id=?`).run(details.name, details.overview, tmdb_id, media_id);
      res.json({ data: details, meta: { notice: 'Metadata provided by TMDB' } });
    } else {
      res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Only movie/series supported' } });
    }
  } catch (e) {
    res.status(500).json({ error: { code: 'TMDB_ERROR', message: e.message } });
  }
});

app.get('/api/metadata/musicbrainz/search', requireAdmin, async (req, res) => {
  const { q, type } = req.query;
  try {
    const results = await mb.searchMusicBrainz(q, type || 'artist');
    res.json({ data: results });
  } catch (e) {
    res.status(500).json({ error: { code: 'MB_ERROR', message: e.message } });
  }
});

app.get('/api/health', (req, res) => res.json({ data: { status: 'ok', uptime: process.uptime() } }));

// Serve the Jellyfin web client (built output) under /jellyfin
const jellyfinDistCandidates = [
  process.env.JELLYFIN_WEB_DIST,
  path.join(__dirname, 'public', 'jellyfin'),
  path.join(__dirname, '..', 'client', 'jellyfin'),
  path.join(__dirname, '..', 'jellyfin-web', 'dist'),
  path.join(process.cwd(), 'jellyfin-web', 'dist')
].filter(Boolean);
const jellyfinDist = jellyfinDistCandidates.find(candidate => fs.existsSync(path.join(candidate, 'index.html')));

if (jellyfinDist) {
  console.log(`Serving Jellyfin web client from: ${jellyfinDist}`);
  app.use('/jellyfin', express.static(jellyfinDist, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      const name = path.basename(filePath);
      if (filePath.endsWith('.html') || name === 'config.json' || name === 'manifest.json' || name === 'serviceworker.js') {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get(['/jellyfin', '/jellyfin/*'], (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(path.join(jellyfinDist, 'index.html'));
  });
} else {
  app.get(['/jellyfin', '/jellyfin/*'], (req, res) => {
    res.status(503).json({
      error: {
        code: 'JELLYFIN_WEB_NOT_FOUND',
        message: 'Jellyfin web build not found. Place the built jellyfin-web dist folder in server/public/jellyfin or set JELLYFIN_WEB_DIST.'
      }
    });
  });
}

// Serve client in production
const possibleDistPaths = [
  path.join(__dirname, '../client/dist'),
  path.join(__dirname, 'client/dist'),
  path.join(process.cwd(), 'client/dist'),
  path.join(process.cwd(), '../client/dist')
];
const clientDist = possibleDistPaths.find(p => fs.existsSync(p));
if (clientDist) {
  console.log(`📦 Serving production client from: ${clientDist}`);

  // Read index.html with mtime caching to eliminate disk I/O while automatically updating on rebuilds
  const indexPath = path.join(clientDist, 'index.html');
  let cachedIndexHtml = '';
  let cachedIndexMtime = 0;

  const getFreshIndexHtml = () => {
    try {
      if (fs.existsSync(indexPath)) {
        const stat = fs.statSync(indexPath);
        if (stat.mtimeMs !== cachedIndexMtime) {
          cachedIndexHtml = fs.readFileSync(indexPath, 'utf8');
          cachedIndexMtime = stat.mtimeMs;
        }
      }
    } catch (err) {
      console.warn('Could not read index.html:', err.message);
    }
    return cachedIndexHtml;
  };
  getFreshIndexHtml();

  app.use(express.static(clientDist, {
    index: false,
    maxAge: '1y',         // cache all static assets for 1 year
    immutable: true,      // Vite hashes filenames → safe to mark immutable
    setHeaders: (res, filePath) => {
      // HTML must never be cached (SPA entry point changes on rebuild)
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    }
  }));
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/stream') || req.path.startsWith('/uploads') || req.path.startsWith('/dlna')) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } });
    }
    const html = getFreshIndexHtml();
    if (html) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      return res.send(html);
    }
    res.sendFile(indexPath);
  });
}

// 404
app.use((req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found' } }));
app.use((err, req, res, next) => {
  console.error('[Error]', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: err.message } });
});

const server = app.listen(PORT, '0.0.0.0', async () => {
  console.log(`\n======================================================`);
  console.log(`🎬 أهلاً بك في ARN Stream — منصة الوسائط المتكاملة`);
  console.log(`✨ تطوير وبرمجة: عبده رجب نصار (ARN Technology 2026)`);
  console.log(`🚀 خادم الباك إند (API) يعمل على: http://localhost:${PORT}`);
  console.log(`💻 رابط واجهة التطوير (Vite Live): http://localhost:5173`);
  console.log(`📁 قاعدة البيانات: ${db.name}`);
  console.log(`======================================================\n`);
  
  // Initialize DLNA SSDP auto-discovery on local network if enabled
  try {
    const isDlnaEnabled = getSetting('dlna_enabled', 'true') === 'true';
    if (isDlnaEnabled) {
      startDlna(PORT);
      dlnaController.startDiscovery();
      console.log(`📡 خدمة DLNA/UPnP تعمل بنجاح للبث والتحكم بالشاشات الذكية (Port: ${PORT})`);
    }
  } catch (err) {
    console.warn('[DLNA Init Warning]:', err.message);
  }

  scheduleBackups(24);
  console.log('💾 Automated database backup scheduled (every 24h)');
  scheduleLogRotation();

  const runDailyScanIfNeeded = async (triggerType = 'startup') => {
    try {
      const lastScanStr = getSetting('last_auto_scan_time', null);
      const now = Date.now();
      const ONE_DAY_MS = 24 * 60 * 60 * 1000;

      if (lastScanStr) {
        const lastScanDate = new Date(lastScanStr).getTime();
        const diffMs = now - lastScanDate;
        if (!isNaN(diffMs) && diffMs < ONE_DAY_MS) {
          const hoursLeft = Math.max(1, Math.round((ONE_DAY_MS - diffMs) / (1000 * 60 * 60)));
          console.log(`[Scanner] تم تجاوز الفحص التلقائي عند (${triggerType}): آخر فحص تم في ${new Date(lastScanStr).toLocaleString('ar-EG')} (متبقي ${hoursLeft} ساعة تقريباً على الفحص اليومي القادم).`);
          return;
        }
      }

      console.log(`[Scanner] بدء الفحص التلقائي اليومي الشامل (${triggerType})...`);
      await executeFullScan(true);
      setSetting('last_auto_scan_time', new Date().toISOString());
      console.log('✅ [Scanner] اكتمل الفحص التلقائي اليومي بنجاح وتم تحديث الطابع الزمني.');
    } catch (e) {
      console.error('[Scanner] فشل الفحص التلقائي اليومي:', e.message);
    }
  };

  // Delayed startup check (skips if scanned in the last 24 hours)
  setTimeout(() => runDailyScanIfNeeded('startup'), 6000);

  // Hourly periodic check to trigger the 24-hour daily scan precisely when due
  setInterval(() => runDailyScanIfNeeded('daily_schedule'), 60 * 60 * 1000);
});

// Real-Time High-Speed WebSocket Server for PlayTo / Remote Control (< 5ms response time)
const wss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
const jellyfinWss = new WebSocketServer({ noServer: true, maxPayload: 16384 });
const syncplayWss = new WebSocketServer({ noServer: true, maxPayload: 32768 });

wss.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const deviceId = url.searchParams.get('deviceId');
    if (!deviceId) {
      ws.close(4001, 'deviceId required');
      return;
    }
    sessionManager.attachWebSocket(deviceId, ws, {
      ip: req.socket.remoteAddress,
      userAgent: req.headers['user-agent'] || ''
    });
  } catch (err) {
    console.warn('[WS Connection Error]:', err.message);
  }
});

// ARN SyncPlay WebSocket Handler (Real-Time Synchronized Group Viewing & Live Chat)
syncplayWss.on('connection', (ws, req) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const roomId = url.searchParams.get('roomId');
    const userId = url.searchParams.get('userId') || `guest-${Date.now()}`;
    const deviceId = url.searchParams.get('deviceId');
    const connectionId = url.searchParams.get('connectionId');
    const username = decodeURIComponent(url.searchParams.get('username') || 'ضيف ARN');
    const avatar = url.searchParams.get('avatar') || null;

    if (!roomId) {
      ws.close(4001, 'roomId required');
      return;
    }

    const joined = syncplayManager.joinRoom(roomId.toUpperCase(), ws, { id: userId, deviceId, connectionId, username, avatar });
    if (!joined) return;

    ws.on('message', (rawData) => {
      syncplayManager.handleMessage(ws, rawData);
    });

    ws.on('close', () => {
      syncplayManager.leaveRoom(ws);
    });

    ws.on('error', (err) => {
      console.warn('[SyncPlay WS Error]:', err.message);
      syncplayManager.leaveRoom(ws);
    });
  } catch (err) {
    console.warn('[SyncPlay Connection Error]:', err.message);
  }
});

jellyfinWss.on('connection', handleJellyfinSocketConnection);

server.on('upgrade', (req, socket, head) => {
  let pathname;
  try {
    pathname = new URL(req.url, `http://${req.headers.host || 'localhost'}`).pathname;
  } catch {
    socket.destroy();
    return;
  }

  if (pathname === '/ws/handoff') {
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  } else if (pathname === '/ws/syncplay') {
    syncplayWss.handleUpgrade(req, socket, head, (ws) => syncplayWss.emit('connection', ws, req));
  } else if (pathname === '/socket' || pathname === '/socket/') {
    jellyfinWss.handleUpgrade(req, socket, head, (ws) => jellyfinWss.emit('connection', ws, req));
  } else {
    socket.destroy();
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ [خطأ حرج]: المنفذ ${PORT} محجوز بالفعل!`);
    console.error(`⚠️ يبدو أن النسخة المثبتة من ARN Stream تعمل حالياً في الخلفية (صينية النظام)، أو هناك عملية سابقة تستخدم نفس المنفذ.`);
    console.error(`💡 الحلول المتاحة:`);
    console.error(`   1. أغلق ARN Stream من شريط المهام (System Tray) بجانب الساعة.`);
    console.error(`   2. أو استخدم سكريبت التشغيل run_dev.bat الذي يقوم بتحرير المنفذ تلقائياً.`);
    console.error(`   3. أو نفّذ الأمر التالي لإنهاء العملية الحاجزة للمنفذ:`);
    console.error(`      Stop-Process -Id (Get-NetTCPConnection -LocalPort ${PORT}).OwningProcess -Force\n`);
    process.exit(1);
  } else {
    console.error('[CRITICAL SERVER ERROR]:', err);
    process.exit(1);
  }
});

// Graceful shutdown handling for clean database and process closure
let isShuttingDown = false;
const gracefulShutdown = (signal) => {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[Shutdown] Received ${signal}. Closing server gracefully...`);

  // 1. Terminate any active FFmpeg processes
  if (global.activeStreams) {
    for (const [id, stream] of Object.entries(global.activeStreams)) {
      if (stream.process && typeof stream.process.kill === 'function') {
        try { stream.process.kill('SIGKILL'); } catch {}
      }
    }
    global.activeStreams = {};
  }

  // 2. Stop DLNA SSDP discovery socket and controller
  try { stopDlna(); } catch {}
  try { dlnaController.stopDiscovery(); } catch {}

  // 3. Close WebSocket server
  try { wss.close(); } catch {}

  // 4. Close SQLite DB cleanly (flushes WAL checkpoint)
  try {
    if (db && typeof db.close === 'function') {
      db.close();
      console.log('🔒 Database connection closed cleanly.');
    }
  } catch (e) {
    console.error('Error closing database:', e.message);
  }

  // 5. Close HTTP server
  server.close(() => {
    console.log('👋 ARN Stream server terminated cleanly.');
    process.exit(0);
  });

  // Force exit after 3s timeout if connections linger
  setTimeout(() => {
    process.exit(0);
  }, 3000).unref();
};

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));


