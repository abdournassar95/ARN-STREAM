import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import db, { dbPath, getDataDir, cleanupEmptySeasons, cleanupEmptySeries, cleanupEmptyAlbums, cleanupEmptyArtists } from '../db.js';

/**
 * Format bytes into human readable format
 */
function formatBytes(bytes, decimals = 2) {
  if (!+bytes) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Normalizes text for comparison (Arabic + Latin)
 */
function normalizeText(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[^\w\s\u0600-\u06FF]/g, '')
    .replace(/\s+/g, ' ');
}

/**
 * Check if a file physically exists on disk safely
 */
export function checkFileExists(filePath) {
  if (!filePath || typeof filePath !== 'string' || !filePath.trim()) return false;
  try {
    return fs.existsSync(filePath.trim());
  } catch {
    return false;
  }
}

/**
 * 1. Get detailed database statistics, health metrics, and issues
 */
export function getDatabaseStats() {
  const stats = {
    filePath: dbPath,
    exists: fs.existsSync(dbPath),
    fileSize: 0,
    fileSizeFormatted: '0 MB',
    walSize: 0,
    walSizeFormatted: '0 MB',
    counts: {},
    issues: {
      emptySeries: 0,
      emptySeasons: 0,
      emptyAlbums: 0,
      emptyArtists: 0,
      orphanedImages: 0,
      orphanedMediaTags: 0,
      orphanedPlaybackState: 0,
      orphanedCollectionItems: 0,
      orphanedPlaylistItems: 0,
      missingFilesCount: 0,
      duplicateMoviesCount: 0,
      duplicateTracksCount: 0,
      duplicateEpisodesCount: 0,
      duplicateArtistsCount: 0
    }
  };

  // DB file size
  if (stats.exists) {
    try {
      const s = fs.statSync(dbPath);
      stats.fileSize = s.size;
      stats.fileSizeFormatted = formatBytes(s.size);
    } catch {}
  }

  // WAL file size
  const walPath = `${dbPath}-wal`;
  if (fs.existsSync(walPath)) {
    try {
      const ws = fs.statSync(walPath);
      stats.walSize = ws.size;
      stats.walSizeFormatted = formatBytes(ws.size);
    } catch {}
  }

  // Table counts
  const tables = [
    'movies', 'series', 'seasons', 'episodes',
    'artists', 'albums', 'tracks', 'libraries',
    'images', 'playlists', 'playlist_items',
    'collections', 'collection_items', 'playback_state',
    'ratings', 'media_tags', 'users'
  ];

  for (const tbl of tables) {
    try {
      const r = db.prepare(`SELECT COUNT(*) as c FROM ${tbl}`).get();
      stats.counts[tbl] = r ? r.c : 0;
    } catch {
      stats.counts[tbl] = 0;
    }
  }

  // Calculate issue counts
  try {
    // Empty series (no episodes)
    const emptySer = db.prepare(`
      SELECT COUNT(*) as c FROM series 
      WHERE id NOT IN (
        SELECT DISTINCT series_id FROM seasons 
        JOIN episodes ON episodes.season_id = seasons.id
      )
    `).get();
    stats.issues.emptySeries = emptySer ? emptySer.c : 0;

    // Empty seasons (no episodes)
    const emptySeas = db.prepare(`
      SELECT COUNT(*) as c FROM seasons 
      WHERE id NOT IN (SELECT DISTINCT season_id FROM episodes)
    `).get();
    stats.issues.emptySeasons = emptySeas ? emptySeas.c : 0;

    // Empty albums (no tracks)
    const emptyAlb = db.prepare(`
      SELECT COUNT(*) as c FROM albums 
      WHERE id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)
    `).get();
    stats.issues.emptyAlbums = emptyAlb ? emptyAlb.c : 0;

    // Empty artists (no tracks via albums)
    const emptyArt = db.prepare(`
      SELECT COUNT(*) as c FROM artists 
      WHERE id NOT IN (
        SELECT DISTINCT albums.artist_id FROM albums
        JOIN tracks ON tracks.album_id = albums.id
        WHERE albums.artist_id IS NOT NULL
      )
    `).get();
    stats.issues.emptyArtists = emptyArt ? emptyArt.c : 0;

    // Orphaned images
    const orphanedImgs = db.prepare(`
      SELECT COUNT(*) as c FROM images WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums))
    `).get();
    stats.issues.orphanedImages = orphanedImgs ? orphanedImgs.c : 0;

    // Orphaned tags
    const orphanedTags = db.prepare(`
      SELECT COUNT(*) as c FROM media_tags WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).get();
    stats.issues.orphanedMediaTags = orphanedTags ? orphanedTags.c : 0;

    // Duplicate movies count (by path or normalized title + year)
    const dupMovies = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT path FROM movies GROUP BY path HAVING COUNT(*) > 1
        UNION
        SELECT title FROM movies WHERE year IS NOT NULL GROUP BY norm_ar(title), year HAVING COUNT(*) > 1
      )
    `).get();
    stats.issues.duplicateMoviesCount = dupMovies ? dupMovies.c : 0;

    // Duplicate tracks count (by path or title + album_id)
    const dupTracks = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT path FROM tracks GROUP BY path HAVING COUNT(*) > 1
        UNION
        SELECT title FROM tracks WHERE album_id IS NOT NULL GROUP BY norm_ar(title), album_id HAVING COUNT(*) > 1
      )
    `).get();
    stats.issues.duplicateTracksCount = dupTracks ? dupTracks.c : 0;

    // Duplicate episodes count (by path or season_id + episode_number)
    const dupEp = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT path FROM episodes GROUP BY path HAVING COUNT(*) > 1
        UNION
        SELECT episode_number FROM episodes GROUP BY season_id, episode_number HAVING COUNT(*) > 1
      )
    `).get();
    stats.issues.duplicateEpisodesCount = dupEp ? dupEp.c : 0;

    // Duplicate artists count (by normalized name)
    const dupArt = db.prepare(`
      SELECT COUNT(*) as c FROM (
        SELECT name FROM artists GROUP BY norm_ar(name) HAVING COUNT(*) > 1
      )
    `).get();
    stats.issues.duplicateArtistsCount = dupArt ? dupArt.c : 0;

    // Sample / Quick Missing Files count check
    // We check records with paths to see how many don't exist
    let missingCount = 0;
    const sampleMovies = db.prepare('SELECT path FROM movies').all();
    for (const m of sampleMovies) {
      if (!checkFileExists(m.path)) missingCount++;
    }
    const sampleEpisodes = db.prepare('SELECT path FROM episodes').all();
    for (const ep of sampleEpisodes) {
      if (!checkFileExists(ep.path)) missingCount++;
    }
    const sampleTracks = db.prepare('SELECT path FROM tracks').all();
    for (const tr of sampleTracks) {
      if (!checkFileExists(tr.path)) missingCount++;
    }
    stats.issues.missingFilesCount = missingCount;

  } catch (err) {
    console.error('[DB-Manager] Issue calculation error:', err);
  }

  return stats;
}

/**
 * 2. Clean Orphaned Data (Empty series, seasons, albums, artists, orphaned images/tags/state)
 */
export function cleanOrphanedData() {
  const result = {
    deletedEmptySeries: 0,
    deletedEmptySeasons: 0,
    deletedEmptyAlbums: 0,
    deletedEmptyArtists: 0,
    deletedOrphanedImages: 0,
    deletedOrphanedMediaTags: 0,
    deletedOrphanedPlayback: 0,
    deletedOrphanedRatings: 0,
    deletedOrphanedFavorites: 0,
    deletedOrphanedItems: 0,
    totalCleaned: 0
  };

  const tx = db.transaction(() => {
    // Clean empty containers using db.js native functions
    result.deletedEmptySeasons = cleanupEmptySeasons();
    result.deletedEmptySeries = cleanupEmptySeries();
    result.deletedEmptyAlbums = cleanupEmptyAlbums();
    result.deletedEmptyArtists = cleanupEmptyArtists();

    // Clean orphaned images
    const imgRes = db.prepare(`
      DELETE FROM images WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks)) OR
        (media_type = 'library' AND media_id NOT IN (SELECT id FROM libraries))
    `).run();
    result.deletedOrphanedImages = imgRes.changes;

    // Clean orphaned media tags
    const tagRes = db.prepare(`
      DELETE FROM media_tags WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).run();
    result.deletedOrphanedMediaTags = tagRes.changes;

    // Clean orphaned playback state
    const playRes = db.prepare(`
      DELETE FROM playback_state WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).run();
    result.deletedOrphanedPlayback = playRes.changes;

    // Clean orphaned ratings
    const ratingRes = db.prepare(`
      DELETE FROM ratings WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).run();
    result.deletedOrphanedRatings = ratingRes.changes;

    // Clean orphaned user favorites
    const favRes = db.prepare(`
      DELETE FROM user_favorites WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).run();
    result.deletedOrphanedFavorites = favRes.changes;

    // Clean orphaned playlist / collection items
    const pItemsRes = db.prepare(`
      DELETE FROM playlist_items WHERE track_id NOT IN (SELECT id FROM tracks)
    `).run();
    const cItemsRes = db.prepare(`
      DELETE FROM collection_items WHERE
        (media_type = 'movie' AND media_id NOT IN (SELECT id FROM movies)) OR
        (media_type = 'series' AND media_id NOT IN (SELECT id FROM series)) OR
        (media_type = 'season' AND media_id NOT IN (SELECT id FROM seasons)) OR
        (media_type = 'episode' AND media_id NOT IN (SELECT id FROM episodes)) OR
        (media_type = 'artist' AND media_id NOT IN (SELECT id FROM artists)) OR
        (media_type = 'album' AND media_id NOT IN (SELECT id FROM albums)) OR
        (media_type = 'track' AND media_id NOT IN (SELECT id FROM tracks))
    `).run();
    result.deletedOrphanedItems = pItemsRes.changes + cItemsRes.changes;
  });

  tx();

  result.totalCleaned = 
    result.deletedEmptySeries +
    result.deletedEmptySeasons +
    result.deletedEmptyAlbums +
    result.deletedEmptyArtists +
    result.deletedOrphanedImages +
    result.deletedOrphanedMediaTags +
    result.deletedOrphanedPlayback +
    result.deletedOrphanedRatings +
    result.deletedOrphanedFavorites +
    result.deletedOrphanedItems;

  return result;
}

/**
 * 3. Find and Clean Missing Files (Where physical file on disk no longer exists)
 */
export function cleanMissingFiles(dryRun = false) {
  const missing = {
    movies: [],
    episodes: [],
    tracks: [],
    totalMissing: 0,
    cleaned: 0
  };

  // 1. Movies
  const movies = db.prepare('SELECT id, title, year, path, library_id FROM movies').all();
  for (const m of movies) {
    if (!checkFileExists(m.path)) {
      missing.movies.push({ id: m.id, title: m.title, year: m.year, path: m.path, type: 'movie' });
    }
  }

  // 2. Episodes
  const episodes = db.prepare(`
    SELECT episodes.id, episodes.title, episodes.path, episodes.season_id, series.title as seriesTitle
    FROM episodes
    LEFT JOIN seasons ON seasons.id = episodes.season_id
    LEFT JOIN series ON series.id = seasons.series_id
  `).all();
  for (const ep of episodes) {
    if (!checkFileExists(ep.path)) {
      missing.episodes.push({ id: ep.id, title: `${ep.seriesTitle || ''} - ${ep.title || 'Episode'}`, path: ep.path, type: 'episode' });
    }
  }

  // 3. Tracks
  const tracks = db.prepare(`
    SELECT tracks.id, tracks.title, tracks.path, albums.title as albumTitle, artists.name as artistName
    FROM tracks
    LEFT JOIN albums ON albums.id = tracks.album_id
    LEFT JOIN artists ON artists.id = albums.artist_id
  `).all();
  for (const tr of tracks) {
    if (!checkFileExists(tr.path)) {
      missing.tracks.push({ id: tr.id, title: `${tr.artistName ? tr.artistName + ' - ' : ''}${tr.title}`, path: tr.path, type: 'track' });
    }
  }

  missing.totalMissing = missing.movies.length + missing.episodes.length + missing.tracks.length;

  if (dryRun || missing.totalMissing === 0) {
    return missing;
  }

  // Delete records and clean all associations
  const tx = db.transaction(() => {
    let delCount = 0;
    // Delete missing movies
    if (missing.movies.length > 0) {
      const delMovie = db.prepare('DELETE FROM movies WHERE id = ?');
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'movie' AND media_id = ?");
      const delRating = db.prepare("DELETE FROM ratings WHERE media_type = 'movie' AND media_id = ?");
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'movie' AND media_id = ?");
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'movie' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'movie' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'movie' AND media_id = ?");

      for (const m of missing.movies) {
        delImg.run(m.id);
        delRating.run(m.id);
        delPlay.run(m.id);
        delTag.run(m.id);
        delColl.run(m.id);
        delFav.run(m.id);
        delMovie.run(m.id);
        delCount++;
      }
    }

    // Delete missing episodes
    if (missing.episodes.length > 0) {
      const delEp = db.prepare('DELETE FROM episodes WHERE id = ?');
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'episode' AND media_id = ?");
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'episode' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'episode' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'episode' AND media_id = ?");
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'episode' AND media_id = ?");

      for (const ep of missing.episodes) {
        delPlay.run(ep.id);
        delTag.run(ep.id);
        delColl.run(ep.id);
        delFav.run(ep.id);
        delImg.run(ep.id);
        delEp.run(ep.id);
        delCount++;
      }
    }

    // Delete missing tracks
    if (missing.tracks.length > 0) {
      const delTrack = db.prepare('DELETE FROM tracks WHERE id = ?');
      const delPlay = db.prepare("DELETE FROM playback_state WHERE media_type = 'track' AND media_id = ?");
      const delPl = db.prepare('DELETE FROM playlist_items WHERE track_id = ?');
      const delTag = db.prepare("DELETE FROM media_tags WHERE media_type = 'track' AND media_id = ?");
      const delColl = db.prepare("DELETE FROM collection_items WHERE media_type = 'track' AND media_id = ?");
      const delFav = db.prepare("DELETE FROM user_favorites WHERE media_type = 'track' AND media_id = ?");
      const delImg = db.prepare("DELETE FROM images WHERE media_type = 'track' AND media_id = ?");

      for (const tr of missing.tracks) {
        delPlay.run(tr.id);
        delPl.run(tr.id);
        delTag.run(tr.id);
        delColl.run(tr.id);
        delFav.run(tr.id);
        delImg.run(tr.id);
        delTrack.run(tr.id);
        delCount++;
      }
    }

    // Cascade clean empty containers
    cleanupEmptySeasons();
    cleanupEmptySeries();
    cleanupEmptyAlbums();
    cleanupEmptyArtists();

    missing.cleaned = delCount;
  });

  tx();

  // Run final orphaned data purge to guarantee 100% cleanliness
  try {
    cleanOrphanedData();
  } catch {}

  return missing;
}

/**
 * 4. Detect Duplicates
 */
export function findDuplicates() {
  const duplicates = {
    movies: [],
    tracks: [],
    episodes: [],
    artists: [],
    totalGroups: 0
  };

  // Duplicate movies by path or (title + year)
  const dupMovieGroups = db.prepare(`
    SELECT title, year, COUNT(*) as count 
    FROM movies 
    WHERE year IS NOT NULL 
    GROUP BY norm_ar(title), year 
    HAVING count > 1
  `).all();

  for (const grp of dupMovieGroups) {
    const items = db.prepare(`
      SELECT movies.*, libraries.name as libraryName
      FROM movies
      LEFT JOIN libraries ON libraries.id = movies.library_id
      WHERE norm_ar(movies.title) = norm_ar(?) AND movies.year = ?
      ORDER BY movies.id ASC
    `).all(grp.title, grp.year);

    if (items.length > 1) {
      duplicates.movies.push({
        groupKey: `${grp.title} (${grp.year})`,
        count: items.length,
        items: items.map(m => ({ ...m, exists: checkFileExists(m.path) }))
      });
    }
  }

  // Duplicate movies by identical path
  const dupMoviePaths = db.prepare(`
    SELECT path, COUNT(*) as count 
    FROM movies 
    GROUP BY path 
    HAVING count > 1
  `).all();

  for (const grp of dupMoviePaths) {
    if (duplicates.movies.some(g => g.groupKey === grp.path)) continue;
    const items = db.prepare(`
      SELECT movies.*, libraries.name as libraryName
      FROM movies
      LEFT JOIN libraries ON libraries.id = movies.library_id
      WHERE movies.path = ?
      ORDER BY movies.id ASC
    `).all(grp.path);

    if (items.length > 1) {
      duplicates.movies.push({
        groupKey: `Path: ${grp.path}`,
        count: items.length,
        items: items.map(m => ({ ...m, exists: checkFileExists(m.path) }))
      });
    }
  }

  // Duplicate tracks by title and album_id
  const dupTrackGroups = db.prepare(`
    SELECT title, album_id, COUNT(*) as count 
    FROM tracks 
    WHERE album_id IS NOT NULL 
    GROUP BY norm_ar(title), album_id 
    HAVING count > 1
  `).all();

  for (const grp of dupTrackGroups) {
    const items = db.prepare(`
      SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, libraries.name as libraryName
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      LEFT JOIN libraries ON libraries.id = tracks.library_id
      WHERE norm_ar(tracks.title) = norm_ar(?) AND tracks.album_id = ?
      ORDER BY tracks.id ASC
    `).all(grp.title, grp.album_id);

    if (items.length > 1) {
      duplicates.tracks.push({
        groupKey: `${items[0]?.artistName ? items[0].artistName + ' - ' : ''}${grp.title}`,
        count: items.length,
        items: items.map(t => ({ ...t, exists: checkFileExists(t.path) }))
      });
    }
  }

  // Duplicate episodes by season_id and episode_number
  const dupEpGroups = db.prepare(`
    SELECT season_id, episode_number, COUNT(*) as count 
    FROM episodes 
    GROUP BY season_id, episode_number 
    HAVING count > 1
  `).all();

  for (const grp of dupEpGroups) {
    const items = db.prepare(`
      SELECT episodes.*, seasons.season_number, series.title as seriesTitle, libraries.name as libraryName
      FROM episodes
      LEFT JOIN seasons ON seasons.id = episodes.season_id
      LEFT JOIN series ON series.id = seasons.series_id
      LEFT JOIN libraries ON libraries.id = series.library_id
      WHERE episodes.season_id = ? AND episodes.episode_number = ?
      ORDER BY episodes.id ASC
    `).all(grp.season_id, grp.episode_number);

    if (items.length > 1) {
      duplicates.episodes.push({
        groupKey: `${items[0]?.seriesTitle || 'Series'} S${grp.season_id}E${grp.episode_number}`,
        count: items.length,
        items: items.map(e => ({ ...e, exists: checkFileExists(e.path) }))
      });
    }
  }

  // Duplicate artists by normalized name
  const dupArtGroups = db.prepare(`
    SELECT norm_ar(name) as normName, COUNT(*) as count 
    FROM artists 
    GROUP BY norm_ar(name) 
    HAVING count > 1
  `).all();

  for (const grp of dupArtGroups) {
    const items = db.prepare(`
      SELECT artists.*, libraries.name as libraryName,
        (SELECT COUNT(*) FROM albums WHERE artist_id = artists.id) as albumsCount
      FROM artists
      LEFT JOIN libraries ON libraries.id = artists.library_id
      WHERE norm_ar(artists.name) = ?
      ORDER BY artists.id ASC
    `).all(grp.normName);

    if (items.length > 1) {
      duplicates.artists.push({
        groupKey: `Artist: ${items[0]?.name}`,
        count: items.length,
        items
      });
    }
  }

  duplicates.totalGroups = 
    duplicates.movies.length + 
    duplicates.tracks.length + 
    duplicates.episodes.length + 
    duplicates.artists.length;

  return duplicates;
}

/**
 * 5. Clean / Deduplicate Records
 * Keeps primary record (first created or with valid existing file) and removes duplicates.
 */
export function cleanDuplicates() {
  const result = {
    mergedMovies: 0,
    mergedTracks: 0,
    mergedEpisodes: 0,
    mergedArtists: 0,
    totalCleaned: 0
  };

  const dups = findDuplicates();

  const tx = db.transaction(() => {
    // 1. Deduplicate Movies
    for (const grp of dups.movies) {
      // Pick best keeper: prefer one whose file physically exists, or lowest ID
      const items = grp.items;
      const keeper = items.find(i => i.exists) || items[0];
      for (const item of items) {
        if (item.id === keeper.id) continue;
        // Re-assign images and ratings if keeper doesn't have them
        db.prepare("UPDATE OR IGNORE images SET media_id = ? WHERE media_type = 'movie' AND media_id = ?").run(keeper.id, item.id);
        db.prepare("UPDATE OR IGNORE ratings SET media_id = ? WHERE media_type = 'movie' AND media_id = ?").run(keeper.id, item.id);
        db.prepare("UPDATE OR IGNORE playback_state SET media_id = ? WHERE media_type = 'movie' AND media_id = ?").run(keeper.id, item.id);
        // Delete redundant duplicate
        db.prepare('DELETE FROM movies WHERE id = ?').run(item.id);
        db.prepare("DELETE FROM images WHERE media_type = 'movie' AND media_id = ?").run(item.id);
        result.mergedMovies++;
      }
    }

    // 2. Deduplicate Tracks
    for (const grp of dups.tracks) {
      const items = grp.items;
      const keeper = items.find(i => i.exists) || items[0];
      for (const item of items) {
        if (item.id === keeper.id) continue;
        db.prepare('UPDATE OR IGNORE playlist_items SET track_id = ? WHERE track_id = ?').run(keeper.id, item.id);
        db.prepare("UPDATE OR IGNORE playback_state SET media_id = ? WHERE media_type = 'track' AND media_id = ?").run(keeper.id, item.id);
        db.prepare('DELETE FROM tracks WHERE id = ?').run(item.id);
        result.mergedTracks++;
      }
    }

    // 3. Deduplicate Episodes
    for (const grp of dups.episodes) {
      const items = grp.items;
      const keeper = items.find(i => i.exists) || items[0];
      for (const item of items) {
        if (item.id === keeper.id) continue;
        db.prepare("UPDATE OR IGNORE playback_state SET media_id = ? WHERE media_type = 'episode' AND media_id = ?").run(keeper.id, item.id);
        db.prepare('DELETE FROM episodes WHERE id = ?').run(item.id);
        result.mergedEpisodes++;
      }
    }

    // 4. Deduplicate Artists
    for (const grp of dups.artists) {
      const items = grp.items;
      // Keeper: artist with the most albums or lowest ID
      const keeper = [...items].sort((a, b) => (b.albumsCount || 0) - (a.albumsCount || 0))[0] || items[0];
      for (const item of items) {
        if (item.id === keeper.id) continue;
        // Move albums to keeper
        db.prepare('UPDATE albums SET artist_id = ? WHERE artist_id = ?').run(keeper.id, item.id);
        db.prepare("UPDATE OR IGNORE images SET media_id = ? WHERE media_type = 'artist' AND media_id = ?").run(keeper.id, item.id);
        db.prepare('DELETE FROM artists WHERE id = ?').run(item.id);
        db.prepare("DELETE FROM images WHERE media_type = 'artist' AND media_id = ?").run(item.id);
        result.mergedArtists++;
      }
    }

    cleanupEmptySeasons();
    cleanupEmptySeries();
    cleanupEmptyAlbums();
    cleanupEmptyArtists();
  });

  tx();

  result.totalCleaned = 
    result.mergedMovies + 
    result.mergedTracks + 
    result.mergedEpisodes + 
    result.mergedArtists;

  return result;
}

/**
 * 6. Vacuum & Optimize SQLite Database
 */
export function vacuumAndOptimizeDatabase() {
  const beforeSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

  try {
    // 1. Truncate WAL file
    db.pragma('wal_checkpoint(TRUNCATE)');
    // 2. Optimize indices
    db.pragma('optimize');
    // 3. Vacuum database file to reclaim free pages
    db.exec('VACUUM');
    // 4. Update query planner statistics
    db.exec('ANALYZE');
  } catch (err) {
    console.error('[DB-Manager] Vacuum error:', err);
  }

  const afterSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
  const reclaimed = Math.max(0, beforeSize - afterSize);

  return {
    beforeBytes: beforeSize,
    beforeFormatted: formatBytes(beforeSize),
    afterBytes: afterSize,
    afterFormatted: formatBytes(afterSize),
    reclaimedBytes: reclaimed,
    reclaimedFormatted: formatBytes(reclaimed)
  };
}

/**
 * 7. Instant Backup Database
 */
export function backupDatabase() {
  const backupDir = path.join(getDataDir(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Also maintain workspace backup folder if accessible
  const localBackupDir = 'd:/PersonalStream/backups';
  if (fs.existsSync(path.dirname(localBackupDir)) && !fs.existsSync(localBackupDir)) {
    try { fs.mkdirSync(localBackupDir, { recursive: true }); } catch {}
  }

  // Checkpoint WAL first so backup has the freshest data
  try {
    db.pragma('wal_checkpoint(FULL)');
  } catch {}

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `media_backup_${timestamp}.db`;
  const targetPath = path.join(backupDir, filename);

  fs.copyFileSync(dbPath, targetPath);

  // Copy to project backups folder if exists
  if (fs.existsSync(localBackupDir)) {
    try {
      fs.copyFileSync(dbPath, path.join(localBackupDir, filename));
    } catch {}
  }

  const s = fs.statSync(targetPath);

  return {
    filename,
    path: targetPath,
    sizeBytes: s.size,
    sizeFormatted: formatBytes(s.size),
    timestamp: new Date().toISOString()
  };
}

/**
 * 8. List Backups
 */
export function listBackups() {
  const backupDir = path.join(getDataDir(), 'backups');
  const list = [];
  if (fs.existsSync(backupDir)) {
    try {
      const files = fs.readdirSync(backupDir).filter(f => f.endsWith('.db'));
      for (const f of files) {
        try {
          const full = path.join(backupDir, f);
          const st = fs.statSync(full);
          list.push({
            filename: f,
            path: full,
            sizeBytes: st.size,
            sizeFormatted: formatBytes(st.size),
            createdAt: st.mtime
          });
        } catch {}
      }
    } catch {}
  }

  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * 9. Direct Query Records for Data Explorer
 */
export function queryRecords({
  table = 'movies',
  search = '',
  libraryId = null,
  missingOnly = false,
  page = 1,
  limit = 25,
  sortBy = 'id',
  sortOrder = 'DESC'
}) {
  const validTables = ['movies', 'series', 'episodes', 'tracks', 'albums', 'artists', 'libraries', 'users'];
  if (!validTables.includes(table)) {
    throw new Error(`Invalid table: ${table}`);
  }

  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  const order = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

  let items = [];
  let totalCount = 0;

  if (table === 'movies') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(movies.title LIKE ? OR movies.path LIKE ? OR movies.plot LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    if (libraryId) {
      whereClauses.push('movies.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM movies WHERE ${whereSql}`).get(...params).c;

    const rows = db.prepare(`
      SELECT movies.*, libraries.name as libraryName
      FROM movies
      LEFT JOIN libraries ON libraries.id = movies.library_id
      WHERE ${whereSql}
      ORDER BY movies.${sortBy === 'title' ? 'title' : (sortBy === 'year' ? 'year' : 'id')} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({
      ...r,
      table: 'movies',
      exists: checkFileExists(r.path)
    }));

  } else if (table === 'series') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(series.title LIKE ? OR series.plot LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    if (libraryId) {
      whereClauses.push('series.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM series WHERE ${whereSql}`).get(...params).c;

    const rows = db.prepare(`
      SELECT series.*, libraries.name as libraryName,
        (SELECT COUNT(*) FROM seasons WHERE series_id = series.id) as seasonsCount,
        (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) as episodesCount
      FROM series
      LEFT JOIN libraries ON libraries.id = series.library_id
      WHERE ${whereSql}
      ORDER BY series.${sortBy === 'title' ? 'title' : (sortBy === 'year' ? 'year' : 'id')} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({ ...r, table: 'series' }));

  } else if (table === 'episodes') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(episodes.title LIKE ? OR episodes.path LIKE ? OR series.title LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    if (libraryId) {
      whereClauses.push('series.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`
      SELECT COUNT(*) as c 
      FROM episodes 
      LEFT JOIN seasons ON seasons.id = episodes.season_id
      LEFT JOIN series ON series.id = seasons.series_id
      WHERE ${whereSql}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT episodes.*, seasons.season_number, series.title as seriesTitle, series.library_id, libraries.name as libraryName
      FROM episodes
      LEFT JOIN seasons ON seasons.id = episodes.season_id
      LEFT JOIN series ON series.id = seasons.series_id
      LEFT JOIN libraries ON libraries.id = series.library_id
      WHERE ${whereSql}
      ORDER BY episodes.${sortBy === 'title' ? 'title' : 'id'} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({
      ...r,
      table: 'episodes',
      exists: checkFileExists(r.path)
    }));

  } else if (table === 'tracks') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(tracks.title LIKE ? OR tracks.path LIKE ? OR albums.title LIKE ? OR artists.name LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q, q);
    }
    if (libraryId) {
      whereClauses.push('tracks.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`
      SELECT COUNT(*) as c 
      FROM tracks 
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE ${whereSql}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, libraries.name as libraryName
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      LEFT JOIN libraries ON libraries.id = tracks.library_id
      WHERE ${whereSql}
      ORDER BY tracks.${sortBy === 'title' ? 'title' : 'id'} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({
      ...r,
      table: 'tracks',
      exists: checkFileExists(r.path)
    }));

  } else if (table === 'albums') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(albums.title LIKE ? OR artists.name LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    if (libraryId) {
      whereClauses.push('albums.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`
      SELECT COUNT(*) as c 
      FROM albums 
      LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE ${whereSql}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT albums.*, artists.name as artistName, libraries.name as libraryName,
        (SELECT COUNT(*) FROM tracks WHERE album_id = albums.id) as tracksCount
      FROM albums
      LEFT JOIN artists ON artists.id = albums.artist_id
      LEFT JOIN libraries ON libraries.id = albums.library_id
      WHERE ${whereSql}
      ORDER BY albums.${sortBy === 'title' ? 'title' : 'id'} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({ ...r, table: 'albums' }));

  } else if (table === 'artists') {
    let whereClauses = ['1=1'];
    const params = [];

    if (search && search.trim()) {
      whereClauses.push('(artists.name LIKE ? OR artists.genre LIKE ? OR artists.bio LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    if (libraryId) {
      whereClauses.push('artists.library_id = ?');
      params.push(Number(libraryId));
    }

    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM artists WHERE ${whereSql}`).get(...params).c;

    const rows = db.prepare(`
      SELECT artists.*, libraries.name as libraryName,
        (SELECT COUNT(*) FROM albums WHERE artist_id = artists.id) as albumsCount
      FROM artists
      LEFT JOIN libraries ON libraries.id = artists.library_id
      WHERE ${whereSql}
      ORDER BY artists.${sortBy === 'name' ? 'name' : 'id'} ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(r => ({ ...r, table: 'artists' }));

  } else if (table === 'libraries') {
    const rows = db.prepare('SELECT * FROM libraries ORDER BY sort_order ASC, id ASC').all();
    totalCount = rows.length;
    items = rows.map(lib => {
      let paths = [];
      try { paths = JSON.parse(lib.paths); } catch {}

      let mediaCount = 0;
      let moviesCount = 0;
      let seriesCount = 0;
      let episodesCount = 0;
      let tracksCount = 0;
      let albumsCount = 0;
      let artistsCount = 0;

      if (lib.type === 'movies') {
        moviesCount = db.prepare('SELECT COUNT(*) as c FROM movies WHERE library_id = ?').get(lib.id)?.c || 0;
        mediaCount = moviesCount;
      } else if (lib.type === 'shows') {
        seriesCount = db.prepare('SELECT COUNT(*) as c FROM series WHERE library_id = ?').get(lib.id)?.c || 0;
        episodesCount = db.prepare(`
          SELECT COUNT(episodes.id) as c 
          FROM episodes 
          JOIN seasons ON seasons.id = episodes.season_id 
          JOIN series ON series.id = seasons.series_id 
          WHERE series.library_id = ?
        `).get(lib.id)?.c || 0;
        mediaCount = seriesCount;
      } else if (lib.type === 'music') {
        tracksCount = db.prepare('SELECT COUNT(*) as c FROM tracks WHERE library_id = ?').get(lib.id)?.c || 0;
        albumsCount = db.prepare('SELECT COUNT(*) as c FROM albums WHERE library_id = ?').get(lib.id)?.c || 0;
        artistsCount = db.prepare('SELECT COUNT(*) as c FROM artists WHERE library_id = ?').get(lib.id)?.c || 0;
        mediaCount = tracksCount;
      }

      return {
        ...lib,
        paths,
        mediaCount,
        moviesCount,
        seriesCount,
        episodesCount,
        tracksCount,
        albumsCount,
        artistsCount,
        table: 'libraries'
      };
    });
  } else if (table === 'users') {
    let whereClauses = ['1=1'];
    const params = [];
    if (search && search.trim()) {
      whereClauses.push('(users.username LIKE ? OR users.display_name LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM users WHERE ${whereSql}`).get(...params).c;
    const rows = db.prepare(`
      SELECT id, username, display_name, avatar, role, allowed_libraries, can_download, can_cast, is_active, created_at, last_login
      FROM users
      WHERE ${whereSql}
      ORDER BY users.id ${order}
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(u => ({
      ...u,
      allowed_libraries: u.allowed_libraries ? JSON.parse(u.allowed_libraries) : null,
      table: 'users'
    }));
  }

  // Filter missingOnly if requested for file tables
  if (missingOnly && ['movies', 'episodes', 'tracks'].includes(table)) {
    items = items.filter(i => !i.exists);
  }

  return {
    items,
    totalCount,
    page: Number(page),
    pageSize: Number(limit),
    totalPages: Math.ceil(totalCount / Number(limit))
  };
}

/**
 * 10. Update Record Directly
 */
export function updateRecord(table, id, data = {}) {
  const numId = Number(id);

  if (table === 'movies') {
    const cur = db.prepare('SELECT * FROM movies WHERE id = ?').get(numId);
    if (!cur) throw new Error('Movie not found');

    const title = data.title !== undefined ? String(data.title).trim() : cur.title;
    const year = data.year !== undefined ? (Number(data.year) || null) : cur.year;
    const plot = data.plot !== undefined ? data.plot : cur.plot;
    const filePath = data.path !== undefined ? String(data.path).trim() : cur.path;
    const libraryId = data.library_id !== undefined ? (Number(data.library_id) || null) : cur.library_id;
    const duration = data.duration !== undefined ? Number(data.duration) : cur.duration;
    const resolution = data.resolution !== undefined ? data.resolution : cur.resolution;

    db.prepare(`
      UPDATE movies SET 
        title = ?, year = ?, plot = ?, path = ?, 
        library_id = ?, duration = ?, resolution = ?
      WHERE id = ?
    `).run(title, year, plot, filePath, libraryId, duration, resolution, numId);

    return db.prepare('SELECT * FROM movies WHERE id = ?').get(numId);

  } else if (table === 'series') {
    const cur = db.prepare('SELECT * FROM series WHERE id = ?').get(numId);
    if (!cur) throw new Error('Series not found');

    const title = data.title !== undefined ? String(data.title).trim() : cur.title;
    const year = data.year !== undefined ? (Number(data.year) || null) : cur.year;
    const plot = data.plot !== undefined ? data.plot : cur.plot;
    const libraryId = data.library_id !== undefined ? (Number(data.library_id) || null) : cur.library_id;

    db.prepare(`
      UPDATE series SET 
        title = ?, year = ?, plot = ?, library_id = ?
      WHERE id = ?
    `).run(title, year, plot, libraryId, numId);

    return db.prepare('SELECT * FROM series WHERE id = ?').get(numId);

  } else if (table === 'episodes') {
    const cur = db.prepare('SELECT * FROM episodes WHERE id = ?').get(numId);
    if (!cur) throw new Error('Episode not found');

    const title = data.title !== undefined ? String(data.title).trim() : cur.title;
    const episodeNumber = data.episode_number !== undefined ? Number(data.episode_number) : cur.episode_number;
    const filePath = data.path !== undefined ? String(data.path).trim() : cur.path;
    const duration = data.duration !== undefined ? Number(data.duration) : cur.duration;
    const resolution = data.resolution !== undefined ? data.resolution : cur.resolution;

    db.prepare(`
      UPDATE episodes SET 
        title = ?, episode_number = ?, path = ?, 
        duration = ?, resolution = ?
      WHERE id = ?
    `).run(title, episodeNumber, filePath, duration, resolution, numId);

    return db.prepare('SELECT * FROM episodes WHERE id = ?').get(numId);

  } else if (table === 'tracks') {
    const cur = db.prepare('SELECT * FROM tracks WHERE id = ?').get(numId);
    if (!cur) throw new Error('Track not found');

    const title = data.title !== undefined ? String(data.title).trim() : cur.title;
    const trackNumber = data.track_number !== undefined ? Number(data.track_number) : cur.track_number;
    const filePath = data.path !== undefined ? String(data.path).trim() : cur.path;
    const genre = data.genre !== undefined ? data.genre : cur.genre;
    const libraryId = data.library_id !== undefined ? (Number(data.library_id) || null) : cur.library_id;
    const duration = data.duration !== undefined ? Number(data.duration) : cur.duration;

    db.prepare(`
      UPDATE tracks SET 
        title = ?, track_number = ?, path = ?, 
        genre = ?, library_id = ?, duration = ?
      WHERE id = ?
    `).run(title, trackNumber, filePath, genre, libraryId, duration, numId);

    return db.prepare('SELECT * FROM tracks WHERE id = ?').get(numId);

  } else if (table === 'albums') {
    const cur = db.prepare('SELECT * FROM albums WHERE id = ?').get(numId);
    if (!cur) throw new Error('Album not found');

    const title = data.title !== undefined ? String(data.title).trim() : cur.title;
    const year = data.year !== undefined ? (Number(data.year) || null) : cur.year;
    const libraryId = data.library_id !== undefined ? (Number(data.library_id) || null) : cur.library_id;

    db.prepare(`
      UPDATE albums SET 
        title = ?, year = ?, library_id = ?
      WHERE id = ?
    `).run(title, year, libraryId, numId);

    return db.prepare('SELECT * FROM albums WHERE id = ?').get(numId);

  } else if (table === 'artists') {
    const cur = db.prepare('SELECT * FROM artists WHERE id = ?').get(numId);
    if (!cur) throw new Error('Artist not found');

    const name = data.name !== undefined ? String(data.name).trim() : cur.name;
    const bio = data.bio !== undefined ? data.bio : cur.bio;
    const country = data.country !== undefined ? data.country : cur.country;
    const genre = data.genre !== undefined ? data.genre : cur.genre;
    const libraryId = data.library_id !== undefined ? (Number(data.library_id) || null) : cur.library_id;

    db.prepare(`
      UPDATE artists SET 
        name = ?, bio = ?, country = ?, genre = ?, library_id = ?
      WHERE id = ?
    `).run(name, bio, country, genre, libraryId, numId);

    return db.prepare('SELECT * FROM artists WHERE id = ?').get(numId);

  } else if (table === 'libraries') {
    const cur = db.prepare('SELECT * FROM libraries WHERE id = ?').get(numId);
    if (!cur) throw new Error('Library not found');

    const name = data.name !== undefined ? String(data.name).trim() : cur.name;
    const type = data.type !== undefined ? data.type : cur.type;
    const paths = data.paths !== undefined ? JSON.stringify(data.paths) : cur.paths;
    const icon = data.icon !== undefined ? data.icon : cur.icon;

    db.prepare(`
      UPDATE libraries SET 
        name = ?, type = ?, paths = ?, icon = ?
      WHERE id = ?
    `).run(name, type, paths, icon, numId);

    return db.prepare('SELECT * FROM libraries WHERE id = ?').get(numId);

  } else if (table === 'users') {
    const cur = db.prepare('SELECT * FROM users WHERE id = ?').get(numId);
    if (!cur) throw new Error('User not found');

    const username = data.username !== undefined ? String(data.username).trim() : cur.username;
    const displayName = data.display_name !== undefined ? String(data.display_name).trim() : cur.display_name;
    const role = data.role !== undefined ? data.role : cur.role;
    const allowedLibraries = data.allowed_libraries !== undefined 
      ? (data.allowed_libraries ? JSON.stringify(data.allowed_libraries) : null) 
      : cur.allowed_libraries;
    const canDownload = data.can_download !== undefined ? (data.can_download ? 1 : 0) : cur.can_download;
    const canCast = data.can_cast !== undefined ? (data.can_cast ? 1 : 0) : cur.can_cast;
    const isActive = data.is_active !== undefined ? (data.is_active ? 1 : 0) : cur.is_active;

    let passwordHash = cur.password_hash;
    if (data.password && String(data.password).trim()) {
      passwordHash = bcrypt.hashSync(String(data.password).trim(), 10);
    }

    db.prepare(`
      UPDATE users SET 
        username = ?, display_name = ?, role = ?, allowed_libraries = ?,
        can_download = ?, can_cast = ?, is_active = ?, password_hash = ?
      WHERE id = ?
    `).run(username, displayName, role, allowedLibraries, canDownload, canCast, isActive, passwordHash, numId);

    const updatedUser = db.prepare('SELECT id, username, display_name, avatar, role, allowed_libraries, can_download, can_cast, is_active, created_at, last_login FROM users WHERE id = ?').get(numId);
    return {
      ...updatedUser,
      allowed_libraries: updatedUser.allowed_libraries ? JSON.parse(updatedUser.allowed_libraries) : null
    };
  }

  throw new Error(`Unsupported table: ${table}`);
}

/**
 * 11. Delete Record Directly
 */
export function deleteRecord(table, id, deletePhysicalFile = false) {
  const numId = Number(id);

  if (table === 'movies') {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM images WHERE media_type = 'movie' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM ratings WHERE media_type = 'movie' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM playback_state WHERE media_type = 'movie' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'movie' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'movie' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'movie' AND media_id = ?").run(numId);
      return db.prepare('DELETE FROM movies WHERE id = ?').run(numId);
    });
    return tx();

  } else if (table === 'series') {
    const tx = db.transaction(() => {
      // 1. Get all seasons and episodes for this series
      const seasons = db.prepare('SELECT id FROM seasons WHERE series_id = ?').all(numId);
      const seasonIds = seasons.map(s => s.id);

      if (seasonIds.length > 0) {
        const sPlaceholders = seasonIds.map(() => '?').join(',');
        const episodes = db.prepare(`SELECT id FROM episodes WHERE season_id IN (${sPlaceholders})`).all(...seasonIds);
        const episodeIds = episodes.map(e => e.id);

        if (episodeIds.length > 0) {
          const epPlaceholders = episodeIds.map(() => '?').join(',');
          db.prepare(`DELETE FROM playback_state WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
          db.prepare(`DELETE FROM media_tags WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
          db.prepare(`DELETE FROM collection_items WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
          db.prepare(`DELETE FROM user_favorites WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
          db.prepare(`DELETE FROM images WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
          db.prepare(`DELETE FROM episodes WHERE id IN (${epPlaceholders})`).run(...episodeIds);
        }

        db.prepare(`DELETE FROM images WHERE media_type = 'season' AND media_id IN (${sPlaceholders})`).run(...seasonIds);
        db.prepare(`DELETE FROM media_tags WHERE media_type = 'season' AND media_id IN (${sPlaceholders})`).run(...seasonIds);
        db.prepare(`DELETE FROM collection_items WHERE media_type = 'season' AND media_id IN (${sPlaceholders})`).run(...seasonIds);
        db.prepare(`DELETE FROM user_favorites WHERE media_type = 'season' AND media_id IN (${sPlaceholders})`).run(...seasonIds);
        db.prepare(`DELETE FROM seasons WHERE id IN (${sPlaceholders})`).run(...seasonIds);
      }

      db.prepare("DELETE FROM images WHERE media_type = 'series' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM ratings WHERE media_type = 'series' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM playback_state WHERE media_type = 'series' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'series' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'series' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'series' AND media_id = ?").run(numId);
      return db.prepare('DELETE FROM series WHERE id = ?').run(numId);
    });
    return tx();

  } else if (table === 'seasons') {
    const tx = db.transaction(() => {
      const episodes = db.prepare('SELECT id FROM episodes WHERE season_id = ?').all(numId);
      const episodeIds = episodes.map(e => e.id);
      if (episodeIds.length > 0) {
        const epPlaceholders = episodeIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM playback_state WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
        db.prepare(`DELETE FROM media_tags WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
        db.prepare(`DELETE FROM collection_items WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
        db.prepare(`DELETE FROM user_favorites WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
        db.prepare(`DELETE FROM images WHERE media_type = 'episode' AND media_id IN (${epPlaceholders})`).run(...episodeIds);
        db.prepare(`DELETE FROM episodes WHERE id IN (${epPlaceholders})`).run(...episodeIds);
      }
      db.prepare("DELETE FROM images WHERE media_type = 'season' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'season' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'season' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'season' AND media_id = ?").run(numId);
      const r = db.prepare('DELETE FROM seasons WHERE id = ?').run(numId);
      cleanupEmptySeries();
      return r;
    });
    return tx();

  } else if (table === 'episodes') {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM playback_state WHERE media_type = 'episode' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'episode' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'episode' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'episode' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM images WHERE media_type = 'episode' AND media_id = ?").run(numId);
      const r = db.prepare('DELETE FROM episodes WHERE id = ?').run(numId);
      cleanupEmptySeasons();
      cleanupEmptySeries();
      return r;
    });
    return tx();

  } else if (table === 'albums') {
    const tx = db.transaction(() => {
      const tracks = db.prepare('SELECT id FROM tracks WHERE album_id = ?').all(numId);
      const trackIds = tracks.map(t => t.id);

      if (trackIds.length > 0) {
        const trPlaceholders = trackIds.map(() => '?').join(',');
        db.prepare(`DELETE FROM playback_state WHERE media_type = 'track' AND media_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM playlist_items WHERE track_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM media_tags WHERE media_type = 'track' AND media_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM collection_items WHERE media_type = 'track' AND media_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM user_favorites WHERE media_type = 'track' AND media_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM images WHERE media_type = 'track' AND media_id IN (${trPlaceholders})`).run(...trackIds);
        db.prepare(`DELETE FROM tracks WHERE id IN (${trPlaceholders})`).run(...trackIds);
      }

      db.prepare("DELETE FROM images WHERE media_type = 'album' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM ratings WHERE media_type = 'album' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM playback_state WHERE media_type = 'album' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'album' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'album' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'album' AND media_id = ?").run(numId);
      const r = db.prepare('DELETE FROM albums WHERE id = ?').run(numId);
      cleanupEmptyArtists();
      return r;
    });
    return tx();

  } else if (table === 'tracks') {
    const tx = db.transaction(() => {
      db.prepare("DELETE FROM playback_state WHERE media_type = 'track' AND media_id = ?").run(numId);
      db.prepare('DELETE FROM playlist_items WHERE track_id = ?').run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'track' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'track' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'track' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM images WHERE media_type = 'track' AND media_id = ?").run(numId);
      const r = db.prepare('DELETE FROM tracks WHERE id = ?').run(numId);
      cleanupEmptyAlbums();
      cleanupEmptyArtists();
      return r;
    });
    return tx();

  } else if (table === 'artists') {
    const tx = db.transaction(() => {
      const albums = db.prepare('SELECT id FROM albums WHERE artist_id = ?').all(numId);
      for (const al of albums) {
        deleteRecord('albums', al.id, false);
      }
      db.prepare("DELETE FROM images WHERE media_type = 'artist' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM ratings WHERE media_type = 'artist' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM media_tags WHERE media_type = 'artist' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM collection_items WHERE media_type = 'artist' AND media_id = ?").run(numId);
      db.prepare("DELETE FROM user_favorites WHERE media_type = 'artist' AND media_id = ?").run(numId);
      return db.prepare('DELETE FROM artists WHERE id = ?').run(numId);
    });
    return tx();

  } else if (table === 'libraries') {
    return db.prepare('DELETE FROM libraries WHERE id = ?').run(numId);

  } else if (table === 'users') {
    return db.prepare('DELETE FROM users WHERE id = ?').run(numId);
  }

  throw new Error(`Unsupported table: ${table}`);
}

/**
 * 12. Batch Remap Paths (e.g. changing drive letter or parent folder)
 */
export function remapPathPrefix(oldPrefix, newPrefix, tables = ['movies', 'episodes', 'tracks']) {
  if (!oldPrefix || !newPrefix) {
    throw new Error('Both oldPrefix and newPrefix are required');
  }

  const cleanOld = oldPrefix.trim();
  const cleanNew = newPrefix.trim();
  const result = { updatedCounts: {}, totalUpdated: 0 };

  const tx = db.transaction(() => {
    for (const tbl of tables) {
      if (!['movies', 'episodes', 'tracks'].includes(tbl)) continue;

      // Select matching items
      const items = db.prepare(`SELECT id, path FROM ${tbl} WHERE path LIKE ?`).all(`${cleanOld}%`);
      let count = 0;
      const updateStmt = db.prepare(`UPDATE ${tbl} SET path = ? WHERE id = ?`);

      for (const item of items) {
        const newPath = cleanNew + item.path.slice(cleanOld.length);
        updateStmt.run(newPath, item.id);
        count++;
      }

      result.updatedCounts[tbl] = count;
      result.totalUpdated += count;
    }
  });

  tx();
  return result;
}

/**
 * 13. Batch Reassign Library
 */
export function batchUpdateLibrary(table, ids = [], newLibraryId) {
  if (!Array.isArray(ids) || ids.length === 0) return { updated: 0 };
  const validTables = ['movies', 'series', 'tracks', 'albums', 'artists'];
  if (!validTables.includes(table)) throw new Error(`Invalid table: ${table}`);

  const libId = newLibraryId ? Number(newLibraryId) : null;
  const placeholders = ids.map(() => '?').join(',');
  const res = db.prepare(`UPDATE ${table} SET library_id = ? WHERE id IN (${placeholders})`).run(libId, ...ids);

  return { updated: res.changes };
}

/**
 * 14. Batch Delete Records
 */
export function batchDeleteRecords(table, ids = []) {
  if (!Array.isArray(ids) || ids.length === 0) return { deleted: 0 };
  let count = 0;
  for (const id of ids) {
    try {
      deleteRecord(table, id, false);
      count++;
    } catch {}
  }
  return { deleted: count };
}

/**
 * 15. Get Full Library Contents
 */
export function getLibraryContents(libraryId, options = {}) {
  const libId = Number(libraryId);
  const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(libId);
  if (!lib) throw new Error('Library not found');

  let paths = [];
  try { paths = JSON.parse(lib.paths); } catch {}

  const {
    search = '',
    page = 1,
    limit = 50,
    missingOnly = false
  } = options;

  const offset = Math.max(0, (Number(page) - 1) * Number(limit));
  let items = [];
  let totalCount = 0;

  if (lib.type === 'movies') {
    let whereClauses = ['movies.library_id = ?'];
    const params = [libId];
    if (search && search.trim()) {
      whereClauses.push('(movies.title LIKE ? OR movies.path LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q);
    }
    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM movies WHERE ${whereSql}`).get(...params).c;
    const rows = db.prepare(`
      SELECT movies.*, 'movie' as mediaType
      FROM movies
      WHERE ${whereSql}
      ORDER BY movies.title ASC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(m => ({
      ...m,
      exists: checkFileExists(m.path)
    }));

  } else if (lib.type === 'shows') {
    let whereClauses = ['series.library_id = ?'];
    const params = [libId];
    if (search && search.trim()) {
      whereClauses.push('(series.title LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q);
    }
    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`SELECT COUNT(*) as c FROM series WHERE ${whereSql}`).get(...params).c;
    const rows = db.prepare(`
      SELECT series.*, 'series' as mediaType,
        (SELECT COUNT(*) FROM seasons WHERE series_id = series.id) as seasonsCount,
        (SELECT COUNT(episodes.id) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) as episodesCount
      FROM series
      WHERE ${whereSql}
      ORDER BY series.title ASC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(s => {
      const episodes = db.prepare(`
        SELECT episodes.*, seasons.season_number 
        FROM episodes 
        JOIN seasons ON seasons.id = episodes.season_id 
        WHERE seasons.series_id = ?
        ORDER BY seasons.season_number ASC, episodes.episode_number ASC
      `).all(s.id).map(ep => ({
        ...ep,
        exists: checkFileExists(ep.path)
      }));
      const anyMissing = episodes.some(e => !e.exists);
      return {
        ...s,
        episodes,
        exists: !anyMissing
      };
    });

  } else if (lib.type === 'music') {
    let whereClauses = ['tracks.library_id = ?'];
    const params = [libId];
    if (search && search.trim()) {
      whereClauses.push('(tracks.title LIKE ? OR albums.title LIKE ? OR artists.name LIKE ?)');
      const q = `%${search.trim()}%`;
      params.push(q, q, q);
    }
    const whereSql = whereClauses.join(' AND ');
    totalCount = db.prepare(`
      SELECT COUNT(*) as c 
      FROM tracks 
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE ${whereSql}
    `).get(...params).c;

    const rows = db.prepare(`
      SELECT tracks.*, albums.title as albumTitle, artists.name as artistName, 'track' as mediaType
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE ${whereSql}
      ORDER BY tracks.title ASC
      LIMIT ? OFFSET ?
    `).all(...params, Number(limit), offset);

    items = rows.map(t => ({
      ...t,
      exists: checkFileExists(t.path)
    }));
  }

  if (missingOnly) {
    items = items.filter(i => !i.exists);
  }

  return {
    library: { ...lib, paths },
    items,
    totalCount,
    page: Number(page),
    pageSize: Number(limit),
    totalPages: Math.ceil(totalCount / Number(limit))
  };
}

/**
 * 16. Clear all media belonging to a library
 */
export function clearLibraryContents(libraryId) {
  const libId = Number(libraryId);
  const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(libId);
  if (!lib) throw new Error('Library not found');

  let deletedCount = 0;
  const tx = db.transaction(() => {
    if (lib.type === 'movies') {
      const movies = db.prepare('SELECT id FROM movies WHERE library_id = ?').all(libId);
      for (const m of movies) {
        deleteRecord('movies', m.id, false);
        deletedCount++;
      }
    } else if (lib.type === 'shows') {
      const seriesList = db.prepare('SELECT id FROM series WHERE library_id = ?').all(libId);
      for (const s of seriesList) {
        deleteRecord('series', s.id, false);
        deletedCount++;
      }
    } else if (lib.type === 'music') {
      const tracks = db.prepare('SELECT id FROM tracks WHERE library_id = ?').all(libId);
      for (const t of tracks) {
        deleteRecord('tracks', t.id, false);
        deletedCount++;
      }
      cleanupEmptyAlbums();
      cleanupEmptyArtists();
    }
  });

  tx();
  return { libraryId: libId, deletedCount };
}

/**
 * 17. Create User Direct in Database
 */
export function createUserDirect({ username, password, display_name, role = 'user', allowed_libraries = null, can_download = 1, can_cast = 1, is_active = 1 }) {
  if (!username || !username.trim()) throw new Error('Username is required');
  if (!password || !password.trim()) throw new Error('Password is required');

  const existing = db.prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (existing) throw new Error('Username already exists');

  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  const res = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, role, allowed_libraries, can_download, can_cast, is_active)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    username.trim(),
    passwordHash,
    display_name ? display_name.trim() : username.trim(),
    role,
    allowed_libraries ? JSON.stringify(allowed_libraries) : null,
    can_download ? 1 : 0,
    can_cast ? 1 : 0,
    is_active ? 1 : 0
  );

  const newUser = db.prepare('SELECT id, username, display_name, avatar, role, allowed_libraries, can_download, can_cast, is_active, created_at, last_login FROM users WHERE id = ?').get(res.lastInsertRowid);
  return {
    ...newUser,
    allowed_libraries: newUser.allowed_libraries ? JSON.parse(newUser.allowed_libraries) : null
  };
}
