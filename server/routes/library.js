import express from 'express';
import fs from 'fs';
import db, { getAllLibraries } from '../db.js';
import { requireAuth } from '../services/auth.js';

const router = express.Router();

// Require authentication for all library views
router.use(requireAuth);

router.get('/landing', (req, res) => {
  let libraries = getAllLibraries(false);
  if (req.user && req.user.role !== 'admin' && Array.isArray(req.user.allowed_libraries)) {
    libraries = libraries.filter(l => req.user.allowed_libraries.includes(l.id));
  }
  const moviesCount = db.prepare('SELECT COUNT(*) as c FROM movies').get().c;
  const episodesCount = db.prepare('SELECT COUNT(*) as c FROM episodes').get().c;
  const seriesCount = db.prepare('SELECT COUNT(*) as c FROM series').get().c;
  const tracksCount = db.prepare('SELECT COUNT(*) as c FROM tracks').get().c;
  const artistsCount = db.prepare('SELECT COUNT(*) as c FROM artists').get().c;
  const albumsCount = db.prepare('SELECT COUNT(*) as c FROM albums').get().c;

  // Recent backdrops for animated background
  const backdrops = db.prepare(`SELECT * FROM images WHERE image_type = 'backdrop' LIMIT 5`).all();

  // Recently added media (movies & series) - strictly real files that exist on disk
  const candidateMovies = db.prepare(`
    SELECT id, title, year, added_at, path, 'movie' as media_type 
    FROM movies 
    WHERE path IS NOT NULL 
    ORDER BY added_at DESC 
    LIMIT 30
  `).all();

  const validMovies = candidateMovies.filter(m => {
    try {
      return m.path && fs.existsSync(m.path);
    } catch {
      return false;
    }
  });

  const candidateSeries = db.prepare(`
    SELECT series.id, series.title, series.year, series.added_at, 'series' as media_type
    FROM series
    WHERE EXISTS (
      SELECT 1 FROM seasons 
      JOIN episodes ON episodes.season_id = seasons.id 
      WHERE seasons.series_id = series.id
    )
    ORDER BY series.added_at DESC 
    LIMIT 25
  `).all();

  const validSeries = candidateSeries.filter(s => {
    try {
      const episodes = db.prepare(`
        SELECT episodes.path 
        FROM episodes 
        JOIN seasons ON seasons.id = episodes.season_id 
        WHERE seasons.series_id = ? 
        LIMIT 6
      `).all(s.id);
      return episodes.some(ep => ep.path && fs.existsSync(ep.path));
    } catch {
      return false;
    }
  });
  
  const withImage = (item) => {
    let img;
    if (item.media_type === 'album') {
      img = db.prepare(`SELECT id FROM images WHERE media_type = 'album' AND media_id = ? AND image_type = 'album_cover' AND is_primary = 1 LIMIT 1`).get(item.id)
        || db.prepare(`SELECT id FROM images WHERE media_type = 'album' AND media_id = ? AND (image_type = 'album_cover' OR image_type = 'poster') LIMIT 1`).get(item.id);
      const url = img ? `/api/image/${img.id}/thumb` : null;
      return { ...item, poster: url, cover: url };
    }
    img = db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster' AND is_primary = 1 LIMIT 1`).get(item.media_type, item.id);
    if (!img) {
      img = db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster' LIMIT 1`).get(item.media_type, item.id);
    }
    const posterUrl = img ? `/api/image/${img.id}/thumb` : null;
    return { ...item, poster: posterUrl, cover: posterUrl };
  };

  const combined = [...validMovies, ...validSeries]
    .sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0))
    .map(withImage)
    .filter(item => Boolean(item.poster));

  // Deduplicate by title & ID to prevent any duplicate/phantom appearances
  const seenTitles = new Set();
  const seenIds = new Set();
  const recentlyAdded = [];

  for (const item of combined) {
    const norm = (item.title || '').trim().toLowerCase();
    const key = `${item.media_type}_${item.id}`;
    if (norm && !seenTitles.has(norm) && !seenIds.has(key)) {
      seenTitles.add(norm);
      seenIds.add(key);
      recentlyAdded.push(item);
    }
    if (recentlyAdded.length >= 16) break;
  }


  const userId = req.user ? req.user.id : 1;
  const continueListeningAll = db.prepare(`
    SELECT tracks.id as trackId, albums.id as albumId, artists.id as artistId,
           tracks.title, albums.title as albumTitle, artists.name as artistName,
           playback_state.position, playback_state.duration, playback_state.updated_at
    FROM playback_state
    JOIN tracks ON playback_state.media_id = tracks.id
    JOIN albums ON tracks.album_id = albums.id
    JOIN artists ON albums.artist_id = artists.id
    WHERE playback_state.user_id = ? 
      AND (playback_state.media_type = 'track' OR playback_state.media_type = 'audio')
      AND playback_state.position > 0
    ORDER BY playback_state.updated_at DESC LIMIT 15
  `).all(userId).map(c => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type = 'album' AND media_id = ? AND image_type = 'album_cover' AND is_primary = 1 LIMIT 1`).get(c.albumId);
    return {
      ...c,
      media_type: 'audio',
      type: 'audio',
      id: c.trackId,
      poster: img ? `/api/image/${img.id}/thumb` : null,
      progress: c.duration ? (c.position / c.duration) * 100 : 0
    };
  });

  const latestAudio = db.prepare(`
    SELECT albums.*, artists.name as artistName FROM albums
    JOIN artists ON artists.id = albums.artist_id
    ORDER BY albums.added_at DESC LIMIT 15
  `).all().map(al => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(al.id);
    return { 
      ...al, 
      type: 'album', 
      media_type: 'album', 
      poster: img ? `/api/image/${img.id}/thumb` : null
    };
  });


  const continueWatchingMovies = db.prepare(`
    SELECT playback_state.id as playbackId, playback_state.position, playback_state.duration, playback_state.updated_at,
           movies.id, movies.title, movies.year, movies.library_id
    FROM playback_state
    JOIN movies ON movies.id = playback_state.media_id AND playback_state.media_type = 'movie'
    WHERE playback_state.user_id = ?
    ORDER BY playback_state.updated_at DESC LIMIT 15
  `).all(userId).map(c => ({
    ...c,
    type: 'movie',
    media_type: 'movie',
    mediaId: c.id,
    seriesId: null,
    progress: c.duration ? (c.position / c.duration) * 100 : 0
  }));

  const continueWatchingEpisodes = db.prepare(`
    SELECT playback_state.id as playbackId, playback_state.position, playback_state.duration, playback_state.updated_at,
           episodes.id as episodeId, episodes.title as episodeTitle, series.title as title, series.year, series.id as id, series.library_id
    FROM playback_state
    JOIN episodes ON episodes.id = playback_state.media_id AND playback_state.media_type = 'episode'
    JOIN seasons ON seasons.id = episodes.season_id
    JOIN series ON series.id = seasons.series_id
    WHERE playback_state.user_id = ?
    ORDER BY playback_state.updated_at DESC LIMIT 15
  `).all(userId).map(c => ({
    ...c,
    type: 'series',
    media_type: 'series',
    seriesId: c.id,
    mediaId: c.episodeId,
    progress: c.duration ? (c.position / c.duration) * 100 : 0
  }));

  const continueWatching = [...continueWatchingMovies, ...continueWatchingEpisodes]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 15)
    .map(withImage)
    .filter(item => Boolean(item.poster));

  const latestByLibrary = {};
  for (const lib of libraries) {
    let items = [];
    if (lib.type === 'movies') {
      const c = db.prepare(`SELECT id, title, year, added_at, path, 'movie' as media_type FROM movies WHERE library_id = ? AND path IS NOT NULL ORDER BY added_at DESC LIMIT 30`).all(lib.id);
      items = c.filter(m => { try { return fs.existsSync(m.path); } catch { return false; } }).slice(0, 15);
    } else if (lib.type === 'shows') {
      const c = db.prepare(`
        SELECT series.id, series.title, series.year, series.added_at, 'series' as media_type
        FROM series
        WHERE library_id = ? AND EXISTS (
          SELECT 1 FROM seasons JOIN episodes ON episodes.season_id = seasons.id WHERE seasons.series_id = series.id
        )
        ORDER BY series.added_at DESC LIMIT 30
      `).all(lib.id);
      items = c.filter(s => {
        try {
          const ep = db.prepare(`SELECT episodes.path FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = ? LIMIT 1`).get(s.id);
          return ep && ep.path && fs.existsSync(ep.path);
        } catch { return false; }
      }).slice(0, 15);
    } else if (lib.type === 'music') {
      items = db.prepare(`
        SELECT albums.id, albums.title, albums.year, albums.added_at, 'album' as media_type, artists.name as artistName 
        FROM albums 
        LEFT JOIN artists ON artists.id = albums.artist_id 
        WHERE albums.library_id = ? 
        AND EXISTS (SELECT 1 FROM tracks WHERE tracks.album_id = albums.id)
        ORDER BY albums.added_at DESC LIMIT 15
      `).all(lib.id);
      latestByLibrary[lib.id] = items.map(withImage);
      continue;
    }
    latestByLibrary[lib.id] = items.map(withImage).filter(item => Boolean(item.poster));
  }

  res.json({
    data: {
      libraries,
      musicStats: { tracks: tracksCount, artists: artistsCount, albums: albumsCount },
      backdrops,
      recentlyAdded,
      latestAudio,
      continueWatching,
      continueListening: continueListeningAll,
      latestByLibrary
    }
  });
});

router.get('/movies-home', (req, res) => {
  const defaultMovieLib = db.prepare("SELECT id FROM libraries WHERE type='movies' ORDER BY sort_order ASC, id ASC LIMIT 1").get();
  const libId = req.query.library_id ? Number(req.query.library_id) : (defaultMovieLib ? defaultMovieLib.id : null);

  const userId = req.user ? req.user.id : 1;

  const continueWatchingMovies = libId ? db.prepare(`
    SELECT playback_state.*, movies.title, movies.year, movies.id as mediaId
    FROM playback_state
    JOIN movies ON movies.id = playback_state.media_id AND playback_state.media_type = 'movie'
    WHERE movies.library_id = ?
      AND playback_state.user_id = ?
      AND playback_state.position > 0
      AND (playback_state.duration IS NULL OR playback_state.position < playback_state.duration * 0.95)
  `).all(libId, userId).map(c => ({ ...c, type: 'movie', id: c.mediaId })) : [];

  const continueWatchingEpisodes = db.prepare(`
    SELECT playback_state.*, episodes.title as episodeTitle, series.title as title, series.year, episodes.id as mediaId, series.id as seriesId
    FROM playback_state
    JOIN episodes ON episodes.id = playback_state.media_id AND playback_state.media_type = 'episode'
    JOIN seasons ON seasons.id = episodes.season_id
    JOIN series ON series.id = seasons.series_id
    WHERE playback_state.user_id = ?
      AND playback_state.position > 0
      AND (playback_state.duration IS NULL OR playback_state.position < playback_state.duration * 0.95)
  `).all(userId).map(c => ({ ...c, type: 'series', id: c.seriesId, title: `${c.title} - ${c.episodeTitle || 'Episode'}` }));

  const continueWatchingAll = [...continueWatchingMovies, ...continueWatchingEpisodes]
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10);

  const candidateMovies = libId ? db.prepare(`
    SELECT *, 'movie' as media_type FROM movies 
    WHERE library_id = ?
      AND path IS NOT NULL
    ORDER BY added_at DESC LIMIT 30
  `).all(libId).filter(m => {
    try { return m.path && fs.existsSync(m.path); } catch { return false; }
  }) : [];

  const candidateSeries = db.prepare(`
    SELECT series.*, 'series' as media_type, COUNT(episodes.id) as episode_count
    FROM series
    JOIN seasons ON seasons.series_id = series.id
    JOIN episodes ON episodes.season_id = seasons.id
    GROUP BY series.id
    HAVING episode_count > 0
    ORDER BY series.added_at DESC LIMIT 30
  `).all();

  const combinedRecent = [...candidateMovies, ...candidateSeries]
    .sort((a, b) => new Date(b.added_at || 0) - new Date(a.added_at || 0))
    .slice(0, 24)
    .map(item => {
      const type = item.media_type || (item.episode_count !== undefined ? 'series' : 'movie');
      const img = db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster' AND is_primary = 1 LIMIT 1`).get(type, item.id)
        || db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster' LIMIT 1`).get(type, item.id);
      return {
        ...item,
        type,
        media_type: type,
        poster: img ? `/api/image/${img.id}/thumb` : null,
        imageId: img?.id || null
      };
    });

  const collections = db.prepare(`SELECT * FROM collections ORDER BY sort_order LIMIT 6`).all();
  const movies = libId ? db.prepare(`
    SELECT * FROM movies 
    WHERE library_id = ?
      AND path IS NOT NULL
    ORDER BY year DESC LIMIT 30
  `).all(libId).filter(m => {
    try { return m.path && fs.existsSync(m.path); } catch { return false; }
  }).slice(0, 12) : [];

  const series = db.prepare(`
    SELECT series.*, COUNT(episodes.id) as episode_count
    FROM series
    JOIN seasons ON seasons.series_id = series.id
    JOIN episodes ON episodes.season_id = seasons.id
    GROUP BY series.id
    HAVING episode_count > 0
    ORDER BY series.added_at DESC
    LIMIT 30
  `).all();

  // Attach images
  const withImages = (items, mediaType, imageType) => items.map(item => {
    const img = db.prepare(`SELECT id, thumbnail_path, cached_path FROM images WHERE media_type = ? AND media_id = ? AND image_type = ? AND is_primary = 1 LIMIT 1`).get(mediaType, item.id, imageType);
    return { ...item, poster: img ? `/api/image/${img.id}/thumb` : null, imageId: img?.id || null };
  });

  const continueWatchingWithImages = continueWatchingAll.map(c => {
    const queryType = c.type === 'movie' ? 'movie' : 'series';
    const queryId = c.type === 'movie' ? c.mediaId : c.seriesId;
    const img = db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'backdrop' AND is_primary = 1 LIMIT 1`).get(queryType, queryId);
    const posterImg = db.prepare(`SELECT id FROM images WHERE media_type = ? AND media_id = ? AND image_type = 'poster' AND is_primary = 1 LIMIT 1`).get(queryType, queryId);
    return {
      ...c,
      backdrop: img ? `/api/image/${img.id}/thumb` : null,
      poster: posterImg ? `/api/image/${posterImg.id}/thumb` : null,
      progress: c.duration ? (c.position / c.duration) * 100 : 0
    };
  });

  res.json({
    data: {
      continueWatching: continueWatchingWithImages,
      continueListening: continueListeningAll,
      latestAudio: latestAudio,
      recentlyAdded: combinedRecent,
      collections,
      movies: withImages(movies, 'movie', 'poster'),
      series: withImages(series, 'series', 'poster')
    }
  });
});

router.get('/music-home', (req, res) => {
  const defaultMusicLib = db.prepare("SELECT id FROM libraries WHERE type='music' ORDER BY sort_order ASC, id ASC LIMIT 1").get();
  const libId = req.query.library_id ? Number(req.query.library_id) : (defaultMusicLib ? defaultMusicLib.id : null);

  const artists = libId ? db.prepare(`
    SELECT * FROM artists 
    WHERE library_id = ?
    ORDER BY added_at DESC LIMIT 12
  `).all(libId).map(a => {
    const artistImg = db.prepare(`
      SELECT id FROM images 
      WHERE media_type='artist' AND media_id=? AND (image_type='poster' OR image_type='avatar') AND is_primary=1 LIMIT 1
    `).get(a.id) || db.prepare(`
      SELECT id FROM images 
      WHERE media_type='artist' AND media_id=? AND (image_type='poster' OR image_type='avatar')
      ORDER BY is_primary DESC, id DESC LIMIT 1
    `).get(a.id);

    const albumCover = db.prepare(`
      SELECT images.id, images.thumbnail_path FROM images
      JOIN albums ON albums.id = images.media_id AND images.media_type = 'album'
      WHERE albums.artist_id = ? AND images.image_type = 'album_cover'
      ORDER BY images.is_primary DESC, COALESCE(albums.year, 0) DESC, images.id DESC
      LIMIT 1
    `).get(a.id);

    const imgId = artistImg?.id || albumCover?.id || null;
    return { ...a, image: imgId ? `/api/image/${imgId}/thumb` : null, poster: imgId ? `/api/image/${imgId}/thumb` : null, imageId: imgId };
  }) : [];

  const recentAlbums = libId ? db.prepare(`
    SELECT albums.*, artists.name as artistName FROM albums
    JOIN artists ON artists.id = albums.artist_id
    WHERE albums.library_id = ?
    ORDER BY albums.added_at DESC LIMIT 12
  `).all(libId).map(al => {
    const img = db.prepare(`SELECT id FROM images WHERE media_type='album' AND media_id=? AND image_type='album_cover' AND is_primary=1`).get(al.id);
    return { ...al, cover: img ? `/api/image/${img.id}/thumb` : null, imageId: img?.id || null };
  }) : [];

  const playlists = db.prepare(`SELECT * FROM playlists ORDER BY updated_at DESC LIMIT 6`).all();
  const recentlyPlayed = libId ? db.prepare(`
    SELECT tracks.*, albums.title as albumTitle, artists.name as artistName
    FROM tracks
    JOIN albums ON albums.id = tracks.album_id
    JOIN artists ON artists.id = albums.artist_id
    WHERE tracks.last_played_at IS NOT NULL
      AND tracks.library_id = ?
    ORDER BY tracks.last_played_at DESC LIMIT 10
  `).all(libId) : [];

  res.json({
    data: { artists, albums: recentAlbums, playlists, recentlyPlayed }
  });
});

export default router;
