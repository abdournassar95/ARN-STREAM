import express from 'express';
import fs from 'fs';
import path from 'path';
import db, { getDataDir } from '../db.js';
import {
  searchSubtitles,
  getLocalSubtitles,
  convertSrtToVtt,
  convertAssToVtt,
  applySubtitleOffset,
  extractEmbeddedSubtitle
} from '../services/subtitles.js';
import { requireAuth } from '../services/auth.js';

const router = express.Router();

// Require authentication for subtitles
router.use(requireAuth);

// GET /api/subtitles/:type/:id - Get available subtitles for a media item
router.get('/:type/:id', (req, res) => {
  const { type, id } = req.params;
  let filePath = null;
  
  if (type === 'movie') {
    const movie = db.prepare('SELECT path, title, year FROM movies WHERE id = ?').get(id);
    if (movie) filePath = movie.path;
  } else if (type === 'episode') {
    const ep = db.prepare('SELECT path FROM episodes WHERE id = ?').get(id);
    if (ep) filePath = ep.path;
  }
  
  const localSubs = filePath ? getLocalSubtitles(filePath) : [];
  res.json({ data: localSubs });
});

// GET /api/subtitles/:type/:id/search - Search online subtitles
router.get('/:type/:id/search', async (req, res) => {
  const { type, id } = req.params;
  const { language = 'ar' } = req.query;
  
  let title = '', year = null, season = null, episode = null;
  
  if (type === 'movie') {
    const movie = db.prepare('SELECT title, year FROM movies WHERE id = ?').get(id);
    if (movie) { title = movie.title; year = movie.year; }
  } else if (type === 'episode') {
    const ep = db.prepare(`
      SELECT e.episode_number, e.title, s.season_number, sr.title as series_title, sr.year
      FROM episodes e
      JOIN seasons s ON s.id = e.season_id
      JOIN series sr ON sr.id = s.series_id
      WHERE e.id = ?
    `).get(id);
    if (ep) {
      title = ep.series_title;
      year = ep.year;
      season = ep.season_number;
      episode = ep.episode_number;
    }
  }
  
  if (!title) return res.json({ data: [] });
  
  const results = await searchSubtitles(title, { language, year, type, season, episode });
  res.json({ data: results });
});

// POST /api/subtitles/:type/:id/download - Download online subtitle and attach to media
router.post('/:type/:id/download', async (req, res) => {
  const { type, id } = req.params;
  const { file_id, language = 'ar', file_name } = req.body;

  if (!file_id) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'file_id is required' } });
  }

  try {
    // Request download link from OpenSubtitles API
    const dlResponse = await fetch('https://api.opensubtitles.com/api/v1/download', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ARNStream v2.0.3'
      },
      body: JSON.stringify({ file_id })
    });

    if (!dlResponse.ok) {
      return res.status(502).json({ error: { code: 'DOWNLOAD_FAILED', message: 'Failed to request download from subtitle provider' } });
    }

    const dlData = await dlResponse.json();
    const link = dlData.link;
    if (!link) {
      return res.status(502).json({ error: { code: 'NO_LINK', message: 'No download link returned' } });
    }

    // Download content
    const subFileRes = await fetch(link);
    if (!subFileRes.ok) {
      return res.status(502).json({ error: { code: 'FETCH_ERROR', message: 'Could not fetch subtitle file content' } });
    }
    const subText = await subFileRes.text();

    // Determine target save path
    let mediaDir = null;
    let baseName = `${type}_${id}`;
    if (type === 'movie') {
      const movie = db.prepare('SELECT path, title FROM movies WHERE id = ?').get(id);
      if (movie && movie.path) {
        mediaDir = path.dirname(movie.path);
        baseName = path.basename(movie.path, path.extname(movie.path));
      }
    } else if (type === 'episode') {
      const ep = db.prepare('SELECT path FROM episodes WHERE id = ?').get(id);
      if (ep && ep.path) {
        mediaDir = path.dirname(ep.path);
        baseName = path.basename(ep.path, path.extname(ep.path));
      }
    }

    const SUBTITLE_CACHE_DIR = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'data', 'subtitles');
    const targetDir = mediaDir || SUBTITLE_CACHE_DIR;
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const safeLang = language.replace(/[^a-zA-Z0-9_-]/g, '') || 'ar';
    const subExt = (file_name && path.extname(file_name).toLowerCase()) || '.srt';
    const targetPath = path.join(targetDir, `${baseName}.${safeLang}${subExt}`);

    fs.writeFileSync(targetPath, subText, 'utf-8');

    return res.json({
      success: true,
      data: {
        filename: path.basename(targetPath),
        path: targetPath,
        language: safeLang,
        format: subExt.replace('.', ''),
        isDownloaded: true
      }
    });
  } catch (err) {
    console.error('[Subtitles Download Error]:', err.message);
    return res.status(500).json({ error: { code: 'SERVER_ERROR', message: err.message } });
  }
});

// GET /api/subtitles/serve - Serve a subtitle as WebVTT (from embedded media stream or local file)
router.get('/serve', async (req, res) => {
  const { path: subPath, type, id, streamIndex } = req.query;
  const offsetSec = parseFloat(req.query.offset);
  const wantsOffset = !isNaN(offsetSec) && offsetSec !== 0;

  // 1. Embedded Subtitle Handling
  if (streamIndex !== undefined || (type && id && !subPath)) {
    let filePath = null;
    if (type === 'movie') {
      const movie = db.prepare('SELECT path FROM movies WHERE id = ?').get(id);
      if (movie) filePath = movie.path;
    } else if (type === 'episode') {
      const ep = db.prepare('SELECT path FROM episodes WHERE id = ?').get(id);
      if (ep) filePath = ep.path;
    }

    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Media file not found' } });
    }

    const sIndex = parseInt(streamIndex, 10);
    if (isNaN(sIndex)) {
      return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Valid streamIndex is required' } });
    }

    const SUBTITLE_CACHE_DIR = path.join(getDataDir(), 'subtitles');
    if (!fs.existsSync(SUBTITLE_CACHE_DIR)) fs.mkdirSync(SUBTITLE_CACHE_DIR, { recursive: true });
    const cacheFile = path.join(SUBTITLE_CACHE_DIR, `embedded_${type}_${id}_stream_${sIndex}.vtt`);

    let vttContent = null;
    let useCache = false;

    if (fs.existsSync(cacheFile)) {
      try {
        const cacheStat = fs.statSync(cacheFile);
        const mediaStat = fs.statSync(filePath);
        if (cacheStat.mtimeMs >= mediaStat.mtimeMs && cacheStat.size > 0) {
          vttContent = fs.readFileSync(cacheFile, 'utf-8');
          useCache = true;
        }
      } catch {}
    }

    if (!useCache) {
      try {
        vttContent = await extractEmbeddedSubtitle(filePath, sIndex, cacheFile);
      } catch (err) {
        console.error('[Subtitles Embedded Extraction Error]:', err.message);
        return res.status(500).json({ error: { code: 'EXTRACTION_FAILED', message: err.message } });
      }
    }

    if (!vttContent) {
      return res.status(404).json({ error: { code: 'EMPTY_SUBTITLE', message: 'Extracted subtitle is empty' } });
    }

    const finalVtt = wantsOffset ? applySubtitleOffset(vttContent, offsetSec) : vttContent;
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(finalVtt);
  }

  // 2. Local File Subtitle Handling
  if (!subPath) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Path or streamIndex is required' } });
  }

  // Strict extension whitelist to prevent arbitrary file read
  const ext = path.extname(subPath).toLowerCase();
  const allowedSubtitleExts = ['.vtt', '.srt', '.sub', '.ass', '.ssa'];
  if (!allowedSubtitleExts.includes(ext)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized file extension for subtitles' } });
  }

  const resolved = path.resolve(subPath);

  // Validate file existence and ensure it is not a directory
  try {
    const stat = fs.statSync(resolved);
    if (!stat.isFile()) {
      return res.status(400).json({ error: { code: 'NOT_A_FILE', message: 'Path must point to a file' } });
    }
  } catch {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Subtitle file not found' } });
  }

  try {
    const content = fs.readFileSync(resolved, 'utf-8');
    let vtt = null;

    if (ext === '.vtt') {
      vtt = wantsOffset ? applySubtitleOffset(content, offsetSec) : content;
    } else if (ext === '.srt') {
      const converted = convertSrtToVtt(content);
      vtt = wantsOffset ? applySubtitleOffset(converted, offsetSec) : converted;
    } else if (ext === '.ass' || ext === '.ssa') {
      const converted = convertAssToVtt(content);
      vtt = wantsOffset ? applySubtitleOffset(converted, offsetSec) : converted;
    } else {
      vtt = convertSrtToVtt(content);
    }

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res.send(vtt);
  } catch (err) {
    console.error('[Subtitles Serve Error]:', err.message);
    return res.status(500).json({ error: { code: 'READ_ERROR', message: 'Failed to read subtitle file' } });
  }
});

export default router;
