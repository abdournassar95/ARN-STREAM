import db, { getAllLibraries, getLibraryById, normalizeArabic } from '../../db.js';
import { buildDtos, buildLibraryDto, getUserContext, isFavoriteItem, isPlayedItem, isResumableItem, getTags } from './dto.js';
import { makeId, parseId } from './ids.js';

const TYPE_ALIASES = new Map([
  ['movie', 'movie'],
  ['movies', 'movie'],
  ['series', 'series'],
  ['tvshow', 'series'],
  ['tvshows', 'series'],
  ['season', 'season'],
  ['seasons', 'season'],
  ['episode', 'episode'],
  ['episodes', 'episode'],
  ['musicartist', 'artist'],
  ['artist', 'artist'],
  ['artists', 'artist'],
  ['musicalbum', 'album'],
  ['album', 'album'],
  ['albums', 'album'],
  ['audio', 'track'],
  ['audiobook', 'track'],
  ['song', 'track'],
  ['songs', 'track'],
  ['track', 'track'],
  ['playlist', 'playlist'],
  ['playlists', 'playlist'],
  ['boxset', 'collection'],
  ['collection', 'collection'],
  ['collectionfolder', 'library'],
  ['userview', 'library'],
  ['folder', null]
]);

export function normalizeTypes(values) {
  const result = new Set();
  for (const value of values || []) {
    const key = String(value).replace(/\s+/g, '').toLowerCase();
    if (TYPE_ALIASES.has(key)) {
      const type = TYPE_ALIASES.get(key);
      if (type) result.add(type);
    }
  }
  return result;
}

export function allowedLibraryIds(user) {
  if (!user) return new Set();
  if (user.role === 'admin') return null;
  if (!Array.isArray(user.allowed_libraries)) return null;
  return new Set(user.allowed_libraries.map(Number));
}

function canAccessLibrary(user, libraryId) {
  if (libraryId === null || libraryId === undefined) return true;
  const allowed = allowedLibraryIds(user);
  return allowed === null || allowed.has(Number(libraryId));
}

export function resolveParent(user, parentId) {
  if (!parentId) return { kind: 'root', libraryId: null, id: null, row: null };
  const parsed = parseId(parentId);
  if (!parsed) return null;

  switch (parsed.type) {
    case 'library': {
      const library = getLibraryById(parsed.id);
      if (!library || !canAccessLibrary(user, library.id)) return null;
      return { kind: 'library', libraryId: library.id, id: parsed.id, row: library, library };
    }
    case 'series': {
      const row = db.prepare('SELECT * FROM series WHERE id = ?').get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'series', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'season': {
      const row = db.prepare(`
        SELECT seasons.*, series.title AS series_title, series.library_id
        FROM seasons JOIN series ON series.id = seasons.series_id
        WHERE seasons.id = ?
      `).get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'season', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'episode': {
      const row = db.prepare(`
        SELECT episodes.*, seasons.season_number, seasons.series_id, series.title AS series_title, series.library_id
        FROM episodes
        JOIN seasons ON seasons.id = episodes.season_id
        JOIN series ON series.id = seasons.series_id
        WHERE episodes.id = ?
      `).get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'episode', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'artist': {
      const row = db.prepare('SELECT * FROM artists WHERE id = ?').get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'artist', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'album': {
      const row = db.prepare('SELECT * FROM albums WHERE id = ?').get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'album', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'track': {
      const row = db.prepare('SELECT * FROM tracks WHERE id = ?').get(parsed.id);
      if (!row || !canAccessLibrary(user, row.library_id)) return null;
      return { kind: 'track', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'playlist': {
      const row = db.prepare('SELECT * FROM playlists WHERE id = ?').get(parsed.id);
      if (!row) return null;
      const canRead = user.role === 'admin' || row.user_id === user.id || Boolean(row.is_shared);
      if (!canRead) return null;
      return { kind: 'playlist', libraryId: row.library_id, id: parsed.id, row };
    }
    case 'collection': {
      const row = db.prepare('SELECT * FROM collections WHERE id = ?').get(parsed.id);
      if (!row) return null;
      if (user.role !== 'admin' && row.user_id !== user.id) return null;
      return { kind: 'collection', libraryId: null, id: parsed.id, row };
    }
    default:
      return null;
  }
}

export function getLibrariesForUser(user, onlyNonEmpty = false) {
  const allowed = allowedLibraryIds(user);
  return getAllLibraries(onlyNonEmpty)
    .filter((library) => allowed === null || allowed.has(Number(library.id)))
    .map((library) => buildLibraryDto(library, user.id));
}

function matchesLibrary(row, parent, allowed) {
  if (parent && parent.libraryId !== null && parent.libraryId !== undefined) {
    if (Number(row.library_id) !== Number(parent.libraryId)) return false;
  }
  if (allowed !== null) {
    if (row.library_id !== null && row.library_id !== undefined && !allowed.has(Number(row.library_id))) {
      return false;
    }
  }
  return true;
}

function mediaTypeFor(type) {
  if (type === 'movie' || type === 'episode' || type === 'series' || type === 'season') return 'Video';
  return 'Audio';
}

function annotate(row, type) {
  const title = type === 'artist'
    ? row.name
    : type === 'playlist' || type === 'collection'
      ? row.name
      : row.title;

  return Object.assign(row, {
    _type: type,
    _title: title || '',
    _seriesTitle: row.series_title || row.album_title || row.artist_name || '',
    _year: row.year ? Number(row.year) : null,
    _addedAt: row.added_at || row.created_at || null,
    _updatedAt: row.updated_at || null,
    _duration: Number(row.duration) || 0,
    _index: Number(row.episode_number ?? row.track_number ?? row.season_number) || 0,
    _parentIndex: Number(row.season_number) || 0,
    _playCount: Number(row.play_count) || 0,
    _mediaType: mediaTypeFor(type)
  });
}

function defaultTypes(parent) {
  if (!parent || parent.kind === 'root') return ['movie', 'series', 'artist'];
  if (parent.kind === 'library') {
    if (parent.library.type === 'movies') return ['movie'];
    if (parent.library.type === 'shows') return ['series'];
    return ['artist'];
  }
  if (parent.kind === 'series') return ['season'];
  if (parent.kind === 'season') return ['episode'];
  if (parent.kind === 'artist') return ['album'];
  if (parent.kind === 'album') return ['track'];
  if (parent.kind === 'playlist') return ['track'];
  return ['movie', 'series', 'episode', 'artist', 'album', 'track'];
}

function playlistRows(user, playlistId) {
  return db.prepare(`
    SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
    FROM playlist_items
    JOIN tracks ON tracks.id = playlist_items.track_id
    LEFT JOIN albums ON albums.id = tracks.album_id
    LEFT JOIN artists ON artists.id = albums.artist_id
    WHERE playlist_items.playlist_id = ?
    ORDER BY playlist_items.position ASC
  `).all(playlistId).map((row) => annotate(row, 'track'));
}

function collectionRows(user, collectionId) {
  const members = db.prepare(
    'SELECT media_type, media_id FROM collection_items WHERE collection_id = ? ORDER BY position ASC'
  ).all(collectionId);

  const rows = [];
  for (const member of members) {
    const type = String(member.media_type).toLowerCase();
    if (type === 'movie') {
      const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(member.media_id);
      if (row) rows.push(annotate(row, 'movie'));
    } else if (type === 'series') {
      const row = db.prepare(`
        SELECT series.*,
          (SELECT COUNT(*) FROM seasons WHERE seasons.series_id = series.id) AS seasons_count,
          (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) AS episodes_count
        FROM series WHERE id = ?
      `).get(member.media_id);
      if (row) rows.push(annotate(row, 'series'));
    } else if (type === 'episode') {
      const row = db.prepare(`
        SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
               series.title AS series_title, series.library_id
        FROM episodes
        JOIN seasons ON seasons.id = episodes.season_id
        JOIN series ON series.id = seasons.series_id
        WHERE episodes.id = ?
      `).get(member.media_id);
      if (row) rows.push(annotate(row, 'episode'));
    } else if (type === 'track' || type === 'audio') {
      const row = db.prepare(`
        SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
        FROM tracks
        LEFT JOIN albums ON albums.id = tracks.album_id
        LEFT JOIN artists ON artists.id = albums.artist_id
        WHERE tracks.id = ?
      `).get(member.media_id);
      if (row) rows.push(annotate(row, 'track'));
    }
  }
  return rows;
}

function collectRows(user, parent, types) {
  const allowed = allowedLibraryIds(user);

  if (parent && parent.kind === 'playlist') {
    const rows = playlistRows(user, parent.id);
    return rows.filter((row) => {
      if (types.size && !types.has(row._type)) return false;
      return allowed === null || row.library_id === null || row.library_id === undefined || allowed.has(Number(row.library_id));
    });
  }

  if (parent && parent.kind === 'collection') {
    const rows = collectionRows(user, parent.id);
    return rows.filter((row) => {
      if (types.size && !types.has(row._type)) return false;
      return allowed === null || row.library_id === null || row.library_id === undefined || allowed.has(Number(row.library_id));
    });
  }

  const rows = [];

  for (const type of types) {
    if (type === 'movie') {
      const list = db.prepare('SELECT * FROM movies').all();
      for (const row of list) {
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'movie'));
      }
    } else if (type === 'series') {
      const list = db.prepare(`
        SELECT series.*,
          (SELECT COUNT(*) FROM seasons WHERE seasons.series_id = series.id) AS seasons_count,
          (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) AS episodes_count
        FROM series
      `).all();
      for (const row of list) {
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'series'));
      }
    } else if (type === 'season') {
      const list = db.prepare(`
        SELECT seasons.*, series.title AS series_title, series.library_id
        FROM seasons JOIN series ON series.id = seasons.series_id
      `).all();
      for (const row of list) {
        if (parent && parent.kind === 'series' && Number(row.series_id) !== Number(parent.id)) continue;
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'season'));
      }
    } else if (type === 'episode') {
      const list = db.prepare(`
        SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
               series.title AS series_title, series.library_id
        FROM episodes
        JOIN seasons ON seasons.id = episodes.season_id
        JOIN series ON series.id = seasons.series_id
      `).all();
      for (const row of list) {
        if (parent && parent.kind === 'series' && Number(row.series_id) !== Number(parent.id)) continue;
        if (parent && parent.kind === 'season' && Number(row.season_id) !== Number(parent.id)) continue;
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'episode'));
      }
    } else if (type === 'artist') {
      const list = db.prepare(`
        SELECT artists.*, (SELECT COUNT(*) FROM albums WHERE albums.artist_id = artists.id) AS albums_count
        FROM artists
      `).all();
      for (const row of list) {
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'artist'));
      }
    } else if (type === 'album') {
      const list = db.prepare(`
        SELECT albums.*, artists.name AS artist_name,
          (SELECT COUNT(*) FROM tracks WHERE tracks.album_id = albums.id) AS tracks_count
        FROM albums LEFT JOIN artists ON artists.id = albums.artist_id
      `).all();
      for (const row of list) {
        if (parent && parent.kind === 'artist' && Number(row.artist_id) !== Number(parent.id)) continue;
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'album'));
      }
    } else if (type === 'track') {
      const list = db.prepare(`
        SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
        FROM tracks
        LEFT JOIN albums ON albums.id = tracks.album_id
        LEFT JOIN artists ON artists.id = albums.artist_id
      `).all();
      for (const row of list) {
        if (parent && parent.kind === 'album' && Number(row.album_id) !== Number(parent.id)) continue;
        if (parent && parent.kind === 'artist' && Number(row.artist_id) !== Number(parent.id)) continue;
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'track'));
      }
    } else if (type === 'playlist') {
      const list = db.prepare(`
        SELECT playlists.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = playlists.id) AS item_count
        FROM playlists
        WHERE user_id = ? OR is_shared = 1 OR ? = 1
      `).all(user.id, user.role === 'admin' ? 1 : 0);
      for (const row of list) {
        if (matchesLibrary(row, parent, allowed)) rows.push(annotate(row, 'playlist'));
      }
    } else if (type === 'collection') {
      const list = db.prepare(`
        SELECT collections.*, (SELECT COUNT(*) FROM collection_items WHERE collection_id = collections.id) AS item_count
        FROM collections
        WHERE user_id = ? OR ? = 1
      `).all(user.id, user.role === 'admin' ? 1 : 0);
      for (const row of list) rows.push(annotate(row, 'collection'));
    }
  }

  return rows;
}

function stateKey(type, id) {
  return `${type}:${Number(id)}`;
}

function buildGenreFilterSet(types, genres) {
  if (!genres.length) return null;
  const placeholders = genres.map(() => '?').join(',');
  const rows = db.prepare(`
    SELECT media_tags.media_type AS media_type, media_tags.media_id AS media_id
    FROM media_tags
    JOIN tags ON tags.id = media_tags.tag_id
    WHERE LOWER(tags.name) IN (${placeholders})
  `).all(...genres.map((genre) => genre.toLowerCase()));
  return new Set(rows.map((row) => stateKey(row.media_type, row.media_id)));
}

function passesFilters(row, options, context, genreSet) {
  if (options.years.length && !options.years.includes(Number(row._year))) return false;
  if (genreSet && !genreSet.has(stateKey(row._type, row.id))) return false;

  if (options.mediaTypes.length) {
    const mediaType = String(row._mediaType).toLowerCase();
    if (!options.mediaTypes.includes(mediaType)) return false;
  }

  if (options.artistIds && options.artistIds.size && (row._type === 'album' || row._type === 'track')) {
    if (!options.artistIds.has(Number(row.artist_id))) return false;
  }

  if (options.albumIds && options.albumIds.size && row._type === 'track') {
    if (!options.albumIds.has(Number(row.album_id))) return false;
  }

  if (options.searchTerm) {
    const term = normalizeArabic(options.searchTerm);
    const haystack = normalizeArabic(`${row._title} ${row._seriesTitle}`);
    if (!haystack.includes(term)) return false;
  }

  const played = isPlayedItem(row._type, row.id, row._duration, context, row._playCount);
  const favorite = isFavoriteItem(row._type, row.id, context, row.is_favorite);
  const resumable = isResumableItem(row._type, row.id, row._duration, context);

  if (options.isPlayed !== undefined && played !== options.isPlayed) return false;
  if (options.isFavorite !== undefined && favorite !== options.isFavorite) return false;

  for (const filter of options.filters) {
    switch (filter) {
      case 'isplayed':
        if (!played) return false;
        break;
      case 'isunplayed':
        if (played) return false;
        break;
      case 'isfavorite':
        if (!favorite) return false;
        break;
      case 'isresumable':
        if (!resumable) return false;
        break;
      case 'isfolder':
        return false;
      case 'isnotfolder':
        break;
      default:
        break;
    }
  }

  return true;
}

function compareRows(a, b, key, direction) {
  let left;
  let right;

  switch (key) {
    case 'datecreated':
    case 'dateadded':
    case 'datelastcontentadded':
      left = a._addedAt ? new Date(a._addedAt).getTime() : 0;
      right = b._addedAt ? new Date(b._addedAt).getTime() : 0;
      break;
    case 'productionyear':
      left = a._year || 0;
      right = b._year || 0;
      break;
    case 'runtime':
      left = a._duration || 0;
      right = b._duration || 0;
      break;
    case 'playcount':
      left = a._playCount || 0;
      right = b._playCount || 0;
      break;
    case 'parentindexnumber':
      left = a._parentIndex || 0;
      right = b._parentIndex || 0;
      break;
    case 'indexnumber':
      left = a._index || 0;
      right = b._index || 0;
      break;
    case 'random':
      left = Math.random();
      right = Math.random();
      break;
    case 'communityrating':
    case 'criticrating':
    case 'officialrating':
      left = 0;
      right = 0;
      break;
    case 'sortname':
    case 'name':
    case 'seriesname':
    case 'album':
    default:
      left = String(a._title || '').toLowerCase();
      right = String(b._title || '').toLowerCase();
      break;
  }

  let result;
  if (typeof left === 'string') {
    result = left.localeCompare(right, 'ar', { sensitivity: 'base' });
  } else {
    result = left - right;
  }

  return direction === 'descending' ? -result : result;
}

function sortRows(rows, sortBy, sortOrder) {
  const keys = sortBy.length ? sortBy.map((value) => value.toLowerCase()) : ['sortname'];
  if (keys.includes('random')) {
    const shuffled = [...rows];
    for (let index = shuffled.length - 1; index > 0; index--) {
      const swapIndex = Math.floor(Math.random() * (index + 1));
      [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
  }

  const directions = keys.map((_, index) => {
    const value = sortOrder[index] || sortOrder[0] || 'ascending';
    return String(value).toLowerCase() === 'descending' ? 'descending' : 'ascending';
  });

  return [...rows].sort((a, b) => {
    for (let index = 0; index < keys.length; index++) {
      const result = compareRows(a, b, keys[index], directions[index]);
      if (result !== 0) return result;
    }
    return 0;
  });
}

function paginate(rows, startIndex, limit) {
  const start = Number.isFinite(startIndex) && startIndex > 0 ? startIndex : 0;
  if (limit === undefined || limit === null) return rows.slice(start);
  const size = Number(limit);
  if (!Number.isFinite(size) || size < 0) return rows.slice(start);
  return rows.slice(start, start + size);
}

export function queryItems(user, options) {
  const parent = resolveParent(user, options.parentId);
  if (parent === null) return { Items: [], TotalRecordCount: 0, StartIndex: 0 };

  const types = options.includeTypes.size ? new Set(options.includeTypes) : new Set(defaultTypes(parent));
  for (const excluded of options.excludeTypes || []) types.delete(excluded);

  if (types.has('library') && !types.has('movie') && !types.has('series') && !types.has('artist') && !types.has('album') && !types.has('track') && !types.has('episode') && !types.has('season')) {
    return {
      Items: getLibrariesForUser(user),
      TotalRecordCount: getLibrariesForUser(user).length,
      StartIndex: 0
    };
  }

  const context = getUserContext(user.id);
  const genreSet = buildGenreFilterSet(types, options.genres);
  let rows = collectRows(user, parent, types);
  rows = rows.filter((row) => passesFilters(row, options, context, genreSet));

  let sortBy = options.sortBy;
  let sortOrder = options.sortOrder;
  if (!sortBy.length && types.size === 1 && types.has('season')) {
    sortBy = ['ParentIndexNumber'];
  } else if (!sortBy.length && types.size === 1 && types.has('episode')) {
    sortBy = ['ParentIndexNumber', 'IndexNumber'];
  }
  rows = sortRows(rows, sortBy, sortOrder);

  const total = rows.length;
  const page = paginate(rows, options.startIndex, options.limit);
  return {
    Items: buildDtos(page, user.id),
    TotalRecordCount: total,
    StartIndex: options.startIndex || 0
  };
}

export function latestItems(user, options) {
  const parent = resolveParent(user, options.parentId);
  if (parent === null) return [];

  let types = options.includeTypes;
  if (!types.size) {
    if (parent.kind === 'library') {
      types = new Set([
        parent.library.type === 'movies' ? 'movie' : parent.library.type === 'shows' ? 'episode' : 'album'
      ]);
    } else {
      types = new Set(['movie', 'episode', 'album']);
    }
  }

  let rows = collectRows(user, parent, types);
  const context = getUserContext(user.id);
  const genreSet = buildGenreFilterSet(types, options.genres);
  rows = rows.filter((row) => passesFilters(row, options, context, genreSet));
  rows.sort((a, b) => new Date(b._addedAt || 0).getTime() - new Date(a._addedAt || 0).getTime());

  return buildDtos(paginate(rows, 0, options.limit || 25), user.id);
}

export function resumeItems(user, options) {
  const parent = resolveParent(user, options.parentId);
  if (parent === null) return { Items: [], TotalRecordCount: 0, StartIndex: 0 };

  const allowed = allowedLibraryIds(user);
  const states = db.prepare(
    'SELECT * FROM playback_state WHERE user_id = ? AND position > 0 ORDER BY updated_at DESC'
  ).all(user.id);

  const rows = [];
  for (const state of states) {
    const type = String(state.media_type).toLowerCase();
    if (type !== 'movie' && type !== 'episode' && type !== 'track') continue;
    if (options.mediaTypes && options.mediaTypes.length) {
      const mediaType = type === 'track' ? 'audio' : 'video';
      if (!options.mediaTypes.includes(mediaType)) continue;
    }
    const duration = Number(state.duration) || 0;
    if (duration > 0 && Number(state.position) >= duration * 0.9) continue;

    let row;
    if (type === 'movie') {
      row = db.prepare('SELECT * FROM movies WHERE id = ?').get(state.media_id);
    } else if (type === 'episode') {
      row = db.prepare(`
        SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
               series.title AS series_title, series.library_id
        FROM episodes
        JOIN seasons ON seasons.id = episodes.season_id
        JOIN series ON series.id = seasons.series_id
        WHERE episodes.id = ?
      `).get(state.media_id);
    } else {
      row = db.prepare(`
        SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
        FROM tracks
        LEFT JOIN albums ON albums.id = tracks.album_id
        LEFT JOIN artists ON artists.id = albums.artist_id
        WHERE tracks.id = ?
      `).get(state.media_id);
    }

    if (!row) continue;
    if (parent.kind === 'library' && Number(row.library_id) !== Number(parent.libraryId)) continue;
    if (parent.kind === 'series' && Number(row.series_id) !== Number(parent.id)) continue;
    if (parent.kind === 'season' && Number(row.season_id) !== Number(parent.id)) continue;
    if (parent.kind === 'album' && Number(row.album_id) !== Number(parent.id)) continue;
    if (allowed !== null && row.library_id !== null && row.library_id !== undefined && !allowed.has(Number(row.library_id))) continue;

    rows.push(annotate(row, type));
  }

  const items = buildDtos(paginate(rows, options.startIndex, options.limit || 25), user.id);
  return {
    Items: items,
    TotalRecordCount: rows.length,
    StartIndex: options.startIndex || 0
  };
}

export function nextUpItems(user, options) {
  const parent = resolveParent(user, options.parentId);
  if (parent === null) return { Items: [], TotalRecordCount: 0, StartIndex: 0 };

  const allowed = allowedLibraryIds(user);
  const seriesFilter = options.seriesId ? parseId(options.seriesId) : null;

  let seriesRows = db.prepare('SELECT * FROM series').all();
  seriesRows = seriesRows.filter((series) => {
    if (seriesFilter && Number(series.id) !== Number(seriesFilter.id)) return false;
    if (parent.kind === 'library' && Number(series.library_id) !== Number(parent.libraryId)) return false;
    if (allowed !== null && series.library_id !== null && series.library_id !== undefined && !allowed.has(Number(series.library_id))) return false;
    return true;
  });

  const context = getUserContext(user.id);
  const picked = [];

  for (const series of seriesRows) {
    const episodes = db.prepare(`
      SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
             series.title AS series_title, series.library_id
      FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      JOIN series ON series.id = seasons.series_id
      WHERE seasons.series_id = ?
      ORDER BY seasons.season_number ASC, episodes.episode_number ASC
    `).all(series.id);

    if (!episodes.length) continue;

    let next = episodes.find((episode) => isResumableItem('episode', episode.id, episode.duration, context));
    if (!next) {
      next = episodes.find((episode) => !isPlayedItem('episode', episode.id, episode.duration, context, 0));
    }
    if (!next) continue;

    picked.push(annotate(next, 'episode'));
  }

  picked.sort((a, b) => {
    const aDate = new Date(a._addedAt || 0).getTime();
    const bDate = new Date(b._addedAt || 0).getTime();
    return bDate - aDate;
  });

  const page = paginate(picked, options.startIndex, options.limit || 25);
  return {
    Items: buildDtos(page, user.id),
    TotalRecordCount: picked.length,
    StartIndex: options.startIndex || 0
  };
}

export function similarItems(user, sourceType, sourceId, limit = 24) {
  const sourceTags = db.prepare(
    'SELECT tag_id FROM media_tags WHERE media_type = ? AND media_id = ?'
  ).all(sourceType, sourceId).map((row) => row.tag_id);

  const rows = [];

  if (sourceTags.length) {
    const placeholders = sourceTags.map(() => '?').join(',');
    const matches = db.prepare(`
      SELECT media_id, COUNT(*) AS matches
      FROM media_tags
      WHERE media_type = ? AND tag_id IN (${placeholders}) AND media_id != ?
      GROUP BY media_id
      ORDER BY matches DESC
      LIMIT ?
    `).all(sourceType, ...sourceTags, sourceId, limit);

    for (const match of matches) {
      const row = loadRowByType(sourceType, match.media_id);
      if (row) rows.push(annotate(row, sourceType));
    }
  }

  if (rows.length < limit) {
    const existing = new Set(rows.map((row) => row.id));
    const extra = loadRowsByType(sourceType, limit * 2);
    for (const row of extra) {
      if (existing.has(row.id) || Number(row.id) === Number(sourceId)) continue;
      rows.push(annotate(row, sourceType));
      if (rows.length >= limit) break;
    }
  }

  return {
    Items: buildDtos(rows.slice(0, limit), user.id),
    TotalRecordCount: rows.length,
    StartIndex: 0
  };
}

function loadRowByType(type, id) {
  if (type === 'movie') return db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  if (type === 'series') {
    return db.prepare(`
      SELECT series.*,
        (SELECT COUNT(*) FROM seasons WHERE seasons.series_id = series.id) AS seasons_count,
        (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) AS episodes_count
      FROM series WHERE id = ?
    `).get(id);
  }
  if (type === 'episode') {
    return db.prepare(`
      SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
             series.title AS series_title, series.library_id
      FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      JOIN series ON series.id = seasons.series_id
      WHERE episodes.id = ?
    `).get(id);
  }
  if (type === 'season') {
    return db.prepare(`
      SELECT seasons.*, series.title AS series_title, series.library_id
      FROM seasons JOIN series ON series.id = seasons.series_id
      WHERE seasons.id = ?
    `).get(id);
  }
  if (type === 'artist') {
    return db.prepare(`
      SELECT artists.*, (SELECT COUNT(*) FROM albums WHERE albums.artist_id = artists.id) AS albums_count
      FROM artists WHERE id = ?
    `).get(id);
  }
  if (type === 'album') {
    return db.prepare(`
      SELECT albums.*, artists.name AS artist_name,
        (SELECT COUNT(*) FROM tracks WHERE tracks.album_id = albums.id) AS tracks_count
      FROM albums LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE albums.id = ?
    `).get(id);
  }
  if (type === 'track') {
    return db.prepare(`
      SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      WHERE tracks.id = ?
    `).get(id);
  }
  return null;
}

function loadRowsByType(type, limit) {
  if (type === 'movie') return db.prepare('SELECT * FROM movies ORDER BY added_at DESC LIMIT ?').all(limit);
  if (type === 'series') {
    return db.prepare(`
      SELECT series.*,
        (SELECT COUNT(*) FROM seasons WHERE seasons.series_id = series.id) AS seasons_count,
        (SELECT COUNT(*) FROM episodes JOIN seasons ON seasons.id = episodes.season_id WHERE seasons.series_id = series.id) AS episodes_count
      FROM series ORDER BY added_at DESC LIMIT ?
    `).all(limit);
  }
  if (type === 'episode') {
    return db.prepare(`
      SELECT episodes.*, seasons.season_number, seasons.series_id, seasons.title AS season_title,
             series.title AS series_title, series.library_id
      FROM episodes
      JOIN seasons ON seasons.id = episodes.season_id
      JOIN series ON series.id = seasons.series_id
      ORDER BY episodes.added_at DESC LIMIT ?
    `).all(limit);
  }
  if (type === 'season') {
    return db.prepare(`
      SELECT seasons.*, series.title AS series_title, series.library_id
      FROM seasons JOIN series ON series.id = seasons.series_id
      ORDER BY seasons.season_number DESC LIMIT ?
    `).all(limit);
  }
  if (type === 'artist') {
    return db.prepare(`
      SELECT artists.*, (SELECT COUNT(*) FROM albums WHERE albums.artist_id = artists.id) AS albums_count
      FROM artists ORDER BY added_at DESC LIMIT ?
    `).all(limit);
  }
  if (type === 'album') {
    return db.prepare(`
      SELECT albums.*, artists.name AS artist_name,
        (SELECT COUNT(*) FROM tracks WHERE tracks.album_id = albums.id) AS tracks_count
      FROM albums LEFT JOIN artists ON artists.id = albums.artist_id
      ORDER BY albums.added_at DESC LIMIT ?
    `).all(limit);
  }
  if (type === 'track') {
    return db.prepare(`
      SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
      FROM tracks
      LEFT JOIN albums ON albums.id = tracks.album_id
      LEFT JOIN artists ON artists.id = albums.artist_id
      ORDER BY tracks.added_at DESC LIMIT ?
    `).all(limit);
  }
  return [];
}

export function getItemRow(type, id) {
  return loadRowByType(type, id);
}

export function searchHints(user, term, limit = 20) {
  const normalized = normalizeArabic(term);
  if (!normalized) return { SearchHints: [], TotalRecordCount: 0 };

  const rows = [];
  const allowed = allowedLibraryIds(user);
  const add = (type, list) => {
    for (const row of list) {
      if (allowed !== null && row.library_id !== null && row.library_id !== undefined && !allowed.has(Number(row.library_id))) {
        continue;
      }
      rows.push(annotate(row, type));
    }
  };

  add('movie', db.prepare('SELECT * FROM movies').all()
    .filter((row) => normalizeArabic(row.title).includes(normalized)).slice(0, limit));
  add('series', db.prepare('SELECT * FROM series').all()
    .filter((row) => normalizeArabic(row.title).includes(normalized)).slice(0, limit));
  add('artist', db.prepare('SELECT * FROM artists').all()
    .filter((row) => normalizeArabic(row.name).includes(normalized)).slice(0, limit));
  add('album', db.prepare(`
    SELECT albums.*, artists.name AS artist_name FROM albums LEFT JOIN artists ON artists.id = albums.artist_id
  `).all().filter((row) => normalizeArabic(row.title).includes(normalized)).slice(0, limit));
  add('track', db.prepare(`
    SELECT tracks.*, albums.title AS album_title, albums.artist_id, artists.name AS artist_name
    FROM tracks LEFT JOIN albums ON albums.id = tracks.album_id LEFT JOIN artists ON artists.id = albums.artist_id
  `).all().filter((row) => normalizeArabic(row.title).includes(normalized)).slice(0, limit));

  const dtos = buildDtos(rows.slice(0, limit), user.id);
  const hints = dtos.map((item) => ({
    ItemId: item.Id,
    Id: item.Id,
    Name: item.Name,
    Type: item.Type,
    MediaType: item.MediaType,
    ImageTag: item.ImageTags ? item.ImageTags.Primary : undefined,
    ParentId: item.SeriesId || item.AlbumId || undefined,
    ProductionYear: item.ProductionYear
  }));

  return { SearchHints: hints, TotalRecordCount: hints.length };
}

export function filtersFor(user) {
  const genres = db.prepare('SELECT name FROM tags ORDER BY usage_count DESC, name ASC').all().map((row) => row.name);
  const years = db.prepare(`
    SELECT DISTINCT year FROM movies WHERE year IS NOT NULL
    UNION
    SELECT DISTINCT year FROM series WHERE year IS NOT NULL
    UNION
    SELECT DISTINCT year FROM albums WHERE year IS NOT NULL
    ORDER BY year DESC
  `).all().map((row) => row.year);

  return {
    Genres: genres,
    Tags: genres,
    Years: years,
    OfficialRatings: [],
    Studios: [],
    AudioLanguages: [],
    SubtitleLanguages: []
  };
}

export function getMediaRowWithContext(type, id) {
  return loadRowByType(type, id);
}

export function getSourceTags(type, id) {
  return getTags(type, [id]).get(Number(id)) || [];
}

export function canAccessMediaItem(user, type, id) {
  if (!user) return false;
  const row = loadRowByType(type, id);
  if (!row) return false;
  if (row.library_id === null || row.library_id === undefined) return true;
  return canAccessLibrary(user, row.library_id);
}

export function findMediaTypeById(id) {
  const numericId = Number(id);
  if (!Number.isFinite(numericId)) return null;
  if (db.prepare('SELECT id FROM movies WHERE id = ?').get(numericId)) return 'movie';
  if (db.prepare('SELECT id FROM episodes WHERE id = ?').get(numericId)) return 'episode';
  if (db.prepare('SELECT id FROM tracks WHERE id = ?').get(numericId)) return 'track';
  return null;
}

export function getItemDto(user, type, id) {
  if (type === 'library') {
    const library = getLibraryById(id);
    if (!library || !canAccessLibrary(user, library.id)) return null;
    return buildLibraryDto(library, user.id);
  }

  if (type === 'playlist') {
    const row = db.prepare(`
      SELECT playlists.*, (SELECT COUNT(*) FROM playlist_items WHERE playlist_id = playlists.id) AS item_count
      FROM playlists WHERE id = ?
    `).get(id);
    if (!row) return null;
    const canRead = user.role === 'admin' || row.user_id === user.id || Boolean(row.is_shared);
    if (!canRead) return null;
    return buildDtos([annotate(row, 'playlist')], user.id)[0];
  }

  if (type === 'collection') {
    const row = db.prepare(`
      SELECT collections.*, (SELECT COUNT(*) FROM collection_items WHERE collection_id = collections.id) AS item_count
      FROM collections WHERE id = ?
    `).get(id);
    if (!row || (user.role !== 'admin' && row.user_id !== user.id)) return null;
    return buildDtos([annotate(row, 'collection')], user.id)[0];
  }

  const row = loadRowByType(type, id);
  if (!row) return null;
  if (row.library_id !== null && row.library_id !== undefined && !canAccessLibrary(user, row.library_id)) return null;
  return buildDtos([annotate(row, type)], user.id)[0];
}

export function getAncestors(user, type, id) {
  const rows = [];

  if (type === 'episode') {
    const episode = loadRowByType('episode', id);
    if (!episode) return [];
    const season = loadRowByType('season', episode.season_id);
    const series = loadRowByType('series', episode.series_id);
    if (season) rows.push(annotate(season, 'season'));
    if (series) rows.push(annotate(series, 'series'));
  } else if (type === 'season') {
    const season = loadRowByType('season', id);
    if (!season) return [];
    const series = loadRowByType('series', season.series_id);
    if (series) rows.push(annotate(series, 'series'));
  } else if (type === 'track') {
    const track = loadRowByType('track', id);
    if (!track) return [];
    const album = loadRowByType('album', track.album_id);
    const artist = track.artist_id ? loadRowByType('artist', track.artist_id) : null;
    if (album) rows.push(annotate(album, 'album'));
    if (artist) rows.push(annotate(artist, 'artist'));
  } else if (type === 'album') {
    const album = loadRowByType('album', id);
    if (!album) return [];
    const artist = album.artist_id ? loadRowByType('artist', album.artist_id) : null;
    if (artist) rows.push(annotate(artist, 'artist'));
  }

  return buildDtos(rows, user.id);
}
