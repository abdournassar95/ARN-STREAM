import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import db, { getSetting } from '../db.js';
import { processAndCacheImage } from './image-cache.js';
import sessionManager from './session-manager.js';
import notificationManager from './notification-manager.js';
import { cleanMovieTitle } from '../scanner/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tmpUploadsDir = path.join(__dirname, '..', 'data', 'tmp_uploads');

if (!fs.existsSync(tmpUploadsDir)) {
  fs.mkdirSync(tmpUploadsDir, { recursive: true });
}

// مجموعة مفاتيح TMDB الاحتياطية المعتمدة
const TMDB_FALLBACK_KEYS = [
  '4e44d9029b1270a757cddc766a1bcb63',
  '3bb3e67969473d0d1607a3e6691bc650'
];

function getEffectiveTmdbKeys() {
  const customKey = (getSetting('tmdb_api_key', '') || process.env.TMDB_API_KEY || '').trim();
  const keys = [];
  if (customKey) keys.push(customKey);
  for (const k of TMDB_FALLBACK_KEYS) {
    if (!keys.includes(k)) keys.push(k);
  }
  return keys;
}

class MetadataAutoFetcher {
  constructor() {
    this.isRunning = false;
    this.isPaused = false;
    this.cancelRequested = false;
    this.total = 0;
    this.processed = 0;
    this.succeeded = 0;
    this.failed = 0;
    this.currentItem = null;
    this.startedAt = null;
  }

  getStatus() {
    return {
      isRunning: this.isRunning,
      isPaused: this.isPaused,
      total: this.total,
      processed: this.processed,
      succeeded: this.succeeded,
      failed: this.failed,
      percent: this.total > 0 ? Math.round((this.processed / this.total) * 100) : 0,
      currentItem: this.currentItem,
      startedAt: this.startedAt
    };
  }

  /**
   * إيقاف الجلب
   */
  /**
   * إيقاف العملية وإلغاء الاستمرار
   */
  stop() {
    this.cancelRequested = true;
    this.isRunning = false;
    this.isPaused = false;
    this.currentItem = null;
    sessionManager.broadcast('metadata_auto_fetch_completed', this.getStatus());
    return true;
  }

  /**
   * إيقاف مؤقت
   */
  pause() {
    if (!this.isRunning || this.isPaused) return false;
    this.isPaused = true;
    sessionManager.broadcast('metadata_auto_fetch_progress', this.getStatus());
    return true;
  }

  /**
   * استئناف
   */
  resume() {
    if (!this.isRunning || !this.isPaused) return false;
    this.isPaused = false;
    sessionManager.broadcast('metadata_auto_fetch_progress', this.getStatus());
    return true;
  }

  /**
   * بدء طابور الجلب الآلي للميتاداتا والبوسترات
   */
  async start(options = {}) {
    if (this.isRunning) {
      throw new Error('Auto fetcher is already running');
    }

    const {
      libraryId = null,
      type = 'all', // 'all' | 'movies' | 'series'
      onlyMissingPosters = true,
      onlyMissingPlot = false,
      forceAll = false
    } = options;

    const filterPosters = forceAll ? false : onlyMissingPosters;

    let targetType = type;
    let libraryName = 'كافة المكتبات';

    if (libraryId) {
      const lib = db.prepare('SELECT id, name, type FROM libraries WHERE id = ?').get(libraryId);
      if (lib) {
        libraryName = lib.name;
        if (lib.type === 'movies') targetType = 'movies';
        else if (lib.type === 'shows') targetType = 'series';
      }
    }

    const queue = [];

    // 1. جمع الأفلام
    if (targetType === 'all' || targetType === 'movies') {
      let moviesQuery = `
        SELECT m.id, m.title, m.year, m.plot, m.path, m.tmdb_id, 'movie' as media_type
        FROM movies m
        WHERE 1=1
      `;
      const params = [];

      if (libraryId) {
        moviesQuery += ` AND m.library_id = ?`;
        params.push(libraryId);
      }

      if (filterPosters) {
        moviesQuery += `
          AND m.id NOT IN (
            SELECT media_id FROM images WHERE media_type = 'movie' AND image_type = 'poster'
          )
        `;
      } else if (onlyMissingPlot) {
        moviesQuery += ` AND (m.plot IS NULL OR TRIM(m.plot) = '')`;
      }

      const movies = db.prepare(moviesQuery).all(...params);
      queue.push(...movies);
    }

    // 2. جمع المسلسلات
    if (targetType === 'all' || targetType === 'series') {
      let seriesQuery = `
        SELECT s.id, s.title, s.year, s.plot, s.tmdb_id, 'series' as media_type
        FROM series s
        WHERE 1=1
      `;
      const params = [];

      if (libraryId) {
        seriesQuery += ` AND s.library_id = ?`;
        params.push(libraryId);
      }

      if (filterPosters) {
        seriesQuery += `
          AND s.id NOT IN (
            SELECT media_id FROM images WHERE media_type = 'series' AND image_type = 'poster'
          )
        `;
      } else if (onlyMissingPlot) {
        seriesQuery += ` AND (s.plot IS NULL OR TRIM(s.plot) = '')`;
      }

      const seriesList = db.prepare(seriesQuery).all(...params);
      queue.push(...seriesList);
    }

    // إذا لم تكن هناك أعمال تنقصها ميتاداتا
    if (queue.length === 0) {
      this.isRunning = false;
      this.isPaused = false;
      this.cancelRequested = false;
      this.total = 0;
      this.processed = 0;
      this.succeeded = 0;
      this.failed = 0;
      this.currentItem = null;

      const emptyStatus = this.getStatus();
      sessionManager.broadcast('metadata_auto_fetch_completed', emptyStatus);

      const msg = libraryId 
        ? `كافة الأعمال في مكتبة "${libraryName}" تحتوي على بوسترات وبيانات مكتملة بالفعل.`
        : 'جميع الأعمال تحتوي على بوسترات وبيانات مكتملة بالفعل.';

      notificationManager.notify({
        title: 'جلب الميتاداتا الآلي',
        message: msg,
        type: 'info',
        category: 'metadata',
        link: '/database'
      });

      return {
        ...emptyStatus,
        alreadyComplete: true,
        message: msg
      };
    }

    // هناك أعمال: نبدأ العمل
    this.isRunning = true;
    this.isPaused = false;
    this.cancelRequested = false;
    this.processed = 0;
    this.succeeded = 0;
    this.failed = 0;
    this.total = queue.length;
    this.currentItem = null;
    this.startedAt = new Date().toISOString();

    const startMsg = libraryId
      ? `تم بدء فحص وجلب الميتاداتا لـ ${this.total} عملاً في "${libraryName}"...`
      : `تم بدء فحص وجلب الميتاداتا والبوسترات لـ ${this.total} عملاً...`;

    notificationManager.notify({
      title: 'بدء جلب الميتاداتا الآلي',
      message: startMsg,
      type: 'info',
      category: 'metadata',
      link: '/database'
    });

    // تشغيل حلقة المعالجة في الخلفية
    this.runQueue(queue).catch(err => {
      console.error('[MetadataAutoFetcher] runQueue error:', err.message);
    });

    return {
      ...this.getStatus(),
      message: startMsg
    };
  }

  /**
   * تشغيل طابور المعالجة في الخلفية
   */
  async runQueue(queue) {
    try {
      for (const item of queue) {
        if (this.cancelRequested) {
          console.log('[MetadataAutoFetcher] Execution cancelled by user.');
          break;
        }

        while (this.isPaused && !this.cancelRequested) {
          await new Promise(r => setTimeout(r, 500));
        }
        if (this.cancelRequested) break;

        this.currentItem = {
          id: item.id,
          title: item.title,
          type: item.media_type
        };

        sessionManager.broadcast('metadata_auto_fetch_progress', this.getStatus());

        const success = await this.processItem(item);
        if (success) {
          this.succeeded++;
        } else {
          this.failed++;
        }
        this.processed++;

        sessionManager.broadcast('metadata_auto_fetch_progress', this.getStatus());
        await new Promise(r => setTimeout(r, 300));
      }

      const finalStatus = this.getStatus();
      sessionManager.broadcast('metadata_auto_fetch_completed', finalStatus);

      notificationManager.notify({
        title: 'اكتمل جلب الميتاداتا الآلي',
        message: `تم تحديث ${this.succeeded} عملاً بنجاح (فشل ${this.failed}) من إجمالي ${this.total}.`,
        type: this.succeeded > 0 ? 'success' : 'warning',
        category: 'metadata',
        link: '/database'
      });
    } catch (err) {
      console.error('[MetadataAutoFetcher] Run error:', err.message);
    } finally {
      this.isRunning = false;
      this.isPaused = false;
      this.cancelRequested = false;
      this.currentItem = null;
      sessionManager.broadcast('metadata_auto_fetch_completed', this.getStatus());
    }
  }

  /**
   * معالجة عنصر مفرد: البحث وتنزيل البوستر وتحديث قاعدة البيانات
   */
  async processItem(item) {
    try {
      const isSeries = item.media_type === 'series';
      const cleanInfo = cleanMovieTitle(item.title);
      const query = cleanInfo.title || item.title;
      const year = cleanInfo.year || item.year;

      const metadata = await this.fetchMetadataOnline(query, year, isSeries);
      if (!metadata) return false;

      // 1. تحديث بيانات النص والتقييم
      if (isSeries) {
        db.prepare(`
          UPDATE series 
          SET title = COALESCE(?, title),
              plot = COALESCE(NULLIF(?, ''), plot),
              year = COALESCE(?, year),
              tmdb_id = COALESCE(?, tmdb_id)
          WHERE id = ?
        `).run(
          metadata.title || null,
          metadata.plot || null,
          metadata.year || null,
          metadata.tmdbId || null,
          item.id
        );
      } else {
        db.prepare(`
          UPDATE movies 
          SET title = COALESCE(?, title),
              plot = COALESCE(NULLIF(?, ''), plot),
              year = COALESCE(?, year),
              tmdb_id = COALESCE(?, tmdb_id)
          WHERE id = ?
        `).run(
          metadata.title || null,
          metadata.plot || null,
          metadata.year || null,
          metadata.tmdbId || null,
          item.id
        );
      }

      // 2. تنزيل وحفظ البوستر
      if (metadata.posterUrl) {
        const hasExistingPoster = db.prepare(`
          SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster'
        `).get(item.media_type, item.id);

        if (!hasExistingPoster) {
          await this.downloadAndApplyImage(metadata.posterUrl, item.media_type, item.id, 'poster');
        }
      }

      // 3. تنزيل وحفظ الخلفية Backdrop
      if (metadata.backdropUrl) {
        const hasExistingBackdrop = db.prepare(`
          SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'backdrop'
        `).get(item.media_type, item.id);

        if (!hasExistingBackdrop) {
          await this.downloadAndApplyImage(metadata.backdropUrl, item.media_type, item.id, 'backdrop');
        }
      }

      // 4. ربط التصنيفات Genres
      if (Array.isArray(metadata.genres) && metadata.genres.length > 0) {
        for (const genreName of metadata.genres) {
          if (!genreName || !genreName.trim()) continue;
          const cleanGenre = genreName.trim();
          try {
            db.prepare('INSERT OR IGNORE INTO tags (name) VALUES (?)').run(cleanGenre);
            const tag = db.prepare('SELECT id FROM tags WHERE name = ?').get(cleanGenre);
            if (tag) {
              db.prepare('INSERT OR IGNORE INTO media_tags (tag_id, media_type, media_id) VALUES (?, ?, ?)').run(
                tag.id,
                item.media_type,
                item.id
              );
            }
          } catch {}
        }
      }

      return true;
    } catch (err) {
      console.warn(`[MetadataAutoFetcher] Failed item ${item.title}:`, err.message);
      return false;
    }
  }

  /**
   * البحث عن البيانات عبر TMDB ثم Cinemeta/IMDb
   */
  async fetchMetadataOnline(query, year, isSeries) {
    const keys = getEffectiveTmdbKeys();
    const tmdbType = isSeries ? 'tv' : 'movie';

    for (const key of keys) {
      try {
        // 1. بحث TMDB بالعربية
        let url = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${key}&query=${encodeURIComponent(query)}&language=ar`;
        if (year) {
          url += isSeries ? `&first_air_date_year=${year}` : `&primary_release_year=${year}`;
        }

        const res = await fetch(url, { signal: AbortSignal.timeout(6000) });
        if (!res.ok) {
          if (res.status === 401 || res.status === 429) continue;
          break;
        }

        const data = await res.json();
        let match = data.results && data.results[0];

        // إذا لم يعثر مع السنة، نجرب بدون سنة
        if (!match && year) {
          const fallbackUrl = `https://api.themoviedb.org/3/search/${tmdbType}?api_key=${key}&query=${encodeURIComponent(query)}&language=ar`;
          const fbRes = await fetch(fallbackUrl, { signal: AbortSignal.timeout(6000) });
          if (fbRes.ok) {
            const fbData = await fbRes.json();
            match = fbData.results && fbData.results[0];
          }
        }

        if (match) {
          // جلب تفاصيل إضافية للحصول على التصنيفات الكاملة
          let details = null;
          try {
            const detUrl = `https://api.themoviedb.org/3/${tmdbType}/${match.id}?api_key=${key}&language=ar&append_to_response=images`;
            const detRes = await fetch(detUrl, { signal: AbortSignal.timeout(5000) });
            if (detRes.ok) {
              details = await detRes.json();
            }
          } catch {}

          const effective = details || match;
          let plot = effective.overview;

          // إذا كانت القصة العربية فارغة، نجلب الإنجليزية
          if (!plot || !plot.trim()) {
            try {
              const enUrl = `https://api.themoviedb.org/3/${tmdbType}/${match.id}?api_key=${key}&language=en-US`;
              const enRes = await fetch(enUrl, { signal: AbortSignal.timeout(4000) });
              if (enRes.ok) {
                const enData = await enRes.json();
                plot = enData.overview || null;
              }
            } catch {}
          }

          const rawYear = (effective.release_date || effective.first_air_date || '').split('-')[0];
          const itemYear = rawYear ? parseInt(rawYear, 10) : year || null;

          const posterPath = effective.poster_path;
          const backdropPath = effective.backdrop_path;

          const posterUrl = posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : null;
          const backdropUrl = backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : null;

          const genres = (effective.genres || []).map(g => g.name).filter(Boolean);

          return {
            tmdbId: match.id,
            title: effective.title || effective.name || query,
            plot: plot || null,
            year: itemYear,
            posterUrl,
            backdropUrl,
            rating: effective.vote_average ? Math.round(effective.vote_average * 10) / 10 : null,
            genres,
            source: 'tmdb'
          };
        }
      } catch (err) {
        console.warn(`[TMDB Key ${key}] Fetch error:`, err.message);
      }
    }

    return null;
  }

  /**
   * تنزيل الصورة ومعالجتها عبر image-cache وحفظها في قاعدة البيانات
   */
  async downloadAndApplyImage(imageUrl, mediaType, mediaId, imageType) {
    const tempFile = path.join(tmpUploadsDir, `autofetch-${mediaType}-${mediaId}-${imageType}-${crypto.randomBytes(4).toString('hex')}.jpg`);
    try {
      const res = await fetch(imageUrl, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) return false;

      const buffer = Buffer.from(await res.arrayBuffer());
      fs.writeFileSync(tempFile, buffer);

      // معالجة وضغط الصورة كـ WebP وتخزينها في قاعدة البيانات
      await processAndCacheImage(tempFile, mediaType, mediaId, imageType, 'tmdb_auto');
      return true;
    } catch (err) {
      console.warn(`[MetadataAutoFetcher] Image download failed for ${imageUrl}:`, err.message);
      return false;
    } finally {
      if (fs.existsSync(tempFile)) {
        try { fs.unlinkSync(tempFile); } catch {}
      }
    }
  }
}

export const metadataAutoFetcher = new MetadataAutoFetcher();
export default metadataAutoFetcher;
