import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const appData = process.env.APPDATA || (process.platform === 'darwin' ? process.env.HOME + '/Library/Preferences' : process.env.HOME + "/.local/share");
const dbDir = path.join(appData, 'ARN_Stream', 'data');
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

/**
 * Returns the writable user data directory (%APPDATA%/ARN_Stream/data).
 * Must be used instead of process.cwd()/data for all writable data (avatars, tmp, cache).
 */
export function getDataDir() {
  return dbDir;
}

const dbPath = path.join(dbDir, 'media.db');
const cleanCandidate = path.join(dbDir, 'media_clean.db');

// Auto-apply clean repaired database if one was prepared
if (fs.existsSync(cleanCandidate)) {
  try {
    const testClean = new Database(cleanCandidate, { readonly: true });
    const checkRes = testClean.prepare('PRAGMA integrity_check').get();
    testClean.close();
    if (checkRes && checkRes.integrity_check === 'ok') {
      const backupPath = path.join(dbDir, `media.db.backup_corrupt_${Date.now()}`);
      if (fs.existsSync(dbPath)) {
        try { fs.copyFileSync(dbPath, backupPath); } catch {}
      }
      try {
        fs.copyFileSync(cleanCandidate, dbPath);
        try { fs.unlinkSync(dbPath + '-wal'); } catch {}
        try { fs.unlinkSync(dbPath + '-shm'); } catch {}
        try { fs.unlinkSync(cleanCandidate); } catch {}
        console.log('✅ [Database] تم استبدال قاعدة البيانات بنسخة سليمة ونظيفة 100% بنجاح.');
      } catch (swapErr) {
        console.warn('[Database] تنبيه تعذر استبدال ملف قاعدة البيانات فوراً:', swapErr.message);
      }
    }
  } catch (err) {
    console.warn('[Database] تنبيه فحص النسخة النظيفة:', err.message);
  }
}

const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Self-healing: if an index is malformed, reindex automatically
try {
  const quick = db.prepare('PRAGMA quick_check').get();
  if (quick && quick.quick_check !== 'ok') {
    console.warn('⚠️ [Database] رصد خطأ في فهارس قاعدة البيانات:', quick.quick_check, '- جاري الإصلاح الذاتي عبر REINDEX...');
    db.exec('REINDEX;');
    console.log('✅ [Database] تم استرجاع وإعادة بناء الفهارس بنجاح.');
  }
} catch (e) {
  console.warn('[Database] تنبيه الفحص السريع:', e.message);
}

export function normalizeArabic(text) {
  if (!text || typeof text !== 'string') return '';
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

db.function('norm_ar', (str) => normalizeArabic(str));

// Schema
const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  role TEXT DEFAULT 'user',
  allowed_libraries TEXT,
  is_active BOOLEAN DEFAULT 1,
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  plot TEXT,
  path TEXT UNIQUE NOT NULL,
  duration INTEGER,
  resolution TEXT,
  video_codec TEXT,
  audio_codec TEXT,
  tmdb_id INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS series (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  year INTEGER,
  plot TEXT,
  tmdb_id INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS seasons (
  id INTEGER PRIMARY KEY,
  series_id INTEGER REFERENCES series(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  UNIQUE(series_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY,
  season_id INTEGER REFERENCES seasons(id) ON DELETE CASCADE,
  episode_number INTEGER NOT NULL,
  title TEXT,
  path TEXT UNIQUE NOT NULL,
  duration INTEGER,
  resolution TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS artists (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS albums (
  id INTEGER PRIMARY KEY,
  artist_id INTEGER REFERENCES artists(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  year INTEGER,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(artist_id, title)
);

CREATE TABLE IF NOT EXISTS tracks (
  id INTEGER PRIMARY KEY,
  album_id INTEGER REFERENCES albums(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  track_number INTEGER,
  duration INTEGER,
  path TEXT UNIQUE NOT NULL,
  play_count INTEGER DEFAULT 0,
  last_played_at DATETIME,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS images (
  id INTEGER PRIMARY KEY,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  image_type TEXT NOT NULL,
  source TEXT NOT NULL,
  local_path TEXT,
  cached_path TEXT,
  thumbnail_path TEXT,
  is_primary BOOLEAN DEFAULT 0,
  width INTEGER,
  height INTEGER,
  file_size INTEGER,
  hash TEXT,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS image_sources (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  folder_path TEXT NOT NULL,
  image_types TEXT,
  priority INTEGER DEFAULT 0,
  enabled BOOLEAN DEFAULT 1
);

CREATE TABLE IF NOT EXISTS playback_state (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  position INTEGER,
  duration INTEGER,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  rating REAL NOT NULL,
  review TEXT,
  rated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS tags (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  color TEXT DEFAULT '#3B82F6',
  icon TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS media_tags (
  id INTEGER PRIMARY KEY,
  tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  tagged_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tag_id, media_type, media_id)
);

CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_id INTEGER REFERENCES images(id),
  type TEXT DEFAULT 'manual',
  rules TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS collection_items (
  id INTEGER PRIMARY KEY,
  collection_id INTEGER REFERENCES collections(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  position INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlists (
  id INTEGER PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_image_id INTEGER REFERENCES images(id),
  type TEXT NOT NULL,
  rules TEXT,
  play_count INTEGER DEFAULT 0,
  last_played_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id INTEGER PRIMARY KEY,
  playlist_id INTEGER REFERENCES playlists(id) ON DELETE CASCADE,
  track_id INTEGER REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX IF NOT EXISTS idx_movies_year ON movies(year);
CREATE INDEX IF NOT EXISTS idx_episodes_season ON episodes(season_id);
CREATE INDEX IF NOT EXISTS idx_tracks_album ON tracks(album_id);
CREATE INDEX IF NOT EXISTS idx_albums_artist ON albums(artist_id);
CREATE INDEX IF NOT EXISTS idx_images_media ON images(media_type, media_id, image_type);
CREATE INDEX IF NOT EXISTS idx_images_primary ON images(media_type, media_id, image_type, is_primary);
CREATE INDEX IF NOT EXISTS idx_images_hash ON images(hash);
CREATE INDEX IF NOT EXISTS idx_media_tags_lookup ON media_tags(media_type, media_id);
CREATE INDEX IF NOT EXISTS idx_media_tags_tag ON media_tags(tag_id);
CREATE INDEX IF NOT EXISTS idx_collection_items ON collection_items(collection_id, position);
CREATE INDEX IF NOT EXISTS idx_playlist_items ON playlist_items(playlist_id, position);
CREATE INDEX IF NOT EXISTS idx_playback_state ON playback_state(media_type, media_id);

CREATE TABLE IF NOT EXISTS libraries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL, -- 'movies' | 'shows' | 'music'
  paths TEXT NOT NULL, -- JSON array of folder paths
  icon TEXT DEFAULT 'folder',
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
`;

db.exec(schema);

// Perform migration if needed
try {
  db.exec('ALTER TABLE playlists ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE CASCADE');
} catch (e) {
  // Column might already exist, ignore
}

// Now create the index
db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_library ON playlists(library_id);');

// Migrations for custom libraries support
try { db.exec('ALTER TABLE libraries ADD COLUMN custom_covers TEXT DEFAULT NULL'); } catch {}
try { db.exec('ALTER TABLE movies ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL'); } catch {}
try { db.exec('ALTER TABLE series ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL'); } catch {}
try { db.exec('ALTER TABLE artists ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL'); } catch {}
try { db.exec('ALTER TABLE albums ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL'); } catch {}
try { db.exec('ALTER TABLE tracks ADD COLUMN library_id INTEGER REFERENCES libraries(id) ON DELETE SET NULL'); } catch {}
try { db.exec('ALTER TABLE series ADD COLUMN year INTEGER'); } catch {}
try { db.exec('ALTER TABLE seasons ADD COLUMN title TEXT'); } catch {}
try { db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_series_title_library ON series(title, library_id);'); } catch {}
try { db.exec('ALTER TABLE seasons ADD COLUMN plot TEXT'); } catch {}
try { db.exec('ALTER TABLE seasons ADD COLUMN year INTEGER'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_movies_library ON movies(library_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_series_library ON series(library_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_artists_library ON artists(library_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_albums_library ON albums(library_id)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_library ON tracks(library_id)'); } catch {}
try { db.exec('ALTER TABLE artists ADD COLUMN bio TEXT'); } catch {}
try { db.exec('ALTER TABLE artists ADD COLUMN country TEXT'); } catch {}
try { db.exec('ALTER TABLE artists ADD COLUMN genre TEXT'); } catch {}

// Music system enhancements
try { db.exec('ALTER TABLE tracks ADD COLUMN is_favorite BOOLEAN DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tracks ADD COLUMN rating INTEGER DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE tracks ADD COLUMN lyrics TEXT'); } catch {}
try { db.exec('ALTER TABLE tracks ADD COLUMN genre TEXT'); } catch {}
try { db.exec('ALTER TABLE playlists ADD COLUMN is_shared BOOLEAN DEFAULT 0'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_favorite ON tracks(is_favorite)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_play_count ON tracks(play_count)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_last_played ON tracks(last_played_at)'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_genre ON tracks(genre)'); } catch {}

// Clean duplicates and enforce unique path constraints for scanner ON CONFLICT
try {
  db.exec(`
    DELETE FROM movies WHERE id NOT IN (SELECT MIN(id) FROM movies GROUP BY path);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_movies_path_unique ON movies(path);
  `);
} catch (e) { console.error('Migration error (movies unique path):', e.message); }

try {
  db.exec(`
    DELETE FROM episodes WHERE id NOT IN (SELECT MIN(id) FROM episodes GROUP BY path);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_episodes_path_unique ON episodes(path);
  `);
} catch (e) { console.error('Migration error (episodes unique path):', e.message); }

try {
  db.exec(`
    DELETE FROM tracks WHERE id NOT IN (SELECT MIN(id) FROM tracks GROUP BY path);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_tracks_path_unique ON tracks(path);
  `);
} catch (e) { console.error('Migration error (tracks unique path):', e.message); }

// Users & Permissions (RBAC) System
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  avatar TEXT,
  role TEXT NOT NULL DEFAULT 'user',
  allowed_libraries TEXT DEFAULT NULL,
  can_download BOOLEAN DEFAULT 1,
  can_cast BOOLEAN DEFAULT 1,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_login DATETIME
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL,
  media_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(user_id, media_type, media_id)
);
`);

try { db.exec('ALTER TABLE users ADD COLUMN can_download BOOLEAN DEFAULT 1;'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN can_cast BOOLEAN DEFAULT 1;'); } catch {}
try { db.exec('ALTER TABLE users ADD COLUMN show_on_login BOOLEAN DEFAULT 1;'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_user_favorites ON user_favorites(user_id, media_type);'); } catch {}
try { db.exec('ALTER TABLE playlists ADD COLUMN user_id INTEGER REFERENCES users(id) ON DELETE CASCADE;'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_playlists_user ON playlists(user_id);'); } catch {}
try { db.exec('ALTER TABLE playback_state ADD COLUMN user_id INTEGER DEFAULT 1 REFERENCES users(id) ON DELETE CASCADE;'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_playback_state_user ON playback_state(user_id, media_type, media_id);'); } catch {}

// ─── Performance indexes for search & sorting ───────────────────────────────
// Critical for norm_ar() LIKE queries and ORDER BY patterns
try { db.exec('CREATE INDEX IF NOT EXISTS idx_movies_title ON movies(title);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_movies_added ON movies(added_at DESC);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_series_title ON series(title);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_series_added ON series(added_at DESC);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_seasons_series ON seasons(series_id, season_number);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_episodes_added ON episodes(added_at DESC);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_albums_title ON albums(title);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_tracks_title ON tracks(title);'); } catch {}
try { db.exec('CREATE INDEX IF NOT EXISTS idx_playback_state_updated ON playback_state(updated_at DESC);'); } catch {}

export function getSetting(key, defaultValue = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

export function setSetting(key, value) {
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, value === null || value === undefined ? null : String(value));
}

export function getAllSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const settings = {};
  for (const r of rows) settings[r.key] = r.value;
  return settings;
}

export function getLibraryFolders(type) {
  const raw = getSetting(`${type}_paths`);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.filter(p => typeof p === 'string' && p.trim().length > 0);
      }
    } catch {}
  }
  const single = getSetting(`${type}_path`) || process.env[`${type.toUpperCase()}_PATH`];
  return single && single.trim() ? [single.trim()] : [];
}

export function setLibraryFolders(type, paths) {
  const list = Array.isArray(paths)
    ? Array.from(new Set(paths.map(p => typeof p === 'string' ? p.trim() : '').filter(Boolean)))
    : [];
  setSetting(`${type}_paths`, JSON.stringify(list));
  setSetting(`${type}_path`, list[0] || '');
  return list;
}

export function cleanupEmptySeries() {
  try {
    const res = db.prepare(`
      DELETE FROM series 
      WHERE id NOT IN (
        SELECT DISTINCT series_id 
        FROM seasons 
        JOIN episodes ON episodes.season_id = seasons.id
      )
    `).run();
    if (res.changes > 0) {
      console.log(`[DB] Cleaned up ${res.changes} empty series with no episodes.`);
    }
    return res.changes;
  } catch (err) {
    console.error('[DB] Cleanup empty series error:', err);
    return 0;
  }
}

export function cleanupEmptySeasons() {
  try {
    const res = db.prepare(`
      DELETE FROM seasons 
      WHERE id NOT IN (
        SELECT DISTINCT season_id 
        FROM episodes
      )
    `).run();
    if (res.changes > 0) {
      console.log(`[DB] Cleaned up ${res.changes} empty seasons with no episodes.`);
    }
    return res.changes;
  } catch (err) {
    console.error('[DB] Cleanup empty seasons error:', err);
    return 0;
  }
}

export function cleanupEmptyAlbums() {
  try {
    db.prepare(`
      DELETE FROM images 
      WHERE media_type = 'album' 
      AND media_id NOT IN (SELECT DISTINCT album_id FROM tracks WHERE album_id IS NOT NULL)
    `).run();

    const res = db.prepare(`
      DELETE FROM albums 
      WHERE id NOT IN (
        SELECT DISTINCT album_id 
        FROM tracks
        WHERE album_id IS NOT NULL
      )
    `).run();
    if (res.changes > 0) {
      console.log(`[DB] Cleaned up ${res.changes} empty albums with no tracks.`);
    }
    return res.changes;
  } catch (err) {
    console.error('[DB] Cleanup empty albums error:', err);
    return 0;
  }
}

export function cleanupEmptyArtists() {
  try {
    db.prepare(`
      DELETE FROM images 
      WHERE media_type = 'artist' 
      AND media_id NOT IN (
        SELECT DISTINCT albums.artist_id 
        FROM albums
        JOIN tracks ON tracks.album_id = albums.id
        WHERE albums.artist_id IS NOT NULL
      )
    `).run();

    const res = db.prepare(`
      DELETE FROM artists 
      WHERE id NOT IN (
        SELECT DISTINCT albums.artist_id 
        FROM albums
        JOIN tracks ON tracks.album_id = albums.id
        WHERE albums.artist_id IS NOT NULL
      )
    `).run();
    if (res.changes > 0) {
      console.log(`[DB] Cleaned up ${res.changes} empty artists with no tracks.`);
    }
    return res.changes;
  } catch (err) {
    console.error('[DB] Cleanup empty artists error:', err);
    return 0;
  }
}

// Initial cleanup on start
cleanupEmptySeasons();
cleanupEmptySeries();
cleanupEmptyAlbums();
cleanupEmptyArtists();

export function clearMediaData() {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM collection_items').run();
    db.prepare('DELETE FROM playlist_items').run();
    db.prepare('DELETE FROM media_tags').run();
    db.prepare('DELETE FROM ratings').run();
    db.prepare('DELETE FROM playback_state').run();
    db.prepare('DELETE FROM images').run();
    db.prepare('DELETE FROM tracks').run();
    db.prepare('DELETE FROM albums').run();
    db.prepare('DELETE FROM artists').run();
    db.prepare('DELETE FROM episodes').run();
    db.prepare('DELETE FROM seasons').run();
    db.prepare('DELETE FROM series').run();
    db.prepare('DELETE FROM movies').run();
  });
  tx();

  // Clear image caches on disk
  const cacheDirs = [
    path.join(dbDir, 'images_cache'),
    path.join(dbDir, 'covers_cache')
  ];
  for (const cDir of cacheDirs) {
    if (fs.existsSync(cDir)) {
      try {
        const files = fs.readdirSync(cDir);
        for (const file of files) {
          try { fs.unlinkSync(path.join(cDir, file)); } catch {}
        }
      } catch {}
    }
  }
}

export function migrateMediaLibraryIds() {
  try {
    const libs = db.prepare('SELECT id, type, paths FROM libraries').all();
    for (const lib of libs) {
      let paths = [];
      try { paths = JSON.parse(lib.paths); } catch {}
      if (!Array.isArray(paths)) continue;

      for (const p of paths) {
        if (!p) continue;
        if (lib.type === 'music') {
          db.prepare(`UPDATE tracks SET library_id = ? WHERE path LIKE ? AND (library_id IS NULL OR library_id != ?)`).run(lib.id, `${p}%`, lib.id);
        } else if (lib.type === 'movies') {
          db.prepare(`UPDATE movies SET library_id = ? WHERE path LIKE ? AND (library_id IS NULL OR library_id != ?)`).run(lib.id, `${p}%`, lib.id);
        }
      }
    }

    // Associate albums with their artists' library_id or tracks' library_id
    db.prepare(`
      UPDATE albums SET library_id = (
        SELECT artists.library_id FROM artists WHERE artists.id = albums.artist_id
      ) WHERE library_id IS NULL
    `).run();

    // Any remaining tracks without library_id get their album's library_id
    db.prepare(`
      UPDATE tracks SET library_id = (
        SELECT albums.library_id FROM albums WHERE albums.id = tracks.album_id
      ) WHERE library_id IS NULL
    `).run();
  } catch (err) {
    console.error('[DB] Migration error:', err.message);
  }
}

migrateMediaLibraryIds();

export function getLibraryPreviewCovers(libId, libType, limit = 4) {
  try {
    let imgs = [];
    if (libType === 'movies') {
      imgs = db.prepare(`
        SELECT images.id FROM images 
        JOIN movies ON movies.id = images.media_id AND images.media_type = 'movie'
        WHERE movies.library_id = ?
          AND images.image_type = 'poster' AND images.is_primary = 1
        ORDER BY movies.added_at DESC
        LIMIT ?
      `).all(libId, limit);

      if (imgs.length < limit) {
        const existingIds = imgs.map(i => i.id);
        const placeholders = existingIds.length ? existingIds.map(() => '?').join(',') : '0';
        const more = db.prepare(`
          SELECT images.id FROM images 
          JOIN movies ON movies.id = images.media_id AND images.media_type = 'movie'
          WHERE movies.library_id = ?
            AND images.image_type = 'poster'
            AND images.id NOT IN (${placeholders})
          ORDER BY movies.added_at DESC
          LIMIT ?
        `).all(libId, ...existingIds, limit - imgs.length);
        imgs = [...imgs, ...more];
      }
    } else if (libType === 'shows') {
      imgs = db.prepare(`
        SELECT images.id FROM images 
        JOIN series ON series.id = images.media_id AND images.media_type = 'series'
        WHERE series.library_id = ?
          AND images.image_type = 'poster' AND images.is_primary = 1
        ORDER BY series.added_at DESC
        LIMIT ?
      `).all(libId, limit);

      if (imgs.length < limit) {
        const existingIds = imgs.map(i => i.id);
        const placeholders = existingIds.length ? existingIds.map(() => '?').join(',') : '0';
        const more = db.prepare(`
          SELECT images.id FROM images 
          JOIN series ON series.id = images.media_id AND images.media_type = 'series'
          WHERE series.library_id = ?
            AND images.image_type = 'poster'
            AND images.id NOT IN (${placeholders})
          ORDER BY series.added_at DESC
          LIMIT ?
        `).all(libId, ...existingIds, limit - imgs.length);
        imgs = [...imgs, ...more];
      }
    } else if (libType === 'music') {
      imgs = db.prepare(`
        SELECT images.id FROM images 
        JOIN albums ON albums.id = images.media_id AND images.media_type = 'album'
        WHERE albums.library_id = ?
          AND images.image_type = 'album_cover' AND images.is_primary = 1
        ORDER BY albums.added_at DESC
        LIMIT ?
      `).all(libId, limit);

      if (imgs.length < limit) {
        const artistImgs = db.prepare(`
          SELECT images.id FROM images
          JOIN artists ON artists.id = images.media_id AND images.media_type = 'artist'
          WHERE artists.library_id = ?
            AND images.is_primary = 1
          ORDER BY artists.added_at DESC
          LIMIT ?
        `).all(libId, limit - imgs.length);
        imgs = [...imgs, ...artistImgs];
      }
    }

    return imgs.map(img => `/api/image/${img.id}/thumb`);
  } catch (err) {
    console.error('[DB] getLibraryPreviewCovers error:', err);
    return [];
  }
}

export function getAllLibraries(onlyNonEmpty = false) {
  const rows = db.prepare('SELECT * FROM libraries ORDER BY sort_order ASC, id ASC').all();
  const enriched = rows.map(lib => {
    let paths = [];
    try { paths = JSON.parse(lib.paths); } catch {}

    let mediaCount = 0;
    if (lib.type === 'movies') {
      mediaCount = db.prepare('SELECT COUNT(*) as c FROM movies WHERE library_id = ?').get(lib.id).c;
    } else if (lib.type === 'shows') {
      mediaCount = db.prepare(`
        SELECT COUNT(DISTINCT series.id) as c 
        FROM series 
        JOIN seasons ON seasons.series_id = series.id 
        JOIN episodes ON episodes.season_id = seasons.id
        WHERE series.library_id = ?
      `).get(lib.id).c;
    } else if (lib.type === 'music') {
      mediaCount = db.prepare(`
        SELECT COUNT(*) as c FROM tracks 
        WHERE library_id = ?
      `).get(lib.id).c;
    }

    let covers = [];
    if (lib.custom_covers) {
      try {
        const parsed = JSON.parse(lib.custom_covers);
        if (Array.isArray(parsed) && parsed.length > 0) covers = parsed;
      } catch {}
    }
    if (!covers || covers.length === 0) {
      covers = getLibraryPreviewCovers(lib.id, lib.type, 5);
    }

    return {
      ...lib,
      paths,
      media_count: mediaCount,
      covers
    };
  });

  if (onlyNonEmpty) {
    return enriched.filter(lib => lib.media_count > 0);
  }
  return enriched;
}

export function getLibraryById(id) {
  const lib = db.prepare('SELECT * FROM libraries WHERE id = ?').get(id);
  if (!lib) return null;
  let paths = [];
  try { paths = JSON.parse(lib.paths); } catch {}

  let mediaCount = 0;
  if (lib.type === 'movies') {
    mediaCount = db.prepare('SELECT COUNT(*) as c FROM movies WHERE library_id = ?').get(lib.id).c;
  } else if (lib.type === 'shows') {
    mediaCount = db.prepare(`
      SELECT COUNT(DISTINCT series.id) as c 
      FROM series 
      JOIN seasons ON seasons.series_id = series.id 
      JOIN episodes ON episodes.season_id = seasons.id
      WHERE series.library_id = ?
    `).get(lib.id).c;
  } else if (lib.type === 'music') {
    mediaCount = db.prepare(`
      SELECT COUNT(*) as c FROM tracks 
      WHERE library_id = ?
    `).get(lib.id).c;
  }

  let covers = [];
  if (lib.custom_covers) {
    try {
      const parsed = JSON.parse(lib.custom_covers);
      if (Array.isArray(parsed) && parsed.length > 0) covers = parsed;
    } catch {}
  }
  if (!covers || covers.length === 0) {
    covers = getLibraryPreviewCovers(lib.id, lib.type, 4);
  }

  return { ...lib, paths, media_count: mediaCount, covers };
}

export function createLibrary(name, type, paths = [], icon = 'folder') {
  const sortOrder = (db.prepare('SELECT MAX(sort_order) as m FROM libraries').get().m || 0) + 1;
  const res = db.prepare('INSERT INTO libraries (name, type, paths, icon, sort_order) VALUES (?, ?, ?, ?, ?)').run(
    name.trim(),
    type,
    JSON.stringify(paths),
    icon,
    sortOrder
  );
  return getLibraryById(res.lastInsertRowid);
}

export function updateLibrary(id, { name, type, paths, icon }) {
  const current = getLibraryById(id);
  if (!current) return null;
  const newName = name !== undefined ? name.trim() : current.name;
  const newType = type !== undefined ? type : current.type;
  const newPaths = paths !== undefined ? JSON.stringify(paths) : JSON.stringify(current.paths);
  const newIcon = icon !== undefined ? icon : current.icon;
  db.prepare('UPDATE libraries SET name = ?, type = ?, paths = ?, icon = ? WHERE id = ?').run(
    newName,
    newType,
    newPaths,
    newIcon,
    id
  );
  return getLibraryById(id);
}

export function deleteLibrary(id) {
  return db.prepare('DELETE FROM libraries WHERE id = ?').run(id);
}

// ----------------------------------------------------
// User Management Functions (RBAC)
// ----------------------------------------------------

export function countUsers() {
  const row = db.prepare('SELECT COUNT(*) as count FROM users').get();
  return row ? row.count : 0;
}

export function findUserById(id) {
  const user = db.prepare('SELECT id, username, display_name, avatar, role, allowed_libraries, can_download, can_cast, show_on_login, is_active, created_at, last_login FROM users WHERE id = ?').get(id);
  if (!user) return null;
  return {
    ...user,
    allowed_libraries: user.allowed_libraries ? JSON.parse(user.allowed_libraries) : null,
    can_download: user.can_download === null || user.can_download === undefined ? true : Boolean(user.can_download),
    can_cast: user.can_cast === null || user.can_cast === undefined ? true : Boolean(user.can_cast),
    show_on_login: user.show_on_login === null || user.show_on_login === undefined ? true : Boolean(user.show_on_login),
    is_active: Boolean(user.is_active)
  };
}

export function findUserByUsername(username) {
  if (!username) return null;
  const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username.trim());
  if (!user) return null;
  return {
    ...user,
    allowed_libraries: user.allowed_libraries ? JSON.parse(user.allowed_libraries) : null,
    can_download: user.can_download === null || user.can_download === undefined ? true : Boolean(user.can_download),
    can_cast: user.can_cast === null || user.can_cast === undefined ? true : Boolean(user.can_cast),
    show_on_login: user.show_on_login === null || user.show_on_login === undefined ? true : Boolean(user.show_on_login),
    is_active: Boolean(user.is_active)
  };
}

export function getAllUsers() {
  const rows = db.prepare('SELECT id, username, display_name, avatar, role, allowed_libraries, can_download, can_cast, show_on_login, is_active, created_at, last_login FROM users ORDER BY id ASC').all();
  return rows.map(u => ({
    ...u,
    allowed_libraries: u.allowed_libraries ? JSON.parse(u.allowed_libraries) : null,
    can_download: u.can_download === null || u.can_download === undefined ? true : Boolean(u.can_download),
    can_cast: u.can_cast === null || u.can_cast === undefined ? true : Boolean(u.can_cast),
    show_on_login: u.show_on_login === null || u.show_on_login === undefined ? true : Boolean(u.show_on_login),
    is_active: Boolean(u.is_active)
  }));
}

export function createUser({ 
  username, 
  password_hash, 
  display_name, 
  avatar, 
  role = 'user', 
  allowed_libraries = null,
  can_download = 1,
  can_cast = 1,
  show_on_login = 1
}) {
  const res = db.prepare(`
    INSERT INTO users (username, password_hash, display_name, avatar, role, allowed_libraries, can_download, can_cast, show_on_login)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    username.trim(),
    password_hash,
    display_name ? display_name.trim() : username.trim(),
    avatar || null,
    role || 'user',
    allowed_libraries ? JSON.stringify(allowed_libraries) : null,
    can_download === false || can_download === 0 ? 0 : 1,
    can_cast === false || can_cast === 0 ? 0 : 1,
    show_on_login === false || show_on_login === 0 ? 0 : 1
  );
  return findUserById(res.lastInsertRowid);
}

export function updateUser(id, updates = {}) {
  const current = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!current) return null;

  const username = updates.username !== undefined ? updates.username.trim() : current.username;
  const password_hash = updates.password_hash !== undefined ? updates.password_hash : current.password_hash;
  const display_name = updates.display_name !== undefined ? updates.display_name.trim() : current.display_name;
  const avatar = updates.avatar !== undefined ? updates.avatar : current.avatar;
  const role = updates.role !== undefined ? updates.role : current.role;
  const allowed_libraries = updates.allowed_libraries !== undefined 
    ? (updates.allowed_libraries ? JSON.stringify(updates.allowed_libraries) : null) 
    : current.allowed_libraries;
  const can_download = updates.can_download !== undefined 
    ? (updates.can_download ? 1 : 0) 
    : (current.can_download === null || current.can_download === undefined ? 1 : current.can_download);
  const can_cast = updates.can_cast !== undefined 
    ? (updates.can_cast ? 1 : 0) 
    : (current.can_cast === null || current.can_cast === undefined ? 1 : current.can_cast);
  const show_on_login = updates.show_on_login !== undefined 
    ? (updates.show_on_login ? 1 : 0) 
    : (current.show_on_login === null || current.show_on_login === undefined ? 1 : current.show_on_login);
  const is_active = updates.is_active !== undefined ? (updates.is_active ? 1 : 0) : current.is_active;
  const last_login = updates.last_login !== undefined ? updates.last_login : current.last_login;

  db.prepare(`
    UPDATE users SET 
      username = ?, password_hash = ?, display_name = ?, avatar = ?, 
      role = ?, allowed_libraries = ?, can_download = ?, can_cast = ?, 
      show_on_login = ?, is_active = ?, last_login = ?
    WHERE id = ?
  `).run(username, password_hash, display_name, avatar, role, allowed_libraries, can_download, can_cast, show_on_login, is_active, last_login, id);

  return findUserById(id);
}

export function deleteUser(id) {
  return db.prepare('DELETE FROM users WHERE id = ?').run(id);
}

export default db;
export { dbPath };


