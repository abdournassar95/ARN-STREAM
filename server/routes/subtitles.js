import express from 'express';
import fs from 'fs';
import path from 'path';
import db from '../db.js';
import { searchSubtitles, getLocalSubtitles, convertSrtToVtt } from '../services/subtitles.js';
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

// GET /api/subtitles/serve - Serve a local subtitle file as WebVTT safely
router.get('/serve', (req, res) => {
  const { path: subPath } = req.query;
  if (!subPath) {
    return res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Path is required' } });
  }

  // 1. Strict extension whitelist to prevent arbitrary file read (e.g., config, db, system files)
  const ext = path.extname(subPath).toLowerCase();
  const allowedSubtitleExts = ['.vtt', '.srt', '.sub', '.ass', '.ssa'];
  if (!allowedSubtitleExts.includes(ext)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Unauthorized file extension for subtitles' } });
  }

  const resolved = path.resolve(subPath);

  // 2. Validate file existence and ensure it is not a directory
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
    
    if (ext === '.vtt') {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return res.send(content);
    }
    
    if (ext === '.srt') {
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      return res.send(convertSrtToVtt(content));
    }
    
    // For other valid subtitle formats, serve as text/plain
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(content);
  } catch (err) {
    console.error('[Subtitles Serve Error]:', err.message);
    res.status(500).json({ error: { code: 'READ_ERROR', message: 'Failed to read subtitle file' } });
  }
});

export default router;
