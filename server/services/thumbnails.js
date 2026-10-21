import fs from 'fs';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { ffmpegPath } from './ffmpeg-manager.js';
import { getDataDir } from '../db.js';

const execFileAsync = promisify(execFile);

const THUMB_DIR = path.join(getDataDir(), 'thumbs');
if (!fs.existsSync(THUMB_DIR)) fs.mkdirSync(THUMB_DIR, { recursive: true });

// Quantize time to a bucket so hovering nearby positions reuses the same thumbnail
const BUCKET_SECONDS = 10;

export function getThumbBucket(t) {
  return Math.max(0, Math.floor(Number(t) / BUCKET_SECONDS) * BUCKET_SECONDS);
}

// Simple in-flight dedupe: many rapid hover events map to the same bucket
const inFlight = new Map();

/**
 * Extracts a single frame from a known media file path at the given time (seconds),
 * scaled down and cached on disk by (mediaKey, time-bucket). Returns the cached
 * JPEG path, or null if extraction failed.
 */
export async function extractFrame(filePath, t, mediaKey) {
  const bucket = getThumbBucket(t);
  const safeKey = String(mediaKey).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cacheFile = path.join(THUMB_DIR, `${safeKey}_${bucket}.jpg`);

  if (fs.existsSync(cacheFile)) return cacheFile;

  const dedupeKey = `${safeKey}_${bucket}`;
  if (inFlight.has(dedupeKey)) return inFlight.get(dedupeKey);

  const promise = (async () => {
    const seek = Math.max(0, bucket);
    const tmpFile = `${cacheFile}.tmp.jpg`;
    try {
      await execFileAsync(ffmpegPath, [
        '-hide_banner',
        '-ss', String(seek),
        '-i', filePath,
        '-frames:v', '1',
        '-vf', 'scale=160:-2',
        '-q:v', '6',
        '-y', tmpFile
      ], { timeout: 8000 });
    } catch {
      return null;
    }

    try {
      if (!fs.existsSync(tmpFile) || fs.statSync(tmpFile).size === 0) {
        try { fs.unlinkSync(tmpFile); } catch {}
        return null;
      }
      fs.renameSync(tmpFile, cacheFile);
      return cacheFile;
    } catch {
      return null;
    }
  })().finally(() => inFlight.delete(dedupeKey));

  inFlight.set(dedupeKey, promise);
  return promise;
}

/**
 * Bounds the total number of cached thumbnails so the cache dir never grows unbounded.
 * Keeps the most recently used files (by mtime).
 */
export function pruneThumbs(maxFiles = 800) {
  try {
    const files = fs.readdirSync(THUMB_DIR)
      .filter(f => f.endsWith('.jpg'))
      .map(f => {
        const full = path.join(THUMB_DIR, f);
        return { full, mtime: fs.statSync(full).mtimeMs };
      })
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length <= maxFiles) return;
    for (const f of files.slice(maxFiles)) {
      try { fs.unlinkSync(f.full); } catch {}
    }
  } catch {}
}
