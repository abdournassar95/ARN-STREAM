import path from 'path';
import db from '../../db.js';
import { makeId } from './ids.js';

const TICKS_PER_SECOND = 10000000;
const POSTER_TYPES = new Set(['poster', 'season_poster', 'album_cover', 'cover', 'avatar']);
const BACKDROP_TYPES = new Set(['backdrop', 'fanart', 'banner']);

export function toTicks(seconds) {
  const value = Number(seconds);
  return Number.isFinite(value) && value > 0 ? Math.round(value * TICKS_PER_SECOND) : 0;
}

export function ticksToSeconds(ticks) {
  const value = Number(ticks);
  return Number.isFinite(value) && value > 0 ? value / TICKS_PER_SECOND : 0;
}

export function isoDate(value) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

export function fileContainer(filePath) {
  if (!filePath) return undefined;
  const extension = path.extname(String(filePath)).replace('.', '').toLowerCase();
  return extension || undefined;
}

function stateKey(type, id) {
  return `${type}:${Number(id)}`;
}

export function getUserContext(userId) {
  const favorites = new Set();
  const playback = new Map();
  if (!userId) return { favorites, playback };

  const favoriteRows = db.prepare('SELECT media_type, media_id FROM user_favorites WHERE user_id = ?').all(userId);
  for (const row of favoriteRows) favorites.add(stateKey(row.media_type, row.media_id));

  const playbackRows = db.prepare('SELECT * FROM playback_state WHERE user_id = ?').all(userId);
  for (const row of playbackRows) playback.set(stateKey(row.media_type, row.media_id), row);

  return { favorites, playback };
}

export function getImageSets(mediaType, ids) {
  const sets = new Map();
  const uniqueIds = [...new Set((ids || []).map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return sets;

  for (let index = 0; index < uniqueIds.length; index += 400) {
    const chunk = uniqueIds.slice(index, index + 400);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT * FROM images WHERE media_type = ? AND media_id IN (${placeholders}) ORDER BY is_primary DESC, id DESC`
    ).all(mediaType, ...chunk);

    for (const row of rows) {
      let entry = sets.get(Number(row.media_id));
      if (!entry) {
        entry = { primary: null, backdrops: [], all: [] };
        sets.set(Number(row.media_id), entry);
      }
      entry.all.push(row);
      if (POSTER_TYPES.has(row.image_type) && !entry.primary) entry.primary = row;
      if (BACKDROP_TYPES.has(row.image_type)) entry.backdrops.push(row);
    }
  }

  return sets;
}

export function getTags(mediaType, ids) {
  const result = new Map();
  const uniqueIds = [...new Set((ids || []).map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return result;

  for (let index = 0; index < uniqueIds.length; index += 400) {
    const chunk = uniqueIds.slice(index, index + 400);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(`
      SELECT media_tags.media_id AS media_id, tags.name AS name
      FROM media_tags
      JOIN tags ON tags.id = media_tags.tag_id
      WHERE media_tags.media_type = ? AND media_tags.media_id IN (${placeholders})
    `).all(mediaType, ...chunk);

    for (const row of rows) {
      const list = result.get(Number(row.media_id)) || [];
      if (!list.includes(row.name)) list.push(row.name);
      result.set(Number(row.media_id), list);
    }
  }

  return result;
}

export function getRatings(mediaType, ids) {
  const result = new Map();
  const uniqueIds = [...new Set((ids || []).map(Number).filter(Number.isFinite))];
  if (!uniqueIds.length) return result;

  for (let index = 0; index < uniqueIds.length; index += 400) {
    const chunk = uniqueIds.slice(index, index + 400);
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.prepare(
      `SELECT media_id, rating, review FROM ratings WHERE media_type = ? AND media_id IN (${placeholders})`
    ).all(mediaType, ...chunk);

    for (const row of rows) {
      result.set(Number(row.media_id), { rating: row.rating, review: row.review });
    }
  }

  return result;
}

function isPlayedFromState(row, context) {
  if (!row) return false;
  if (row._type === 'track' && Number(row.play_count) > 0) return true;
  const state = context.playback.get(stateKey(row._type, row.id));
  if (!state) return false;
  const duration = Number(state.duration) || Number(row.duration) || 0;
  return duration > 0 && Number(state.position) >= duration * 0.9;
}

export function isPlayedItem(type, id, duration, context, playCount) {
  if (type === 'track' && Number(playCount) > 0) return true;
  const state = context.playback.get(stateKey(type, id));
  if (!state) return false;
  const resolvedDuration = Number(state.duration) || Number(duration) || 0;
  return resolvedDuration > 0 && Number(state.position) >= resolvedDuration * 0.9;
}

export function isResumableItem(type, id, duration, context) {
  const state = context.playback.get(stateKey(type, id));
  if (!state) return false;
  const position = Number(state.position) || 0;
  const resolvedDuration = Number(state.duration) || Number(duration) || 0;
  return position > 0 && (!resolvedDuration || position < resolvedDuration * 0.9);
}

export function isFavoriteItem(type, id, context, trackFavorite) {
  return context.favorites.has(stateKey(type, id)) || Boolean(trackFavorite);
}

function buildUserData(row, context) {
  const state = context.playback.get(stateKey(row._type, row.id));
  const inheritedCount = Number(row.play_count) || 0;
  const played = isPlayedItem(row._type, row.id, row.duration, context, inheritedCount);
  return {
    PlaybackPositionTicks: toTicks(state ? state.position : 0),
    PlayCount: inheritedCount || (played ? 1 : 0),
    IsFavorite: isFavoriteItem(row._type, row.id, context, row.is_favorite),
    Played: played,
    Key: makeId(row._type, row.id),
    ItemId: makeId(row._type, row.id)
  };
}

function primaryTags(imageSet) {
  return imageSet && imageSet.primary ? { Primary: String(imageSet.primary.id) } : {};
}

function backdropTags(imageSet) {
  return imageSet ? imageSet.backdrops.map((image) => String(image.id)) : [];
}

function withGenres(dto, genres) {
  if (genres && genres.length) {
    dto.Genres = genres;
    dto.Tags = genres;
  }
  return dto;
}

function movieDto(row, context, images, tags, rating) {
  return withGenres({
    Id: makeId('movie', row.id),
    Name: row.title,
    OriginalTitle: row.title,
    SortName: row.title,
    Type: 'Movie',
    MediaType: 'Video',
    IsFolder: false,
    Overview: row.plot || '',
    ProductionYear: row.year || undefined,
    PremiereDate: row.year ? `${row.year}-01-01T00:00:00.000Z` : undefined,
    RunTimeTicks: toTicks(row.duration),
    DateCreated: isoDate(row.added_at),
    ImageTags: primaryTags(images),
    BackdropImageTags: backdropTags(images),
    PrimaryImageAspectRatio: 0.6667,
    Container: fileContainer(row.path),
    MediaSourceCount: 1,
    PlayAccess: 'Full',
    CanDownload: true,
    UserData: buildUserData(row, context),
    CommunityRating: rating && rating.rating ? Number(rating.rating) : undefined,
    OfficialRating: undefined
  }, tags);
}

function seriesDto(row, context, images, tags, rating) {
  return withGenres({
    Id: makeId('series', row.id),
    Name: row.title,
    OriginalTitle: row.title,
    SortName: row.title,
    Type: 'Series',
    MediaType: 'Video',
    IsFolder: true,
    Overview: row.plot || '',
    ProductionYear: row.year || undefined,
    PremiereDate: row.year ? `${row.year}-01-01T00:00:00.000Z` : undefined,
    DateCreated: isoDate(row.added_at),
    ImageTags: primaryTags(images),
    BackdropImageTags: backdropTags(images),
    PrimaryImageAspectRatio: 0.6667,
    ChildCount: Number(row.seasons_count) || 0,
    RecursiveItemCount: Number(row.episodes_count) || 0,
    Status: 'Continuing',
    PlayAccess: 'Full',
    CanDownload: true,
    UserData: buildUserData(row, context),
    CommunityRating: rating && rating.rating ? Number(rating.rating) : undefined
  }, tags);
}

function seasonDto(row, context, images, seriesImages, seriesName) {
  const imageSet = images && images.primary ? images : seriesImages;
  return {
    Id: makeId('season', row.id),
    Name: row.title || `Season ${row.season_number}`,
    SortName: row.title || `Season ${row.season_number}`,
    Type: 'Season',
    MediaType: 'Video',
    IsFolder: true,
    Overview: row.plot || '',
    ProductionYear: row.year || undefined,
    IndexNumber: row.season_number,
    SeriesId: makeId('series', row.series_id),
    SeriesName: seriesName || row.series_title || '',
    SeriesPrimaryImageTag: seriesImages && seriesImages.primary ? String(seriesImages.primary.id) : undefined,
    ParentBackdropItemId: makeId('series', row.series_id),
    ParentBackdropImageTags: backdropTags(seriesImages),
    ImageTags: primaryTags(imageSet),
    BackdropImageTags: backdropTags(images),
    DateCreated: undefined,
    UserData: buildUserData({ ...row, _type: 'season' }, context)
  };
}

function episodeDto(row, context, seriesImages, seasonImages) {
  const imageSet = seasonImages && seasonImages.primary ? seasonImages : seriesImages;
  return {
    Id: makeId('episode', row.id),
    Name: row.title || `Episode ${row.episode_number}`,
    SortName: row.title || `Episode ${row.episode_number}`,
    Type: 'Episode',
    MediaType: 'Video',
    IsFolder: false,
    Overview: row.plot || '',
    RunTimeTicks: toTicks(row.duration),
    DateCreated: isoDate(row.added_at),
    IndexNumber: row.episode_number,
    ParentIndexNumber: row.season_number,
    SeriesId: makeId('series', row.series_id),
    SeriesName: row.series_title || '',
    SeasonId: makeId('season', row.season_id),
    SeasonName: row.season_title || `Season ${row.season_number}`,
    SeriesPrimaryImageTag: seriesImages && seriesImages.primary ? String(seriesImages.primary.id) : undefined,
    ParentBackdropItemId: makeId('series', row.series_id),
    ParentBackdropImageTags: backdropTags(seriesImages),
    ImageTags: primaryTags(imageSet),
    BackdropImageTags: backdropTags(seriesImages),
    PrimaryImageAspectRatio: 1.7778,
    Container: fileContainer(row.path),
    MediaSourceCount: 1,
    PlayAccess: 'Full',
    CanDownload: true,
    UserData: buildUserData(row, context)
  };
}

function artistDto(row, context, images, tags) {
  return withGenres({
    Id: makeId('artist', row.id),
    Name: row.name,
    SortName: row.name,
    Type: 'MusicArtist',
    MediaType: 'Audio',
    IsFolder: true,
    Overview: row.bio || '',
    ProductionYear: undefined,
    DateCreated: isoDate(row.added_at),
    ImageTags: primaryTags(images),
    BackdropImageTags: backdropTags(images),
    ChildCount: Number(row.albums_count) || 0,
    PlayAccess: 'Full',
    UserData: buildUserData({ ...row, _type: 'artist' }, context)
  }, tags);
}

function albumDto(row, context, images, tags, rating) {
  const artistId = row.artist_id ? makeId('artist', row.artist_id) : undefined;
  return withGenres({
    Id: makeId('album', row.id),
    Name: row.title,
    SortName: row.title,
    Type: 'MusicAlbum',
    MediaType: 'Audio',
    IsFolder: true,
    Overview: row.plot || '',
    ProductionYear: row.year || undefined,
    DateCreated: isoDate(row.added_at),
    ImageTags: primaryTags(images),
    BackdropImageTags: backdropTags(images),
    AlbumArtist: row.artist_name || '',
    AlbumArtists: row.artist_name ? [{ Name: row.artist_name, Id: artistId }] : [],
    Artists: row.artist_name ? [row.artist_name] : [],
    ChildCount: Number(row.tracks_count) || 0,
    PlayAccess: 'Full',
    UserData: buildUserData({ ...row, _type: 'album' }, context),
    CommunityRating: rating && rating.rating ? Number(rating.rating) : undefined
  }, tags);
}

function trackDto(row, context, images, tags) {
  return withGenres({
    Id: makeId('track', row.id),
    Name: row.title,
    SortName: row.title,
    Type: 'Audio',
    MediaType: 'Audio',
    IsFolder: false,
    RunTimeTicks: toTicks(row.duration),
    IndexNumber: row.track_number || undefined,
    ParentIndexNumber: 1,
    DateCreated: isoDate(row.added_at),
    Album: row.album_title || '',
    AlbumId: row.album_id ? makeId('album', row.album_id) : undefined,
    AlbumArtist: row.artist_name || '',
    AlbumArtists: row.artist_name ? [{ Name: row.artist_name, Id: row.artist_id ? makeId('artist', row.artist_id) : undefined }] : [],
    Artists: row.artist_name ? [row.artist_name] : [],
    AlbumPrimaryImageTag: images && images.primary ? String(images.primary.id) : undefined,
    ImageTags: primaryTags(images),
    BackdropImageTags: backdropTags(images),
    Container: fileContainer(row.path),
    PlayAccess: 'Full',
    CanDownload: true,
    UserData: buildUserData(row, context)
  }, tags);
}

function playlistDto(row, context, imageRow) {
  return {
    Id: makeId('playlist', row.id),
    Name: row.name,
    SortName: row.name,
    Type: 'Playlist',
    MediaType: 'Audio',
    IsFolder: true,
    Overview: row.description || '',
    DateCreated: isoDate(row.created_at),
    ImageTags: imageRow ? { Primary: String(imageRow.id) } : {},
    BackdropImageTags: [],
    ChildCount: Number(row.item_count) || 0,
    PlayAccess: 'Full',
    UserData: buildUserData({ ...row, _type: 'playlist' }, context)
  };
}

function collectionDto(row, context, imageRow) {
  return {
    Id: makeId('collection', row.id),
    Name: row.name,
    SortName: row.name,
    Type: 'BoxSet',
    MediaType: 'Video',
    IsFolder: true,
    Overview: row.description || '',
    DateCreated: isoDate(row.created_at),
    ImageTags: imageRow ? { Primary: String(imageRow.id) } : {},
    BackdropImageTags: [],
    ChildCount: Number(row.item_count) || 0,
    PlayAccess: 'Full',
    UserData: buildUserData({ ...row, _type: 'collection' }, context)
  };
}

export function buildDtos(rows, userId) {
  if (!rows || !rows.length) return [];
  const context = getUserContext(userId);

  const byType = new Map();
  for (const row of rows) {
    if (!byType.has(row._type)) byType.set(row._type, []);
    byType.get(row._type).push(row);
  }

  const imageSets = new Map();
  const tagMaps = new Map();
  const ratingMaps = new Map();
  for (const [type, list] of byType) {
    const ids = list.map((row) => row.id);
    const sets = getImageSets(type, ids);
    for (const [id, set] of sets) imageSets.set(stateKey(type, id), set);
    tagMaps.set(type, getTags(type, ids));
    ratingMaps.set(type, getRatings(type, ids));
  }

  const seasonRows = byType.get('season') || [];
  const episodeRows = byType.get('episode') || [];
  const trackRows = byType.get('track') || [];

  const seriesIds = [...new Set([
    ...seasonRows.map((row) => row.series_id),
    ...episodeRows.map((row) => row.series_id)
  ].filter(Boolean))];
  const extraSeriesImages = getImageSets('series', seriesIds);
  for (const [id, set] of extraSeriesImages) imageSets.set(stateKey('series', id), set);

  const extraSeasonImages = getImageSets('season', episodeRows.map((row) => row.season_id).filter(Boolean));
  for (const [id, set] of extraSeasonImages) imageSets.set(stateKey('season', id), set);

  const extraAlbumImages = getImageSets('album', trackRows.map((row) => row.album_id).filter(Boolean));
  for (const [id, set] of extraAlbumImages) imageSets.set(stateKey('album', id), set);

  return rows.map((row) => {
    const imageSet = imageSets.get(stateKey(row._type, row.id));
    const tags = (tagMaps.get(row._type) || new Map()).get(Number(row.id)) || [];
    const rating = (ratingMaps.get(row._type) || new Map()).get(Number(row.id));

    switch (row._type) {
      case 'movie':
        return movieDto(row, context, imageSet, tags, rating);
      case 'series':
        return seriesDto(row, context, imageSet, tags, rating);
      case 'season':
        return seasonDto(
          row,
          context,
          imageSet,
          imageSets.get(stateKey('series', row.series_id)),
          row.series_title
        );
      case 'episode':
        return episodeDto(
          row,
          context,
          imageSets.get(stateKey('series', row.series_id)),
          imageSets.get(stateKey('season', row.season_id))
        );
      case 'artist':
        return artistDto(row, context, imageSet, tags);
      case 'album':
        return albumDto(row, context, imageSet, tags, rating);
      case 'track':
        return trackDto(row, context, imageSet || imageSets.get(stateKey('album', row.album_id)), tags);
      case 'playlist': {
        const imageRow = row.cover_image_id
          ? db.prepare('SELECT * FROM images WHERE id = ?').get(row.cover_image_id)
          : null;
        return playlistDto(row, context, imageRow);
      }
      case 'collection': {
        const imageRow = row.cover_image_id
          ? db.prepare('SELECT * FROM images WHERE id = ?').get(row.cover_image_id)
          : null;
        return collectionDto(row, context, imageRow);
      }
      default:
        return null;
    }
  }).filter(Boolean);
}

export function buildLibraryDto(library, userId) {
  const context = getUserContext(userId);
  const covers = Array.isArray(library.covers) ? library.covers : [];
  let primaryTag;
  for (const cover of covers) {
    const match = /\/api\/image\/(\d+)\//.exec(String(cover));
    if (match) {
      primaryTag = match[1];
      break;
    }
  }

  const collectionType = library.type === 'shows'
    ? 'tvshows'
    : library.type === 'music'
      ? 'music'
      : 'movies';

  return {
    Id: makeId('library', library.id),
    Name: library.name,
    SortName: library.name,
    Type: 'CollectionFolder',
    CollectionType: collectionType,
    IsFolder: true,
    ImageTags: primaryTag ? { Primary: primaryTag } : {},
    BackdropImageTags: [],
    ChildCount: Number(library.media_count) || 0,
    DateCreated: isoDate(library.created_at),
    PlayAccess: 'Full',
    UserData: {
      PlaybackPositionTicks: 0,
      PlayCount: 0,
      IsFavorite: context.favorites.has(stateKey('library', library.id)),
      Played: false,
      Key: makeId('library', library.id),
      ItemId: makeId('library', library.id)
    }
  };
}
