import fs from 'fs';
import path from 'path';
import https from 'https';
import { getDataDir } from '../db.js';

const SUBTITLE_CACHE_DIR = path.join(getDataDir(), 'subtitles');
if (!fs.existsSync(SUBTITLE_CACHE_DIR)) fs.mkdirSync(SUBTITLE_CACHE_DIR, { recursive: true });

/**
 * Search for subtitles by movie/episode title and optional IMDB/TMDB ID
 * Uses the free OpenSubtitles API (no API key needed for basic search)
 */
export async function searchSubtitles(query, { language = 'ar', year = null, type = 'movie', season = null, episode = null } = {}) {
  // Build search URL
  const params = new URLSearchParams({ query, languages: language });
  if (year) params.set('year', year);
  if (type === 'episode' && season) params.set('season_number', season);
  if (type === 'episode' && episode) params.set('episode_number', episode);
  
  try {
    const url = `https://api.opensubtitles.com/api/v1/subtitles?${params}`;
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ARNStream v2.0.0'
      }
    });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.data || []).map(sub => ({
      id: sub.id,
      language: sub.attributes?.language,
      release: sub.attributes?.release,
      download_count: sub.attributes?.download_count,
      file_id: sub.attributes?.files?.[0]?.file_id,
      file_name: sub.attributes?.files?.[0]?.file_name
    })).slice(0, 10);
  } catch (err) {
    console.warn('[Subtitles] Search failed:', err.message);
    return [];
  }
}

/**
 * Get locally available subtitle files for a media item
 */
export function getLocalSubtitles(mediaFilePath) {
  if (!mediaFilePath) return [];
  const dir = path.dirname(mediaFilePath);
  const base = path.basename(mediaFilePath, path.extname(mediaFilePath));
  const subtitleExts = ['.srt', '.vtt', '.ass', '.ssa', '.sub'];
  const results = [];
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (subtitleExts.includes(ext) && file.toLowerCase().startsWith(base.toLowerCase())) {
        // Extract language tag if present (e.g. movie.ar.srt -> ar)
        const nameWithoutExt = path.basename(file, ext);
        const parts = nameWithoutExt.split('.');
        const langTag = parts.length > 1 ? parts[parts.length - 1] : null;
        results.push({
          filename: file,
          path: path.join(dir, file),
          language: langTag,
          format: ext.slice(1)
        });
      }
    }
  } catch {}
  return results;
}

/**
 * Serve a subtitle file, converting SRT to WebVTT if needed
 */
export function convertSrtToVtt(srtContent) {
  let vtt = 'WEBVTT\n\n';
  vtt += srtContent
    .replace(/\r\n/g, '\n')
    .replace(/^\d+\n/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}
