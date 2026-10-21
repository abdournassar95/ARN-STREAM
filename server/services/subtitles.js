import fs from 'fs';
import path from 'path';
import https from 'https';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { getDataDir } from '../db.js';
import { ffmpegPath } from './ffmpeg-manager.js';

const execFileAsync = promisify(execFile);

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
        'User-Agent': 'ARNStream v2.0.3'
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
 * Serve a subtitle file, converting SRT to WebVTT cleanly
 */
export function convertSrtToVtt(srtContent) {
  if (!srtContent) return 'WEBVTT\n\n';
  const cleanContent = srtContent.replace(/^\uFEFF/, '').trim();
  let vtt = 'WEBVTT\n\n';
  vtt += cleanContent
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/^\d+\s*\n(?=\d{2}:\d{2})/gm, '')
    .replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return vtt;
}

/**
 * Convert ASS/SSA subtitle content to WebVTT
 */
export function convertAssToVtt(assContent) {
  if (!assContent) return 'WEBVTT\n\n';
  const content = assContent.replace(/^\uFEFF/, '').trim();
  let vtt = 'WEBVTT\n\n';
  const lines = content.split(/\r?\n/);

  for (const line of lines) {
    if (!line.startsWith('Dialogue:')) continue;
    // Format: Dialogue: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
    const parts = line.slice(9).split(',');
    if (parts.length < 10) continue;
    const start = parts[1].trim();
    const end = parts[2].trim();
    const rawText = parts.slice(9).join(',');
    const text = rawText
      .replace(/\{[^\}]*\}/g, '') // remove ASS styling tags like {\b1}, {\pos(...)}
      .replace(/\\N/gi, '\n')
      .replace(/\\n/g, '\n')
      .replace(/\\h/g, ' ')
      .trim();

    if (!text) continue;

    const toVttTime = (t) => {
      const m = t.match(/(\d+):(\d{2}):(\d{2})[.:](\d{2,3})/);
      if (!m) return t;
      const h = m[1].padStart(2, '0');
      const ms = m[4].padEnd(3, '0').slice(0, 3);
      return `${h}:${m[2]}:${m[3]}.${ms}`;
    };

    vtt += `${toVttTime(start)} --> ${toVttTime(end)}\n${text}\n\n`;
  }

  return vtt;
}

/**
 * Extract an embedded subtitle stream from a video file into a WebVTT file using ffmpeg
 */
export async function extractEmbeddedSubtitle(filePath, streamIndex, outVttPath) {
  if (!fs.existsSync(filePath)) {
    throw new Error('Media file not found');
  }

  const outDir = path.dirname(outVttPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  // Run FFmpeg to extract the specific stream to WebVTT
  await execFileAsync(ffmpegPath, [
    '-y',
    '-i', filePath,
    '-map', `0:${streamIndex}`,
    '-f', 'webvtt',
    outVttPath
  ], { timeout: 35000 });

  if (!fs.existsSync(outVttPath)) {
    throw new Error('FFmpeg finished but subtitle file was not generated');
  }

  return fs.readFileSync(outVttPath, 'utf-8');
}

/**
 * Shift every WebVTT timestamp by a given number of seconds (subtitle delay / offset).
 * Positive values push subtitles later, negative values pull them earlier.
 */
export function applySubtitleOffset(vttContent, offsetSeconds) {
  const offsetMs = Math.round(Number(offsetSeconds) * 1000);
  if (!offsetMs || isNaN(offsetMs)) return vttContent;

  return vttContent.replace(/(\d{2}):(\d{2}):(\d{2})[.,](\d{3})/g, (match, hh, mm, ss, mmm) => {
    let total = ((Number(hh) * 3600) + (Number(mm) * 60) + Number(ss)) * 1000 + Number(mmm) + offsetMs;
    if (total < 0) total = 0;
    const h = Math.floor(total / 3600000);
    total -= h * 3600000;
    const m = Math.floor(total / 60000);
    total -= m * 60000;
    const s = Math.floor(total / 1000);
    const ms = total - s * 1000;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
  });
}
