import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
// LRU cache للأعمال المتكررة مع دعم تلقائي للبديل المدمج في حال غياب مكتبة lru-cache
let LRUCacheClass;
try {
  const mod = await import('lru-cache');
  LRUCacheClass = mod.LRUCache || mod.default?.LRUCache || mod.default;
} catch {
  // بديل مدمج فائق السرعة وخالي من أي اعتماديات خارجية
  LRUCacheClass = class NativeLRUCache {
    constructor(options = {}) {
      this.max = options.max || 500;
      this.maxSize = options.maxSize || 100 * 1024 * 1024;
      this.ttl = options.ttl || 1000 * 60 * 30;
      this.cache = new Map();
      this.currentSize = 0;
    }
    get(key) {
      if (!this.cache.has(key)) return undefined;
      const entry = this.cache.get(key);
      if (Date.now() - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        this.currentSize -= entry.size || 0;
        return undefined;
      }
      this.cache.delete(key);
      this.cache.set(key, entry);
      return entry.value;
    }
    set(key, value) {
      const size = value?.size || 0;
      if (this.cache.has(key)) {
        const old = this.cache.get(key);
        this.currentSize -= old.size || 0;
        this.cache.delete(key);
      }
      while ((this.cache.size >= this.max || (this.maxSize && this.currentSize + size > this.maxSize)) && this.cache.size > 0) {
        const oldestKey = this.cache.keys().next().value;
        const oldEntry = this.cache.get(oldestKey);
        this.currentSize -= oldEntry?.size || 0;
        this.cache.delete(oldestKey);
      }
      this.cache.set(key, { value, size, timestamp: Date.now() });
      this.currentSize += size;
      return this;
    }
    clear() {
      this.cache.clear();
      this.currentSize = 0;
    }
    get size() {
      return this.cache.size;
    }
    get calculatedSize() {
      return this.currentSize;
    }
  };
}

const imageBufferCache = new LRUCacheClass({
  max: 500,                          // max 500 entries
  maxSize: 100 * 1024 * 1024,        // max 100 MB
  sizeCalculation: (value) => value.size || 0,
  ttl: 1000 * 60 * 30,               // 30 min
  allowStale: true,
  updateAgeOnGet: false
});
let sharp;
try {
  const mod = await import('sharp');
  sharp = mod.default;
} catch { sharp = null; }

import db from '../db.js';
import { hashFile } from '../scanner/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const cacheDir = path.join(appData, 'ARN_Stream', 'data', 'images_cache');
const coversCacheDir = path.join(appData, 'ARN_Stream', 'data', 'covers_cache');

for (const dir of [cacheDir, coversCacheDir]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

export async function processAndCacheImage(sourcePath, mediaType, mediaId, imageType, source = 'local_file') {
  if (!fs.existsSync(sourcePath)) return null;

  const stat = fs.statSync(sourcePath);
  const fileSize = stat.size;
  const hash = await hashFile(sourcePath);

  // Deduplicate by hash OR local_path per media
  const existing = db.prepare(`
    SELECT id, cached_path, thumbnail_path, hash FROM images 
    WHERE media_type = ? AND media_id = ? AND image_type = ?
      AND (
        (? IS NOT NULL AND hash = ?)
        OR (local_path IS NOT NULL AND LOWER(local_path) = LOWER(?))
      )
    ORDER BY is_primary DESC, id DESC LIMIT 1
  `).get(mediaType, mediaId, imageType, hash, hash, sourcePath);

  if (existing) {
    if (!existing.hash && hash) {
      db.prepare('UPDATE images SET hash = ? WHERE id = ?').run(hash, existing.id);
    }
    return existing;
  }

  // حفظ دائماً بصيغة webp للحصول على أفضل ضغط (-40-50% من JPEG)
  const ext = '.webp';
  const baseName = `${mediaType}-${mediaId}-${imageType}-${crypto.randomBytes(4).toString('hex')}`;
  const cachedFileName = `${baseName}${ext}`;
  const thumbFileName = `${baseName}_thumb${ext}`;

  const destDir = (mediaType === 'album' || mediaType === 'artist') ? coversCacheDir : cacheDir;
  const cachedPath = path.join(destDir, cachedFileName);
  const thumbPath = path.join(destDir, thumbFileName);

  try {
    if (sharp) {
      // Image type categories determine dimensions
      // ┌──────────────────┬───────────┬──────────┬─────────┐
      // │ Type             │ Aspect    │ Full (w) │ Thumb   │
      // ├──────────────────┼───────────┼──────────┼─────────┤
      // │ Movie poster     │ 2:3       │ 500      │ 300     │
      // │ Season poster    │ 2:3       │ 500      │ 300     │
      // │ Backdrop / Fanart│ 16:9      │ 1280     │ 400     │
      // │ Album cover      │ 1:1 ★     │ 500      │ 300     │
      // │ Artist photo     │ 1:1 ★     │ 500      │ 300     │
      // └──────────────────┴───────────┴──────────┴─────────┘
      const isPoster = imageType === 'poster' || imageType === 'season_poster';
      const isSquare = imageType === 'album_cover' || mediaType === 'artist';
      const isBackdrop = imageType === 'backdrop' || imageType === 'fanart' || imageType === 'background';

      let maxWidth, thumbWidth, fullHeight, thumbHeight;
      if (isSquare) {
        // ★ 1:1 square for albums and artists
        maxWidth = 500;
        thumbWidth = 300;
        fullHeight = maxWidth;
        thumbHeight = thumbWidth;
      } else if (isPoster) {
        // 2:3 portrait for movie/season posters
        maxWidth = 500;
        thumbWidth = 300;
        fullHeight = Math.round(maxWidth * 1.5);
        thumbHeight = Math.round(thumbWidth * 1.5);
      } else {
        // 16:9 landscape for backdrops
        maxWidth = 1280;
        thumbWidth = 400;
        fullHeight = Math.round(maxWidth * 0.5625);
        thumbHeight = Math.round(thumbWidth * 0.5625);
      }

      const metadata = await sharp(sourcePath).metadata();

      await sharp(sourcePath)
        .resize({
          width: maxWidth,
          height: fullHeight,
          fit: 'cover',
          position: 'attention'   // تلقائياً يختار الوجه / المنطقة المهمة
        })
        .webp({
          quality: 80,
          effort: 4,             // 0-6, 4 = توازن بين السرعة والحجم
          smartSubsample: true
        })
        .toFile(cachedPath);

      await sharp(sourcePath)
        .resize({
          width: thumbWidth,
          height: thumbHeight,
          fit: 'cover',
          position: 'attention'
        })
        .webp({ quality: 75 })
        .toFile(thumbPath);

      // Determine if primary
      const existingPrimary = db.prepare('SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1').get(mediaType, mediaId, imageType);
      const isPrimary = existingPrimary ? 0 : 1;

      const stmt = db.prepare(`
        INSERT INTO images (media_type, media_id, image_type, source, local_path, cached_path, thumbnail_path, is_primary, width, height, file_size, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(mediaType, mediaId, imageType, source, sourcePath, cachedPath, thumbPath, isPrimary, metadata.width, metadata.height, fileSize, hash);
      return { id: info.lastInsertRowid, cachedPath, thumbnailPath: thumbPath };
    } else {
      // Fallback without sharp: just copy
      fs.copyFileSync(sourcePath, cachedPath);
      fs.copyFileSync(sourcePath, thumbPath);
      const existingPrimary = db.prepare('SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1').get(mediaType, mediaId, imageType);
      const isPrimary = existingPrimary ? 0 : 1;
      const stmt = db.prepare(`
        INSERT INTO images (media_type, media_id, image_type, source, local_path, cached_path, thumbnail_path, is_primary, file_size, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(mediaType, mediaId, imageType, source, sourcePath, cachedPath, thumbPath, isPrimary, fileSize, hash);
      return { id: info.lastInsertRowid, cachedPath, thumbnailPath: thumbPath };
    }
  } catch (e) {
    console.warn('[image-cache] sharp failed, copying raw', e.message);
    try {
      fs.copyFileSync(sourcePath, cachedPath);
      fs.copyFileSync(sourcePath, thumbPath);
      const stmt = db.prepare(`
        INSERT INTO images (media_type, media_id, image_type, source, local_path, cached_path, thumbnail_path, is_primary, file_size, hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const existingPrimary = db.prepare('SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1').get(mediaType, mediaId, imageType);
      const isPrimary = existingPrimary ? 0 : 1;
      const info = stmt.run(mediaType, mediaId, imageType, source, sourcePath, cachedPath, thumbPath, isPrimary, fileSize, hash);
      return { id: info.lastInsertRowid, cachedPath, thumbnailPath: thumbPath };
    } catch (err) {
      console.error('[image-cache] failed copy', err.message);
      return null;
    }
  }
}

export function getImageRecord(id) {
  return db.prepare('SELECT * FROM images WHERE id = ?').get(id);
}

export function getPrimaryImage(mediaType, mediaId, imageType) {
  return db.prepare(`
    SELECT * FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1
    LIMIT 1
  `).get(mediaType, mediaId, imageType)
  || db.prepare(`
    SELECT * FROM images WHERE media_type = ? AND media_id = ? AND image_type = ?
    ORDER BY added_at DESC LIMIT 1
  `).get(mediaType, mediaId, imageType);
}

export function deleteImage(id) {
  const rec = getImageRecord(id);
  if (!rec) return false;
  try {
    if (rec.cached_path && fs.existsSync(rec.cached_path)) fs.unlinkSync(rec.cached_path);
    if (rec.thumbnail_path && fs.existsSync(rec.thumbnail_path)) fs.unlinkSync(rec.thumbnail_path);
  } catch {}
  db.prepare('DELETE FROM images WHERE id = ?').run(id);
  return true;
}

// For embedded album art fallback
export async function extractAndCacheEmbeddedArt(trackPath, albumId) {
  try {
    const { parseFile } = await import('music-metadata');
    const metadata = await parseFile(trackPath);
    const picture = metadata.common.picture?.[0];
    if (!picture) return null;
    // حفظ دائماً بصيغة webp للحصول على أفضل ضغط
    const baseName = `album-${albumId}-embedded-${crypto.randomBytes(4).toString('hex')}.webp`;
    const cachedPath = path.join(coversCacheDir, baseName);
    const thumbPath = path.join(coversCacheDir, baseName.replace('.webp', '_thumb.webp'));
    fs.writeFileSync(cachedPath, picture.data);

    if (sharp) {
      const tmp = cachedPath + '.tmp';
      // ★ 1:1 square for album covers (500x500 full, 300x300 thumb)
      await sharp(cachedPath)
        .resize({
          width: 500,
          height: 500,
          fit: 'cover',
          position: 'attention'
        })
        .webp({ quality: 80, effort: 4, smartSubsample: true })
        .toFile(tmp);
      fs.renameSync(tmp, cachedPath);
      await sharp(cachedPath)
        .resize({
          width: 300,
          height: 300,
          fit: 'cover',
          position: 'attention'
        })
        .webp({ quality: 75 })
        .toFile(thumbPath);
    } else {
      fs.copyFileSync(cachedPath, thumbPath);
    }

    const hash = crypto.createHash('md5').update(picture.data).digest('hex');
    const existing = db.prepare('SELECT id, cached_path, thumbnail_path FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND (hash = ? OR local_path = ?)').get('album', albumId, 'album_cover', hash, trackPath);
    if (existing) return existing;

    const existingPrimary = db.prepare('SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1').get('album', albumId, 'album_cover');
    const isPrimary = existingPrimary ? 0 : 1;
    const stmt = db.prepare(`
      INSERT INTO images (media_type, media_id, image_type, source, local_path, cached_path, thumbnail_path, is_primary, file_size, hash)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run('album', albumId, 'album_cover', 'embedded', trackPath, cachedPath, thumbPath, isPrimary, picture.data.length, hash);
    return { id: info.lastInsertRowid };
  } catch (e) {
    return null;
  }
}

/**
 * Helper: process image with LRU cache for repeat operations
 * Use when same source image is processed multiple times
 * Returns { buffer, size, timestamp } or null on failure
 */
export async function processImageCached(sourcePath, options = {}) {
  const cacheKey = `img:${sourcePath}:${JSON.stringify(options)}`;

  const cached = imageBufferCache.get(cacheKey);
  if (cached) {
    console.log(`[image-cache] LRU HIT for ${path.basename(sourcePath)}`);
    return cached;
  }

  if (!sharp || !fs.existsSync(sourcePath)) return null;

  try {
    const result = await sharp(sourcePath)
      .resize({
        width: options.width || 500,
        height: options.height,
        fit: options.fit || 'cover',
        position: 'attention'
      })
      .webp({
        quality: options.quality || 80,
        effort: 4
      })
      .toBuffer();

    const cacheEntry = {
      buffer: result,
      size: result.length,
      timestamp: Date.now()
    };

    imageBufferCache.set(cacheKey, cacheEntry);
    return cacheEntry;
  } catch (e) {
    console.warn('[image-cache] LRU processing failed:', e.message);
    return null;
  }
}

/**
 * Clear the LRU cache (useful when source files change)
 */
export function clearImageCache() {
  imageBufferCache.clear();
  console.log('[image-cache] LRU cache cleared');
}

/**
 * Get LRU cache stats for monitoring
 */
export function getImageCacheStats() {
  return {
    size: imageBufferCache.size,
    calculatedSize: imageBufferCache.calculatedSize,
    max: imageBufferCache.max,
    maxSize: imageBufferCache.maxSize
  };
}
