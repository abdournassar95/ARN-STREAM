import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

export const VIDEO_EXTS = ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v'];
export const AUDIO_EXTS = ['.mp3', '.flac', '.wav', '.m4a', '.ogg', '.wma', '.aac'];
export const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

export const POSTER_NAMES = ['poster.jpg', 'poster.jpeg', 'poster.png', 'poster.webp', 'folder.jpg', 'folder.jpeg', 'cover.jpg', 'cover.jpeg', 'album.jpg', 'front.jpg'];
export const BACKDROP_NAMES = ['backdrop.jpg', 'backdrop.jpeg', 'backdrop.png', 'fanart.jpg', 'background.jpg', 'background.jpeg'];
export const COVER_NAMES = ['cover.jpg', 'cover.jpeg', 'folder.jpg', 'folder.jpeg', 'album.jpg', 'front.jpg', 'cover.png'];

export function isVideoFile(file) { return VIDEO_EXTS.includes(path.extname(file).toLowerCase()); }
export function isAudioFile(file) { return AUDIO_EXTS.includes(path.extname(file).toLowerCase()); }
export function isImageFile(file) { return IMAGE_EXTS.includes(path.extname(file).toLowerCase()); }

export function parseNfoFile(nfoPath) {
  try {
    if (!fs.existsSync(nfoPath)) return null;
    const text = fs.readFileSync(nfoPath, 'utf8');
    const titleMatch = text.match(/<title>(.*?)<\/title>/i) || text.match(/<originaltitle>(.*?)<\/originaltitle>/i);
    const plotMatch = text.match(/<plot>([\s\S]*?)<\/plot>/i) || text.match(/<outline>([\s\S]*?)<\/outline>/i);
    const yearMatch = text.match(/<year>(\d{4})<\/year>/i) || text.match(/<premiered>(\d{4})/i);
    const ratingMatch = text.match(/<rating>([\d.]+)<\/rating>/i);
    const genreMatch = text.match(/<genre>(.*?)<\/genre>/ig);
    let genres = [];
    if (genreMatch) {
      genres = genreMatch.map(g => g.replace(/<\/?genre>/ig, '').trim()).filter(Boolean);
    }
    return {
      title: titleMatch ? titleMatch[1].trim() : null,
      plot: plotMatch ? plotMatch[1].trim() : null,
      year: yearMatch ? parseInt(yearMatch[1]) : null,
      rating: ratingMatch ? parseFloat(ratingMatch[1]) : null,
      genres
    };
  } catch {
    return null;
  }
}

export function cleanMovieTitle(rawName) {
  let name = path.basename(rawName, path.extname(rawName));
  let year = null;
  const yearMatch = name.match(/[\(\. \[](\d{4})[\)\. \]]/);
  if (yearMatch) {
    year = parseInt(yearMatch[1]);
  }
  name = name.replace(/\b(1080p|720p|480p|2160p|4k|uhd|web[-._]?dl|bluray|bdrip|hdrip|dvdrip|hdtv|x264|x265|hevc|aac|dts|ac3)\b/gi, '');
  name = name.replace(/\b(movizland|akoam|myegy|cima|egybest|arabseed)\b/gi, '');
  name = name.replace(/\.com|\.net|\.org/gi, '');
  if (yearMatch) {
    name = name.replace(yearMatch[0], '');
  }
  name = name.replace(/[._]/g, ' ').replace(/\s+/g, ' ').trim();
  return { title: name || rawName, year };
}

export function parseMovieFolder(folderName) {
  const match = folderName.match(/^(.*?)\s*\((\d{4})\)\s*$/);
  if (match) return { title: match[1].trim(), year: parseInt(match[2]) };
  return cleanMovieTitle(folderName);
}

const ARABIC_INDIC_DIGITS = {
  '٠': '0', '١': '1', '٢': '2', '٣': '3', '٤': '4',
  '٥': '5', '٦': '6', '٧': '7', '٨': '8', '٩': '9'
};

export function normalizeDigits(str) {
  if (!str) return '';
  return str.replace(/[٠-٩]/g, d => ARABIC_INDIC_DIGITS[d] || d);
}

const ARABIC_ORDINALS = {
  'الاول': 1, 'الاولى': 1, 'اول': 1, 'اولى': 1,
  'الثاني': 2, 'التاني': 2, 'الثانية': 2, 'التانية': 2, 'ثاني': 2, 'تاني': 2, 'ثانية': 2, 'تانية': 2,
  'الثالث': 3, 'التالت': 3, 'الثالثة': 3, 'التالتة': 3, 'ثالث': 3, 'تالت': 3,
  'الرابع': 4, 'الرابعة': 4, 'رابع': 4, 'رابعة': 4,
  'الخامس': 5, 'الخامسة': 5, 'خامس': 5, 'خامسة': 5,
  'السادس': 6, 'السادسة': 6, 'سادس': 6, 'سادسة': 6,
  'السابع': 7, 'السابعة': 7, 'سابع': 7, 'سابعة': 7,
  'الثامن': 8, 'الثامنة': 8, 'ثامن': 8, 'ثامنة': 8,
  'التاسع': 9, 'التاسعة': 9, 'تاسع': 9, 'تاسعة': 9,
  'العاشر': 10, 'العاشرة': 10, 'عاشر': 10, 'عاشرة': 10,
  'الحادي عشر': 11, 'الحادية عشرة': 11, 'حادي عشر': 11,
  'الثاني عشر': 12, 'الثانية عشرة': 12, 'ثاني عشر': 12,
  'الثالث عشر': 13, 'الثالثة عشرة': 13, 'ثالث عشر': 13,
  'الرابع عشر': 14, 'الرابعة عشرة': 14, 'رابع عشر': 14,
  'الخامس عشر': 15, 'الخامسة عشرة': 15, 'خامس عشر': 15,
  'السادس عشر': 16, 'السادسة عشرة': 16,
  'السابع عشر': 17, 'السابعة عشرة': 17,
  'الثامن عشر': 18, 'الثامنة عشرة': 18,
  'التاسع عشر': 19, 'التاسعة عشرة': 19,
  'العشرون': 20, 'العشرين': 20
};

export function parseEpisodeFilename(filename) {
  const rawBase = path.basename(filename, path.extname(filename));

  // 1. Strip resolution tags like (480P), [720p], 1080p, 4k, etc.
  const clean = rawBase
    .replace(/\s*[\(\[]\s*\d{3,4}p[^\)\]]*[\)\]]/gi, '')
    .replace(/\b\d{3,4}p\b/gi, '')
    .replace(/\b\d{3,4}x\d{3,4}\b/gi, '')
    .replace(/\s*[\(\[]\s*(?:19|20)\d{2}\s*[\)\]]/gi, '')
    .replace(/\b(?:x264|x265|h264|h265|hevc|web-dl|webrip|bluray|brrip|dvdrip|10bit|8bit|aac|ac3|mp3)\b/gi, '')
    .replace(/\s*@\S+/g, '')
    .replace(/_(?:Low|High|HD|FHD)\b/gi, '')
    .trim();

  // 2. S01E01, s01e02
  const sxe = clean.match(/(?:^|[\s_.-])S(\d{1,2})[\s_.-]*E(\d{1,3})(?:[\s_.-]|$)/i);
  if (sxe) return { season: parseInt(sxe[1], 10), episode: parseInt(sxe[2], 10), isExplicit: true };

  // 3. 1x05 format
  const xFormat = clean.match(/(?:^|[\s_.-])(\d{1,2})x(\d{1,3})(?:[\s_.-]|$)/i);
  if (xFormat) return { season: parseInt(xFormat[1], 10), episode: parseInt(xFormat[2], 10), isExplicit: true };

  // 4. Arabic season & episode format: "الموسم 2 الحلقة 5", "موسم 2 حلقة 5", "م2 ح5", "جزء 2 حلقة 5"
  const arSeasonEp = clean.match(/(?:^|[\s_.-])(?:الموسم|موسم|الجزء|جزء|S)[\s_.:-]*(\d{1,2})[\s_.:-]*(?:الحلقة|حلقة|حـ|ح|Episode|Ep|E)[\s_.:-]*(\d{1,3})(?:[\s_.-]|$)/i);
  if (arSeasonEp) {
    return { season: parseInt(arSeasonEp[1], 10), episode: parseInt(arSeasonEp[2], 10), isExplicit: true };
  }

  // 5. Ep 01, Episode 01, حلقة 01, الحلقة 01, حـ 01
  const epMatch = clean.match(/(?:^|[\s_.-])(?:ep|episode|حلقة|الحلقة|حـ|ح)[\s_.:-]*(\d{1,3})(?:[\s_.-]|$)/i);
  if (epMatch) return { season: null, episode: parseInt(epMatch[1], 10), isExplicit: true };

  // 6. Pure number like "1", "01", "12"
  const pureNum = clean.match(/^(\d{1,3})$/);
  if (pureNum) return { season: null, episode: parseInt(pureNum[1], 10), isExplicit: true };

  // 7. Leading number followed by separator like "01 - Title", "01. Title", "01_Title"
  const leadingNum = clean.match(/^(\d{1,3})\s*[-._]\s*(.+)$/);
  if (leadingNum) {
    return { season: null, episode: parseInt(leadingNum[1], 10), isExplicit: true };
  }

  // 8. Trailing number preceded by separator like "Series - 01", "Series_01"
  const trailingNum = clean.match(/^(.*?)\s*[-._]\s*(\d{1,3})$/);
  if (trailingNum) {
    return { season: null, episode: parseInt(trailingNum[2], 10), isExplicit: true };
  }

  // Not explicitly numbered (e.g. documentary or named episode)
  return { season: null, episode: null, isExplicit: false };
}

export function parseSeasonInfo(folderName) {
  if (!folderName || typeof folderName !== 'string') return null;
  const raw = folderName.trim();
  const normalized = normalizeDigits(raw)
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/[ـ\u064B-\u065F\u0670]/g, '')
    .trim();

  // 1. Explicit Arabic Ordinal words: "الموسم الاول", "الموسم الثاني", "الجزء الثالث", etc.
  for (const [word, num] of Object.entries(ARABIC_ORDINALS)) {
    const ordRegex = new RegExp(`(?:^|[\\s_.-])(?:الموسم|موسم|الجزء|جزء|فصل|Season)[\\s_.:-]*${word}(?:[\\s_.:-](.*))?$`, 'i');
    const m = normalized.match(ordRegex);
    if (m) {
      const extraTitle = m[1]?.trim() || null;
      return { seasonNumber: num, title: extraTitle || raw };
    }
  }

  // 2. Standard keywords with digits: "Season 1", "الموسم 01", "الموسم-2", "موسم_3", "الجزء 1", "Part 2", "Vol 1"
  const kwRegex = /(?:^|[\s_.-])(?:Season|الموسم|موسم|الجزء|جزء|Part|Vol|Volume|فصل|Series)[\s_.:-]*(\d{1,2})(?:[\s_.:-](.*))?$/i;
  const kwMatch = normalized.match(kwRegex);
  if (kwMatch) {
    const sNum = parseInt(kwMatch[1], 10);
    const extraTitle = kwMatch[2]?.trim() || null;
    return { seasonNumber: sNum, title: extraTitle || null };
  }

  // 3. S01, S1 format: "^S(\d{1,2})(?:[\s_.:-](.*))?$"
  const sRegex = /^S(\d{1,2})(?:[\s_.:-](.*))?$/i;
  const sMatch = normalized.match(sRegex);
  if (sMatch) {
    const sNum = parseInt(sMatch[1], 10);
    const extraTitle = sMatch[2]?.trim() || null;
    return { seasonNumber: sNum, title: extraTitle || null };
  }

  // 4. Pure number: "1", "01", "2", "02"
  const pure = normalized.match(/^(\d{1,2})$/);
  if (pure) {
    return { seasonNumber: parseInt(pure[1], 10), title: null };
  }

  return null;
}

export function parseSeasonFolder(folderName) {
  const info = parseSeasonInfo(folderName);
  return info ? info.seasonNumber : null;
}

export function parseTrackFilename(filename) {
  const base = path.basename(filename, path.extname(filename));
  const match = base.match(/^(\d{1,3})\s*[-.]\s*(.*)$/);
  if (match) return { trackNumber: parseInt(match[1]), title: match[2].trim() };
  return { trackNumber: null, title: base.trim() };
}

export function hashFileSync(filePath) {
  try {
    const data = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(data).digest('hex');
  } catch { return null; }
}

export async function hashFile(filePath) {
  return new Promise((resolve) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(filePath);
    stream.on('data', d => hash.update(d));
    stream.on('end', () => {
      stream.destroy();
      resolve(hash.digest('hex'));
    });
    stream.on('error', () => {
      stream.destroy();
      resolve(null);
    });
  });
}

export function safeStat(filePath) {
  try { return fs.statSync(filePath); } catch { return null; }
}

export function walkSync(dir, callback, depth = 0, maxDepth = 10) {
  if (depth > maxDepth) return;
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      callback(full, entry.name, 'dir', depth);
      walkSync(full, callback, depth + 1, maxDepth);
    } else {
      callback(full, entry.name, 'file', depth);
    }
  }
}

import { ffprobePath } from '../services/ffmpeg-manager.js';

let ffprobeCache = new Map();
let isFfprobeAvailable = null;

// ffprobe wrapper with concurrency limiter
import { execFile } from 'child_process';
import { promisify } from 'util';
const execFileAsync = promisify(execFile);

let activeProbes = 0;
const queue = [];

async function probeWithLimit(filePath) {
  if (ffprobeCache.has(filePath)) return ffprobeCache.get(filePath);
  if (isFfprobeAvailable === false) {
    const emptyResult = { duration: null, resolution: null, width: null, height: null, video_codec: null, audio_codec: null };
    ffprobeCache.set(filePath, emptyResult);
    return emptyResult;
  }
  return new Promise((resolve) => {
    queue.push({ filePath, resolve });
    processQueue();
  });
}

async function processQueue() {
  if (activeProbes >= 4 || queue.length === 0) return;
  const { filePath, resolve } = queue.shift();
  activeProbes++;
  try {
    if (isFfprobeAvailable === false) {
      const result = { duration: null, resolution: null, width: null, height: null, video_codec: null, audio_codec: null };
      ffprobeCache.set(filePath, result);
      resolve(result);
      return;
    }

    let result = null;
    try {
      const { stdout } = await execFileAsync(ffprobePath, [
        '-v', 'quiet',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath
      ], { timeout: 2000, killSignal: 'SIGKILL' });
      isFfprobeAvailable = true;
      const data = JSON.parse(stdout);
      const videoStream = data.streams?.find(s => s.codec_type === 'video');
      const audioStream = data.streams?.find(s => s.codec_type === 'audio');
      let duration = data.format?.duration ? Math.round(parseFloat(data.format.duration)) : null;
      if (!duration && videoStream?.duration) {
        duration = Math.round(parseFloat(videoStream.duration));
      }
      if (!duration && audioStream?.duration) {
        duration = Math.round(parseFloat(audioStream.duration));
      }
      if (!duration && videoStream?.tags?.DURATION) {
        const parts = videoStream.tags.DURATION.split(':');
        if (parts.length === 3) {
          duration = Math.round(parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]));
        }
      }

      result = {
        duration,
        resolution: videoStream ? `${videoStream.width}x${videoStream.height}` : null,
        width: videoStream?.width || null,
        height: videoStream?.height || null,
        video_codec: videoStream?.codec_name || null,
        audio_codec: audioStream?.codec_name || null,
      };
    } catch (err) {
      if (err.code === 'ENOENT' || err.message?.includes('not found') || err.message?.includes('cannot find')) {
        isFfprobeAvailable = false;
      }
      result = { duration: null, resolution: null, width: null, height: null, video_codec: null, audio_codec: null };
    }
    ffprobeCache.set(filePath, result);
    resolve(result);
  } finally {
    activeProbes--;
    processQueue();
  }
}

export { probeWithLimit as probeMedia };

export function normalizePath(p) {
  return path.normalize(p);
}
