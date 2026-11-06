import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { probeMedia, determineStreamStrategy, streamWithFFmpeg } from '../services/ffmpeg-manager.js';
import { getLocalSubtitles } from '../services/subtitles.js';
import { extractFrame, pruneThumbs } from '../services/thumbnails.js';
import { requireAdmin, requireAuth } from '../services/auth.js';

const router = express.Router();

// Require authentication for all video and audio streams
router.use(requireAuth);

/**
 * Direct file streaming with HTTP 206 Partial Content (Byte Ranges)
 */
async function streamFile(filePath, req, res) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'File not found' } });
  }

  let stat;
  try {
    stat = await fs.promises.stat(filePath);
  } catch {
    return res.status(500).json({ error: { code: 'STAT_ERROR', message: 'Cannot read file info' } });
  }

  const fileSize = stat.size;
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: 'Empty media file' } });
  }

  const ext = path.extname(filePath).toLowerCase();
  const mimeMap = {
    '.mp4': 'video/mp4', '.mkv': 'video/x-matroska', '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime', '.webm': 'video/webm', '.m4v': 'video/x-m4v',
    '.mp3': 'audio/mpeg', '.flac': 'audio/flac', '.wav': 'audio/wav',
    '.m4a': 'audio/mp4', '.ogg': 'audio/ogg', '.wma': 'audio/x-ms-wma', '.aac': 'audio/aac'
  };
  const contentType = mimeMap[ext] || 'application/octet-stream';
  const baseHeaders = {
    'Accept-Ranges': 'bytes',
    'Content-Type': contentType,
    'Cache-Control': 'private, no-cache',
    'X-Stream-Mode': 'direct'
  };

  // HEAD requests only need metadata.
  if (req.method === 'HEAD') {
    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    return res.end();
  }

  const rangeHeader = req.headers.range;

  // No Range header → full body (200).
  if (!rangeHeader) {
    const file = fs.createReadStream(filePath);
    const streamId = `${req.ip}-${path.basename(filePath)}`;

    let cleanedUp = false;
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      delete global.activeStreams?.[streamId];
      if (file && !file.destroyed) file.destroy();
    };

    file.on('error', (err) => {
      cleanup();
      console.error(`[Stream Error] ${filePath}:`, err.message);
      if (!res.headersSent) {
        res.status(500).json({ error: { code: 'STREAM_ERROR', message: 'Error reading file' } });
      } else {
        res.end();
      }
    });
    file.on('end', cleanup);
    file.on('close', cleanup);
    res.on('close', cleanup);
    res.on('finish', cleanup);
    res.on('error', cleanup);
    req.on('close', cleanup);

    global.activeStreams = global.activeStreams || {};
    global.activeStreams[streamId] = { id: streamId, type: 'direct', filePath, startedAt: new Date() };

    res.writeHead(200, { ...baseHeaders, 'Content-Length': fileSize });
    return file.pipe(res);
  }

  // ── Range request (RFC 7233, single range only) ──────────────────────────
  const match = /^bytes=(\d*)-(\d*)$/.exec(String(rangeHeader).trim());
  if (!match) {
    return res
      .status(416)
      .set({ 'Content-Range': `bytes */${fileSize}`, 'Accept-Ranges': 'bytes' })
      .end();
  }

  const hasStart = match[1] !== '';
  const hasEnd = match[2] !== '';
  let start;
  let end;

  if (!hasStart) {
    // Suffix range: bytes=-N (last N bytes)
    const suffixLength = Number.parseInt(match[2], 10);
    if (!Number.isFinite(suffixLength) || suffixLength <= 0) {
      return res.status(416).set({ 'Content-Range': `bytes */${fileSize}` }).end();
    }
    start = Math.max(0, fileSize - suffixLength);
    end = fileSize - 1;
  } else {
    start = Number.parseInt(match[1], 10);
    end = hasEnd ? Number.parseInt(match[2], 10) : fileSize - 1;

    if (!Number.isFinite(start) || start < 0 || start >= fileSize || !Number.isFinite(end) || end < start) {
      return res
        .status(416)
        .set({ 'Content-Range': `bytes */${fileSize}`, 'Accept-Ranges': 'bytes' })
        .end();
    }
    // Clamp out-of-bounds end instead of advertising a wrong Content-Length.
    end = Math.min(end, fileSize - 1);
  }

  const chunksize = end - start + 1;
  const file = fs.createReadStream(filePath, { start, end });
  const streamId = `${req.ip}-${path.basename(filePath)}`;

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    delete global.activeStreams?.[streamId];
    if (file && !file.destroyed) file.destroy();
  };

  file.on('error', (err) => {
    cleanup();
    console.error(`[Stream Error] ${filePath}:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_ERROR', message: 'Error reading file' } });
    } else {
      res.end();
    }
  });
  file.on('end', cleanup);
  file.on('close', cleanup);
  res.on('close', cleanup);
  res.on('finish', cleanup);
  res.on('error', cleanup);
  req.on('close', cleanup);

  global.activeStreams = global.activeStreams || {};
  global.activeStreams[streamId] = { id: streamId, type: 'direct', filePath, startedAt: new Date() };

  res.writeHead(206, {
    ...baseHeaders,
    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
    'Content-Length': chunksize
  });

  return file.pipe(res);
}

/**
 * Smart video streaming dispatcher: decides Direct Play vs Remux vs Transcode
 */
async function handleVideoStream(filePath, req, res) {
  try {
    await fs.promises.access(filePath, fs.constants.R_OK);
  } catch {
    return res.status(404).json({ error: { code: 'FILE_NOT_FOUND', message: `File not found: ${filePath}` } });
  }

  // Parse start seek offset (in seconds)
  const startTime = parseFloat(req.query.start || req.query.t || 0) || 0;
  const forcedMode = req.query.mode; // optional override: 'direct' | 'remux' | 'transcode'

  const probeData = await probeMedia(filePath);
  const baseStrategy = forcedMode
    ? { mode: forcedMode, reason: `Forced ${forcedMode} mode`, videoCodec: probeData.videoCodec, pixFmt: probeData.pixFmt, audioCodec: probeData.audioCodec }
    : determineStreamStrategy(filePath, probeData);
  const strategy = { ...baseStrategy, duration: probeData.duration };

  // If direct play is capable and client didn't seek via query parameter
  if (strategy.mode === 'direct' && startTime === 0) {
    return streamFile(filePath, req, res);
  }

  // If direct play mode was requested with a start parameter, handle via FFmpeg seek or direct
  if (strategy.mode === 'direct') {
    return streamFile(filePath, req, res);
  }

  // For Remux and Transcode modes, stream through FFmpeg on-the-fly
  return streamWithFFmpeg(filePath, strategy, startTime, req, res);
}

/**
 * Endpoint to get stream metadata and recommended playback mode
 * GET /api/stream/info/:type/:id
 */
router.get('/info/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    let filePath = null;

    if (type === 'movie') {
      const movie = db.prepare(`SELECT path FROM movies WHERE id=?`).get(id);
      if (movie?.path) {
        filePath = movie.path;
      } else {
        // Fallback: check episodes
        const ep = db.prepare(`SELECT path FROM episodes WHERE id=?`).get(id);
        if (ep?.path) filePath = ep.path;
      }
      if (!filePath) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    } else if (type === 'episode') {
      const ep = db.prepare(`SELECT path FROM episodes WHERE id=?`).get(id);
      if (ep?.path) {
        filePath = ep.path;
      } else {
        // Fallback: check movies
        const movie = db.prepare(`SELECT path FROM movies WHERE id=?`).get(id);
        if (movie?.path) filePath = movie.path;
      }
      if (!filePath) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Episode not found' } });
    } else {
      return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Invalid media type' } });
    }

    const probeData = await probeMedia(filePath);
    const strategy = determineStreamStrategy(filePath, probeData);
    const localSubs = getLocalSubtitles(filePath);
    const savedPlayback = req.user?.id
      ? db.prepare(`SELECT position, duration, updated_at FROM playback_state WHERE media_type = ? AND media_id = ? AND user_id = ?`).get(type, Number(id), req.user.id)
      : null;

    return res.json({
      success: true,
      data: {
        strategy,
        probe: probeData,
        savedPlayback: savedPlayback || null,
        audioTracks: probeData.audioTracks || [],
        subtitles: [
          ...(probeData.embeddedSubtitles || []).map((s, idx) => ({
            ...s,
            id: s.id || `embedded_${s.index}_${idx}`,
            streamIndex: s.index,
            mediaType: type,
            mediaId: id,
            format: 'vtt',
            isEmbedded: true
          })),
          ...localSubs.map((s, idx) => ({
            id: `local_${idx}`,
            language: s.language || 'ar',
            title: s.filename,
            path: s.path,
            format: s.format,
            isLocal: true
          }))
        ]
      }
    });
  } catch (err) {
    console.error('[Stream Info Error]:', err.message);
    return res.status(500).json({ error: { code: 'STREAM_INFO_FAILED', message: err.message } });
  }
});

/**
 * Thumbnail frame for hover preview: GET /api/stream/thumb/:type/:id?t=SECONDS
 * Extracts (and disk-caches) a single downscaled frame at the given time.
 */
let lastPruneAt = 0;
router.get('/thumb/:type/:id', async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type !== 'movie' && type !== 'episode') {
      return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Invalid media type' } });
    }

    let filePath = null;
    const table = type === 'movie' ? 'movies' : 'episodes';
    const row = db.prepare(`SELECT path FROM ${table} WHERE id = ?`).get(id);
    if (row?.path) filePath = row.path;
    if (!filePath) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media not found' } });

    const probeData = await probeMedia(filePath);
    const duration = probeData.duration || 0;
    const t = Math.max(0, parseFloat(req.query.t || '0') || 0);

    const thumbPath = await extractFrame(filePath, t, `${type}_${id}`);
    if (!thumbPath) return res.status(404).json({ error: { code: 'NO_THUMB', message: 'Could not generate thumbnail' } });

    // Throttle cache pruning to once every 10 minutes
    const now = Date.now();
    if (now - lastPruneAt > 10 * 60 * 1000) {
      lastPruneAt = now;
      setImmediate(() => pruneThumbs());
    }

    res.set({
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'private, max-age=86400',
      'X-Thumb-Duration': String(duration || '')
    });
    res.sendFile(thumbPath);
  } catch (err) {
    console.error('[Thumb Error]:', err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'THUMB_FAILED', message: 'Failed to generate thumbnail' } });
    }
  }
});

// Endpoint to terminate active ffmpeg tasks (Admin only)
router.post('/kill/:id', requireAdmin, (req, res) => {
  const { id } = req.params;
  global.activeStreams = global.activeStreams || {};
  if (global.activeStreams[id]) {
    if (global.activeStreams[id].process && typeof global.activeStreams[id].process.kill === 'function') {
      global.activeStreams[id].process.kill('SIGKILL');
    }
    delete global.activeStreams[id];
    return res.json({ success: true, message: 'Stream stopped' });
  }
  return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Stream not found' } });
});

router.get('/movie/:id', async (req, res) => {
  try {
    let filePath = null;
    const movie = db.prepare(`SELECT * FROM movies WHERE id=?`).get(req.params.id);
    if (movie?.path) {
      filePath = movie.path;
    } else {
      // Fallback: check if client requested an episode ID under movie endpoint
      const ep = db.prepare(`SELECT * FROM episodes WHERE id=?`).get(req.params.id);
      if (ep?.path) filePath = ep.path;
    }

    if (!filePath) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Movie not found' } });
    await handleVideoStream(filePath, req, res);
  } catch (err) {
    console.error(`[Movie Stream Error ${req.params.id}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_FAILED', message: 'Failed to stream movie' } });
    }
  }
});

router.get('/episode/:id', async (req, res) => {
  try {
    let filePath = null;
    const ep = db.prepare(`SELECT * FROM episodes WHERE id=?`).get(req.params.id);
    if (ep?.path) {
      filePath = ep.path;
    } else {
      // Fallback: check if client requested a movie ID under episode endpoint
      const movie = db.prepare(`SELECT * FROM movies WHERE id=?`).get(req.params.id);
      if (movie?.path) filePath = movie.path;
    }

    if (!filePath) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Episode not found' } });
    await handleVideoStream(filePath, req, res);
  } catch (err) {
    console.error(`[Episode Stream Error ${req.params.id}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_FAILED', message: 'Failed to stream episode' } });
    }
  }
});

router.get('/track/:id', async (req, res) => {
  try {
    const track = db.prepare(`SELECT * FROM tracks WHERE id=?`).get(req.params.id);
    if (!track) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Track not found' } });
    db.prepare(`UPDATE tracks SET play_count = play_count + 1, last_played_at = CURRENT_TIMESTAMP WHERE id=?`).run(track.id);
    await streamFile(track.path, req, res);
  } catch (err) {
    console.error(`[Track Stream Error ${req.params.id}]:`, err.message);
    if (!res.headersSent) {
      res.status(500).json({ error: { code: 'STREAM_FAILED', message: 'Failed to stream track' } });
    }
  }
});

export default router;
