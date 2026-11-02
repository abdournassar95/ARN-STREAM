import fs from 'fs';
import path from 'path';
import db, {
  getAllLibraries,
  getSetting,
  cleanupEmptySeasons,
  cleanupEmptySeries,
  cleanupEmptyAlbums,
  cleanupEmptyArtists
} from '../db.js';
import sessionManager from './session-manager.js';
import notificationManager from './notification-manager.js';

let cachedHealthReport = null;
let lastCheckTimestamp = null;
let isHealthCheckRunning = false;

/**
 * فحص سلامة كافة مسارات الوسائط في قاعدة البيانات
 * يتحقق من وجود الملف فيزيائياً على القرص الصلب
 */
export async function checkLibraryIntegrity(options = {}) {
  if (isHealthCheckRunning) {
    return cachedHealthReport || { status: 'busy', message: 'Health check already in progress' };
  }

  const { libraryId = null } = options;
  isHealthCheckRunning = true;
  const startTime = Date.now();

  try {
    const missing = {
      movies: [],
      episodes: [],
      tracks: []
    };

    let targetLib = null;
    if (libraryId) {
      targetLib = db.prepare('SELECT id, name, type FROM libraries WHERE id = ?').get(libraryId);
    }

    let movies = [];
    let episodes = [];
    let tracks = [];

    if (!targetLib) {
      // 1. استرجاع كافة الأفلام
      movies = db.prepare('SELECT id, title, year, path, library_id FROM movies').all();
      // 2. استرجاع كافة الحلقات
      episodes = db.prepare(`
        SELECT episodes.id, episodes.title, episodes.path, episodes.season_id, series.title as seriesTitle
        FROM episodes
        LEFT JOIN seasons ON seasons.id = episodes.season_id
        LEFT JOIN series ON series.id = seasons.series_id
      `).all();
      // 3. استرجاع كافة التراكات الصوتية
      tracks = db.prepare(`
        SELECT tracks.id, tracks.title, tracks.path, albums.title as albumTitle, artists.name as artistName
        FROM tracks
        LEFT JOIN albums ON albums.id = tracks.album_id
        LEFT JOIN artists ON artists.id = albums.artist_id
      `).all();
    } else {
      // تصفية حسب نوع المكتبة المحددة
      if (targetLib.type === 'movies') {
        movies = db.prepare('SELECT id, title, year, path, library_id FROM movies WHERE library_id = ?').all(libraryId);
      } else if (targetLib.type === 'shows') {
        episodes = db.prepare(`
          SELECT episodes.id, episodes.title, episodes.path, episodes.season_id, series.title as seriesTitle
          FROM episodes
          JOIN seasons ON seasons.id = episodes.season_id
          JOIN series ON series.id = seasons.series_id
          WHERE series.library_id = ?
        `).all(libraryId);
      } else if (targetLib.type === 'music') {
        tracks = db.prepare(`
          SELECT tracks.id, tracks.title, tracks.path, albums.title as albumTitle, artists.name as artistName
          FROM tracks
          LEFT JOIN albums ON albums.id = tracks.album_id
          LEFT JOIN artists ON artists.id = albums.artist_id
          WHERE tracks.library_id = ?
        `).all(libraryId);
      }
    }

    const total = movies.length + episodes.length + tracks.length;
    let checked = 0;
    let healthy = 0;

    // فحص الأفلام
    for (const m of movies) {
      checked++;
      if (fs.existsSync(m.path)) {
        healthy++;
      } else {
        missing.movies.push({
          id: m.id,
          title: m.title,
          year: m.year,
          path: m.path,
          library_id: m.library_id,
          type: 'movie'
        });
      }
      if (checked % 50 === 0) {
        sessionManager.broadcast('health_check_progress', {
          current: checked,
          total,
          percent: Math.round((checked / total) * 100)
        });
        await new Promise(r => setTimeout(r, 2));
      }
    }

    // فحص الحلقات
    for (const ep of episodes) {
      checked++;
      if (fs.existsSync(ep.path)) {
        healthy++;
      } else {
        missing.episodes.push({
          id: ep.id,
          title: `${ep.seriesTitle || ''} - ${ep.title || 'Episode'}`,
          path: ep.path,
          season_id: ep.season_id,
          type: 'episode'
        });
      }
      if (checked % 50 === 0) {
        sessionManager.broadcast('health_check_progress', {
          current: checked,
          total,
          percent: Math.round((checked / total) * 100)
        });
        await new Promise(r => setTimeout(r, 2));
      }
    }

    // فحص التراكات الصوتية
    for (const tr of tracks) {
      checked++;
      if (fs.existsSync(tr.path)) {
        healthy++;
      } else {
        missing.tracks.push({
          id: tr.id,
          title: `${tr.artistName ? tr.artistName + ' - ' : ''}${tr.title}`,
          path: tr.path,
          album_id: tr.album_id,
          type: 'track'
        });
      }
      if (checked % 50 === 0) {
        sessionManager.broadcast('health_check_progress', {
          current: checked,
          total,
          percent: Math.round((checked / total) * 100)
        });
        await new Promise(r => setTimeout(r, 2));
      }
    }

    const totalMissing = missing.movies.length + missing.episodes.length + missing.tracks.length;

    const report = {
      libraryId: targetLib ? targetLib.id : null,
      libraryName: targetLib ? targetLib.name : null,
      totalChecked: total,
      healthy,
      totalMissing,
      missing,
      checkedAt: new Date().toISOString(),
      durationMs: Date.now() - startTime
    };

    if (!targetLib) {
      cachedHealthReport = report;
      lastCheckTimestamp = report.checkedAt;
    }

    sessionManager.broadcast('health_check_completed', report);

    const libLabel = targetLib ? `مكتبة «${targetLib.name}»` : 'كافة المكتبات';
    if (totalMissing > 0) {
      notificationManager.notify({
        title: `فحص سلامة ${libLabel}`,
        message: `تم اكتشاف ${totalMissing} ملف مفقود غير موجود على القرص في ${libLabel}.`,
        type: 'warning',
        category: 'health',
        link: '/database'
      });
    } else {
      notificationManager.notify({
        title: `سلامة ${libLabel} مثالية`,
        message: `تم فحص جميع الملفات (${total} ملف) في ${libLabel} وجميعها سليمة وتعمل بنجاح.`,
        type: 'success',
        category: 'health',
        link: '/database'
      });
    }

    return report;
  } catch (err) {
    console.error('[LibraryHealth] Check error:', err.message);
    throw err;
  } finally {
    isHealthCheckRunning = false;
  }
}

/**
 * البحث التلقائي عن الملفات المنقولة في مجلدات المكتبات المسجلة
 * يطابق اسم الملف وحجمه لربطه بالمسار الجديد
 */
export async function detectRelocatedFiles(missingList = null, options = {}) {
  const { libraryId = null } = options;
  let targetMissing = missingList;

  // إذا لم تُمرر قائمة، نفذ فحصاً سريعاً أولاً
  if (!targetMissing) {
    const integrity = await checkLibraryIntegrity({ libraryId });
    targetMissing = [
      ...integrity.missing.movies,
      ...integrity.missing.episodes,
      ...integrity.missing.tracks
    ];
  } else if (!Array.isArray(targetMissing)) {
    targetMissing = [
      ...(targetMissing.movies || []),
      ...(targetMissing.episodes || []),
      ...(targetMissing.tracks || [])
    ];
  }

  if (targetMissing.length === 0) {
    return { relocations: [], unresolved: [], searchedDirs: 0 };
  }

  // جمع مجلدات كافة المكتبات المسجلة أو المكتبة المحددة
  let libraries = getAllLibraries();
  if (libraryId) {
    libraries = libraries.filter(lib => Number(lib.id) === Number(libraryId));
  }
  const searchRoots = new Set();
  for (const lib of libraries) {
    const paths = Array.isArray(lib.paths) ? lib.paths : [];
    for (const p of paths) {
      if (typeof p === 'string' && fs.existsSync(p)) {
        searchRoots.add(p);
      }
    }
  }

  // خريطة سريعة لملفات الأقراص المفحوصة
  const candidateFiles = [];
  let searchedDirsCount = 0;

  function scanDirRecursive(dir, depth = 0) {
    if (depth > 6) return;
    try {
      searchedDirsCount++;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDirRecursive(full, depth + 1);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          // امتدادات الوسائط المدعومة
          if (['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.ts', '.mp3', '.flac', '.wav', '.m4a', '.aac', '.ogg', '.opus'].includes(ext)) {
            candidateFiles.push({
              fullPath: full,
              filename: entry.name.toLowerCase(),
              baseName: path.basename(entry.name, ext).toLowerCase(),
              ext
            });
          }
        }
      }
    } catch {}
  }

  for (const root of searchRoots) {
    scanDirRecursive(root, 0);
    await new Promise(r => setTimeout(r, 4));
  }

  const relocations = [];
  const unresolved = [];

  for (const item of targetMissing) {
    const oldPath = item.path;
    const oldFilename = path.basename(oldPath).toLowerCase();
    const oldExt = path.extname(oldPath).toLowerCase();
    const oldBaseName = path.basename(oldPath, oldExt).toLowerCase();

    // البحث في الملفات المكتشفة
    const exactMatches = candidateFiles.filter(c => c.filename === oldFilename && c.fullPath.toLowerCase() !== oldPath.toLowerCase());

    if (exactMatches.length === 1) {
      const match = exactMatches[0];
      try {
        const stat = fs.statSync(match.fullPath);
        relocations.push({
          type: item.type,
          id: item.id,
          title: item.title,
          oldPath: item.path,
          newPath: match.fullPath,
          fileSize: stat.size,
          confidence: 'exact'
        });
        continue;
      } catch {}
    } else if (exactMatches.length > 1) {
      // مطابقة متعددة، نختار الأكثر شبهاً بالمسار القديم
      const match = exactMatches[0];
      try {
        const stat = fs.statSync(match.fullPath);
        relocations.push({
          type: item.type,
          id: item.id,
          title: item.title,
          oldPath: item.path,
          newPath: match.fullPath,
          fileSize: stat.size,
          confidence: 'high'
        });
        continue;
      } catch {}
    }

    unresolved.push(item);
  }

  return {
    relocations,
    unresolved,
    searchedDirs: searchedDirsCount,
    candidateFilesCount: candidateFiles.length
  };
}

/**
 * تطبيق تحديثات إعادة الربط على قاعدة البيانات
 * يحافظ على سجل المشاهدة، التقييمات، المفضلة، والصور دون أي مسح
 */
export function applyRelocations(relocations = []) {
  if (!Array.isArray(relocations) || relocations.length === 0) {
    return { applied: 0, failed: 0, errors: [] };
  }

  let applied = 0;
  let failed = 0;
  const errors = [];

  const updateMovie = db.prepare('UPDATE movies SET path = ? WHERE id = ?');
  const updateEpisode = db.prepare('UPDATE episodes SET path = ? WHERE id = ?');
  const updateTrack = db.prepare('UPDATE tracks SET path = ? WHERE id = ?');

  const tx = db.transaction(() => {
    for (const rel of relocations) {
      try {
        if (!fs.existsSync(rel.newPath)) {
          failed++;
          errors.push(`New path does not exist on disk: ${rel.newPath}`);
          continue;
        }

        if (rel.type === 'movie') {
          updateMovie.run(rel.newPath, rel.id);
          applied++;
        } else if (rel.type === 'episode') {
          updateEpisode.run(rel.newPath, rel.id);
          applied++;
        } else if (rel.type === 'track') {
          updateTrack.run(rel.newPath, rel.id);
          applied++;
        }
      } catch (err) {
        failed++;
        errors.push(`${rel.title} (${rel.id}): ${err.message}`);
      }
    }
  });

  tx();

  if (applied > 0) {
    notificationManager.notify({
      title: 'إعادة الربط الذكي',
      message: `تم إعادة ربط ${applied} ملف منقول بنجاح مع الحفاظ على تقدم المشاهدة والتقييمات.`,
      type: 'success',
      category: 'health',
      link: '/database'
    });
  }

  return { applied, failed, errors };
}

/**
 * تنظيف السجلات المفقودة نهائياً مع كافة الجداول المرتبطة
 */
export function pruneVerifiedMissing(missingItems) {
  let toPrune = missingItems;
  if (!toPrune) {
    const movies = db.prepare('SELECT id, title, path FROM movies').all().filter(m => !fs.existsSync(m.path));
    const episodes = db.prepare('SELECT id, title, path FROM episodes').all().filter(e => !fs.existsSync(e.path));
    const tracks = db.prepare('SELECT id, title, path FROM tracks').all().filter(t => !fs.existsSync(t.path));
    toPrune = { movies, episodes, tracks };
  }

  const movies = toPrune.movies || [];
  const episodes = toPrune.episodes || [];
  const tracks = toPrune.tracks || [];

  let delCount = 0;

  const tx = db.transaction(() => {
    // 1. مسح الأفلام المفقودة
    if (movies.length > 0) {
      const delM = db.prepare('DELETE FROM movies WHERE id = ?');
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'movie' AND media_id = ?");
      const delRating = db.prepare("DELETE FROM ratings WHERE media_type = 'movie' AND media_id = ?");
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'movie' AND media_id = ?");
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'movie' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'movie' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'movie' AND media_id = ?");

      for (const m of movies) {
        delImg.run(m.id);
        delRating.run(m.id);
        delPlay.run(m.id);
        delTag.run(m.id);
        delColl.run(m.id);
        delFav.run(m.id);
        delM.run(m.id);
        delCount++;
      }
    }

    // 2. مسح الحلقات المفقودة
    if (episodes.length > 0) {
      const delEp = db.prepare('DELETE FROM episodes WHERE id = ?');
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'episode' AND media_id = ?");
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'episode' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'episode' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'episode' AND media_id = ?");
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'episode' AND media_id = ?");

      for (const ep of episodes) {
        delPlay.run(ep.id);
        delTag.run(ep.id);
        delColl.run(ep.id);
        delFav.run(ep.id);
        delImg.run(ep.id);
        delEp.run(ep.id);
        delCount++;
      }
    }

    // 3. مسح التراكات المفقودة
    if (tracks.length > 0) {
      const delTr = db.prepare('DELETE FROM tracks WHERE id = ?');
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'track' AND media_id = ?");
      const delPl = db.prepare('DELETE FROM playlist_items WHERE track_id = ?');
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'track' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'track' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'track' AND media_id = ?");
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'track' AND media_id = ?");

      for (const tr of tracks) {
        delPlay.run(tr.id);
        delPl.run(tr.id);
        delTag.run(tr.id);
        delColl.run(tr.id);
        delFav.run(tr.id);
        delImg.run(tr.id);
        delTr.run(tr.id);
        delCount++;
      }
    }

    // تنظيف الحاويات الفارغة
    cleanupEmptySeasons();
    cleanupEmptySeries();
    cleanupEmptyAlbums();
    cleanupEmptyArtists();
  });

  tx();

  notificationManager.notify({
    title: 'تنظيف الملفات المفقودة',
    message: `تم تنظيف ${delCount} ملف مفقود والسجلات التابعة لها من قاعدة البيانات.`,
    type: 'info',
    category: 'health',
    link: '/database'
  });

  return {
    deleted: {
      movies: movies.length,
      episodes: episodes.length,
      tracks: tracks.length
    },
    totalDeleted: delCount
  };
}

/**
 * الحصول على ملخص صحة وسلامة المكتبة السريع
 */
export function getHealthReport() {
  const totalMovies = db.prepare('SELECT COUNT(*) as c FROM movies').get().c;
  const moviesWithPoster = db.prepare(`SELECT COUNT(DISTINCT media_id) as c FROM images WHERE media_type = 'movie' AND image_type = 'poster'`).get().c;
  const moviesWithPlot = db.prepare(`SELECT COUNT(*) as c FROM movies WHERE plot IS NOT NULL AND TRIM(plot) != ''`).get().c;

  const totalSeries = db.prepare('SELECT COUNT(*) as c FROM series').get().c;
  const seriesWithPoster = db.prepare(`SELECT COUNT(DISTINCT media_id) as c FROM images WHERE media_type = 'series' AND image_type = 'poster'`).get().c;
  const seriesWithPlot = db.prepare(`SELECT COUNT(*) as c FROM series WHERE plot IS NOT NULL AND TRIM(plot) != ''`).get().c;

  const totalTracks = db.prepare('SELECT COUNT(*) as c FROM tracks').get().c;

  return {
    cachedReport: cachedHealthReport,
    stats: {
      movies: {
        total: totalMovies,
        withPoster: moviesWithPoster,
        missingPoster: totalMovies - moviesWithPoster,
        withPlot: moviesWithPlot,
        missingPlot: totalMovies - moviesWithPlot
      },
      series: {
        total: totalSeries,
        withPoster: seriesWithPoster,
        missingPoster: totalSeries - seriesWithPoster,
        withPlot: seriesWithPlot,
        missingPlot: totalSeries - seriesWithPlot
      },
      tracks: {
        total: totalTracks
      }
    },
    lastCheck: lastCheckTimestamp
  };
}

export default {
  checkLibraryIntegrity,
  detectRelocatedFiles,
  applyRelocations,
  pruneVerifiedMissing,
  getHealthReport
};
